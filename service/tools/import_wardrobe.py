"""Turn a folder of garment photographs into wardrobe items.

Photograph your clothes, run this once, and they are in the app — named,
categorised and colour-matched, with no typing.

    python tools/import_wardrobe.py ~/Pictures/my-clothes

For each photo it asks `/analyse` what the garment is (the same endpoint Add
Piece uses), downscales the image into `assets/images/wardrobe/`, and writes
`data/myWardrobe.ts`. The app picks that up alongside the seed wardrobe on the
next reload.

**Why your own photographs beat anything scraped from a retailer.** Legality
aside — and it is not aside, a shop's product photography is theirs — a garment
shot flat or on a hanger against a plain wall is the reference CatVTON was
trained on, and it outperforms the editorial photos in the seed wardrobe. The
best try-on results this project can produce come from clothes you own and
photographed yourself.

How to shoot them, in order of how much it matters:

  1. One garment per photo, filling most of the frame.
  2. Flat on the floor or hung against a plain wall. A door is fine.
  3. Front on, not at an angle, and not crumpled.
  4. Even light. Daylight indoors, away from direct sun, beats a flash.

Needs the service running (`npm run service`) and GEMINI_API_KEY set — the
naming and categorising is `/analyse` doing the work.

    python tools/import_wardrobe.py <folder> --dry-run     # analyse, write nothing
    python tools/import_wardrobe.py <folder> --category dresses
"""

import argparse
import base64
import json
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8000"
PHOTO_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

# Garment references do not need to be large -- CatVTON reads colour, cut and
# detail, all of which survive this -- and twenty phone photographs at full size
# would put a hundred megabytes of assets into the repository.
MAX_EDGE = 900
JPEG_QUALITY = 82

APP_ROOT = next(
    (p for p in Path(__file__).resolve().parents if (p / "data" / "mockWardrobe.ts").exists()),
    None,
)


def read_vocabulary() -> dict:
    """Categories, occasions and swatches, read out of the app's own files.

    Parsed rather than duplicated for the reason `/analyse` takes them in the
    request instead of holding its own copy: the app owns its vocabulary, and a
    second list in Python is one more pair of files to keep in step. Same
    approach as the timeout check in tests/test_tryon.py.
    """
    wardrobe = (APP_ROOT / "data" / "mockWardrobe.ts").read_text(encoding="utf-8")
    swatches = (APP_ROOT / "data" / "swatches.ts").read_text(encoding="utf-8")

    def string_list(source: str, name: str) -> list[str]:
        block = re.search(rf"{name}[^=]*=\s*\[(.*?)\]", source, re.S)
        if not block:
            raise SystemExit(f"could not find {name} — has data/ been reorganised?")
        return re.findall(r'"([^"]+)"', block.group(1))

    return {
        "categories": string_list(wardrobe, "CATEGORIES"),
        "occasions": string_list(wardrobe, "OCCASIONS"),
        "swatches": [
            {"hex": hex_value, "name": name}
            for hex_value, name in re.findall(
                r'\{\s*hex:\s*"([^"]+)",\s*name:\s*"([^"]+)"\s*\}', swatches
            )
        ],
    }


def have_pillow() -> bool:
    try:
        import PIL  # noqa: F401
    except ImportError:
        return False
    return True


def downscale(source: Path, destination: Path) -> None:
    """Shrink into the assets folder, or copy verbatim if Pillow is absent.

    Copying is a real fallback rather than a failure — the app resizes garment
    images again before sending them anyway, so the try-on is unaffected. What
    suffers is the repository: twenty untouched phone photographs are the better
    part of a hundred megabytes committed. `main` warns about that rather than
    letting it happen quietly.
    """
    if not have_pillow():
        shutil.copyfile(source, destination)
        return

    from PIL import Image

    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        image.save(destination, "JPEG", quality=JPEG_QUALITY, optimize=True)


