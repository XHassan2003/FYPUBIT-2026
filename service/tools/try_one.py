"""One real CatVTON generation, end to end, without the phone.

This is the paid test, and the only thing in the repo that spends money when you
run it. One generation per invocation -- cents, not pounds, but not free, which
is why it is a tool you run deliberately rather than part of the suite. See
tests/test_tryon.py, where every path is stubbed for exactly that reason.

It sends the same photograph the app's "Use sample" button uses and a garment
from the seeded wardrobe, through the real endpoint, so what it exercises is
the request the app actually makes rather than an approximation of it.

    python tools/try_one.py                       # sample person + Oxford Shirt
    python tools/try_one.py --garment bottom-1    # a different seeded piece
    python tools/try_one.py --person me.jpg --garment-file coat.jpg --category outerwear

Needs the service running, from the project root:

    npm run service
"""

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8000"

# Walk up to the app root, so this works whatever the working directory is.
# The same photograph the app's "Use sample" button uses -- see
# TRY_ON_DEMO_PHOTO in store/useTryOn.ts, which explains what makes it a good
# one and why the editorial hero it replaced was a bad one.
SAMPLE_RELATIVE = Path("assets") / "images" / "editorial" / "try-on-sample.jpg"
APP_ROOT = next(
    (parent for parent in Path(__file__).resolve().parents if (parent / SAMPLE_RELATIVE).exists()),
    None,
)
SAMPLE_PERSON = APP_ROOT / SAMPLE_RELATIVE if APP_ROOT else None


def unsplash(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w=800&q=80"


# A handful of pieces from data/mockWardrobe.ts, so the garment is one the app
# really has rather than a stock photo chosen here.
SEEDED = {
    "top-1": ("Oxford Shirt", "tops", unsplash("1620799139507-2a76f79a2f4d")),
    "top-3": ("Knit Sweater", "tops", unsplash("1574201635302-388dd92a4c3f")),
    "bottom-1": ("Denim Jeans", "bottoms", unsplash("1570308345368-f21d4b0d81a9")),
    "bottom-2": ("Tailored Trousers", "bottoms", unsplash("1624378439575-d8705ad7ae80")),
}


def encode_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def encode_url(url: str) -> str:
    print(f"  fetching garment  {url[:58]}...")
    with urllib.request.urlopen(url, timeout=60) as response:
        return base64.b64encode(response.read()).decode("ascii")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one real try-on generation.")
    parser.add_argument("--garment", default="top-1", choices=sorted(SEEDED))
    parser.add_argument("--garment-file", type=Path, help="your own garment photo")
    parser.add_argument("--category", help="tops, bottoms or outerwear")
    parser.add_argument("--person", type=Path, default=SAMPLE_PERSON)
    parser.add_argument("--base", default=BASE)
    parser.add_argument("--dry-run", action="store_true", help="build the request, send nothing")
    args = parser.parse_args()

    if not args.person or not Path(args.person).exists():
        print(f"X  no person photo -- pass --person <path>  (looked for {args.person})")
        return 1

    if args.garment_file:
        if not args.garment_file.exists():
            print(f"X  no such garment file: {args.garment_file}")
            return 1
        if not args.category:
            print("X  --garment-file needs --category (tops, bottoms or outerwear)")
            return 1
        name, category = args.garment_file.stem, args.category
        garment_base64 = encode_file(args.garment_file)
    else:
        name, category, url = SEEDED[args.garment]
        category = args.category or category
        garment_base64 = encode_url(url)

    print(f"\n  person   {Path(args.person).name}")
    print(f"  garment  {name}  ({category})")

    body = {
        "person": encode_file(Path(args.person)),
        "personMimeType": "image/jpeg",
        "garments": [
            {
                "image": garment_base64,
                "mimeType": "image/jpeg",
                "name": name,
                "category": category,
            }
        ],
    }

    if args.dry_run:
        print(f"\n  dry run -- request is {len(json.dumps(body)) // 1024} KB, nothing sent")
        return 0

    print("\n  This spends one generation. Sending...\n")

    request = urllib.request.Request(
        args.base + "/try-on",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )

    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as err:
        detail = json.loads(err.read() or b"{}").get("detail", "")
        print(f"X  {err.code}  {detail}")
        # Only offer the key advice when the key is actually what is wrong. A
        # 503 also covers a fal account with no balance left, and telling
        # someone to re-copy a valid key wastes their afternoon.
        if err.code == 503 and "FAL_KEY" in detail:
            print("\n   Add FAL_KEY to service/.env, then restart the service.")
        elif err.code == 503 and "balance" in detail.lower():
            print("\n   The key is fine — the account is out of credit.")
            print("   Top up at https://fal.ai/dashboard/billing and run this again.")
        return 1
    except urllib.error.URLError as err:
        print(f"X  could not reach {args.base} -- is the service running? ({err.reason})")
        return 1

    elapsed = time.time() - started
    mime_type = payload.get("mimeType", "image/png")
    out = Path.cwd() / f"tryon-result.{'png' if mime_type == 'image/png' else 'jpg'}"
    out.write_bytes(base64.b64decode(payload["image"]))

    print(f"OK  {elapsed:.1f}s   {mime_type}   {out.stat().st_size // 1024} KB")
    print(f"    {out}")
    print("\n    Check the face and the background against the person photo --")
    print("    they should be pixel-for-pixel unchanged. That is what CatVTON")
    print("    guarantees by inpainting, and what the old version could not.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