def analyse(path: Path, vocabulary: dict, base: str) -> dict:
    body = {
        "image": base64.b64encode(path.read_bytes()).decode("ascii"),
        "mimeType": "image/jpeg",
        **vocabulary,
    }
    request = urllib.request.Request(
        base + "/analyse",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "piece"


def ts_literal(value) -> str:
    return "undefined" if value is None else json.dumps(value)


def render(items: list[dict]) -> str:
    """The generated module. Plain data plus a static require per image."""
    lines = [
        "// GENERATED by service/tools/import_wardrobe.py — safe to edit by hand,",
        "// but re-running the tool overwrites this file.",
        "//",
        "// Your own clothes, photographed by you. They sit alongside the seeded",
        "// demo wardrobe rather than replacing it — see SEED_WARDROBE in",
        "// store/useWardrobe.ts.",
        "//",
        "// The requires are written out one per item on purpose: Metro resolves",
        "// them at build time, so a variable path would not bundle.",
        "",
        'import { Image as RNImage } from "react-native";',
        'import type { WardrobeItem } from "./mockWardrobe";',
        "",
        "export const myWardrobe: WardrobeItem[] = [",
    ]

    for item in items:
        fields = ", ".join(
            f"{key}: {ts_literal(item[key])}"
            for key in ("id", "name", "brand", "category", "color", "colorName")
            if item.get(key) is not None
        )
        occasions = json.dumps(item["occasions"])
        image = f'RNImage.resolveAssetSource(require("@/assets/images/wardrobe/{item["file"]}")).uri'
        lines.append(f"  {{ {fields}, occasions: {occasions}, image: {image} }},")

    lines += ["];", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("folder", type=Path, help="folder of garment photographs")
    parser.add_argument("--base", default=BASE)
    parser.add_argument("--category", help="force a category instead of asking /analyse")
    parser.add_argument("--dry-run", action="store_true", help="analyse, write nothing")
    args = parser.parse_args()

    if APP_ROOT is None:
        print("X  could not locate the app root (looked for data/mockWardrobe.ts)")
        return 1
    if not args.folder.is_dir():
        print(f"X  not a folder: {args.folder}")
        return 1

    photos = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in PHOTO_SUFFIXES)
    if not photos:
        print(f"X  no photographs in {args.folder}")
        return 1

    vocabulary = read_vocabulary()
    if args.category and args.category not in vocabulary["categories"]:
        print(f"X  unknown category {args.category!r}; expected one of {vocabulary['categories']}")
        return 1

    assets = APP_ROOT / "assets" / "images" / "wardrobe"
    if not args.dry_run:
        assets.mkdir(parents=True, exist_ok=True)

        # Clear before writing. Filenames come from whatever `/analyse` decides
        # to call each garment, and that is not stable between runs — the same
        # photograph came back "Embroidered Kurta" once and "Embroidered Kurti"
        # the next time, leaving the first file behind with nothing referencing
        # it. Without this the folder silently accumulates orphans, and they get
        # committed.
        #
        # Safe because this folder is written by nothing else and read only
        # through the generated data/myWardrobe.ts, which is about to be
        # rewritten in the same breath. Anything hand-added here belongs in
        # assets/images/ instead.
        for stale in assets.glob("*.jpg"):
            stale.unlink()

    print(f"\n{len(photos)} photograph(s) in {args.folder}")

    if not args.dry_run and not have_pillow():
        # Worth interrupting for. The copies still work, but a phone photograph
        # is several megabytes and these are committed to the repository.
        print(
            "\n!  Pillow is not installed, so photographs will be copied at full\n"
            "   size instead of being scaled to "
            f"{MAX_EDGE}px. Twenty phone photos is\n"
            "   roughly a hundred megabytes of assets. To scale them:\n"
            "\n     pip install -r requirements-dev.txt\n"
        )

    print()

    items: list[dict] = []
    used: set[str] = set()

    for index, photo in enumerate(photos, start=1):
        print(f"  [{index}/{len(photos)}] {photo.name}", end=" ... ", flush=True)
        try:
            reading = analyse(photo, vocabulary, args.base)
        except urllib.error.HTTPError as err:
            detail = json.loads(err.read() or b"{}").get("detail", "")
            print(f"X {err.code} {detail}")
            if err.code == 503:
                print("\n   /analyse needs GEMINI_API_KEY in service/.env.")
                return 1
            continue
        except urllib.error.URLError as err:
            print(f"X cannot reach {args.base} — is `npm run service` running? ({err.reason})")
            return 1

        name = reading.get("name") or photo.stem.replace("-", " ").title()
        category = args.category or reading.get("category")
        if not category:
            # Category drives the try-on cloth type, so a guess here is worse
            # than a gap. Left for the user to fill in rather than invented.
            print(f"? could not categorise — add one by hand for {name!r}")
            category = "tops"

        identifier = slug(name)
        while identifier in used:
            identifier += "-2"
        used.add(identifier)

        filename = f"{identifier}.jpg"
        if not args.dry_run:
            downscale(photo, assets / filename)

        items.append(
            {
                "id": f"mine-{identifier}",
                "name": name,
                "brand": reading.get("brand"),
                "category": category,
                "color": reading.get("color") or "#6C6459",
                "colorName": reading.get("colorName") or "grey",
                "occasions": reading.get("occasions") or ["casual"],
                "file": filename,
            }
        )
        print(f"{name} — {category}, {items[-1]['colorName']}")

    if not items:
        print("\nnothing imported")
        return 1

    if args.dry_run:
        print(f"\ndry run — {len(items)} item(s) analysed, nothing written")
        return 0

    target = APP_ROOT / "data" / "myWardrobe.ts"
    target.write_text(render(items), encoding="utf-8")

    print(f"\nOK  {len(items)} item(s) -> {target}")
    print(f"    images -> {assets}")
    print("\n    Reload the app. Check the categories in that file before demoing —")
    print("    a shalwar kameez must be `dresses`, or try-on fits only its top half.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
