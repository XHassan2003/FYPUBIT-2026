"""Read a garment from a photograph, so nobody has to type it in.

Add Piece currently asks for a name, a category, a colour swatch and a list of
occasions, by hand, for every item. This looks at the photo and fills them in.

Two halves, deliberately split:

*Gemini* answers the questions only a model can — what garment is this, what
would you call it, when would you wear it, and what colour is it actually. It
is asked for a free hex, not a colour name.

*Our own colour maths* then decides which of the app's swatches that hex is,
using the CIEDE2000 distance in `color.py`. That keeps the vocabulary exactly
what the wardrobe already speaks, makes the mapping deterministic and
explainable, and means the one part of the answer that has to line up with the
rest of the app is not left to a model's choice of adjective.

The app's categories, occasions and swatches travel in the request rather than
being duplicated here, for the same reason the seasonal palettes do.
"""

import json
import os
from typing import Optional

from typing import NoReturn

from google import genai

from color import nearest_palette_color

# Fast and cheap, and this is a single image with a small structured answer.
MODEL = "gemini-3.7-flash"

# Gemini bills images in 768px tiles, so there is nothing to gain from a larger
# photo and a lot of latency to lose. The app resizes before sending; this is
# the ceiling the prompt is written for.
PROMPT = """You are cataloguing a single item of clothing for a personal wardrobe app.

Look at the photograph and identify the one garment it is showing. Ignore the
background, the hanger, the model's other clothes, and any packaging.

- name: a short, natural retail name for the garment, in title case, two or
  three words. "Wool Overcoat", "Striped Cotton Tee", "Ankle Boots". Do not
  include the colour in the name.
- brand: only if a logo or label is clearly legible. Otherwise omit it. Never
  guess a brand from styling alone.
- category: which of the allowed categories the garment belongs to.
- dominantColor: the garment's main colour as a #RRGGBB hex. Judge the fabric
  itself in neutral light — not the shadow, the highlight, or the background.
  For a patterned garment, give the colour that reads from a distance.
- occasions: every allowed occasion the garment genuinely suits. Most garments
  suit more than one. Do not include an occasion just because it is possible."""


class VisionUnavailable(RuntimeError):
    """No API key configured. A setup problem, not a runtime failure."""


class VisionFailed(RuntimeError):
    """The model was reached but did not return something usable."""


class VisionRateLimited(RuntimeError):
    """Out of quota, or asking too fast.

    Worth its own type because it is neither a bug nor a broken photo: the
    request was fine and the same request will work later. Telling someone to
    "try a different photo" when the real answer is "wait a minute" sends them
    off fixing something that was never wrong.

    The free tier is small enough that a demo can reach it, and the SDK retries
    internally with backoff before giving up — which is why a rate-limited call
    can take a minute or more to fail rather than failing at once.
    """


def _raise_for(err: Exception) -> NoReturn:
    """Turn an SDK exception into one of ours, by HTTP status.

    Deliberately duck-typed rather than matched on class. The Interactions API
    raises from `google.genai._gaos.lib.compat_errors`, whose exceptions do not
    inherit from the `google.genai.errors.APIError` you would reasonably import
    — there are two unrelated classes of that name, and `isinstance` against
    the public one is simply False. That mismatch is what made a quota error
    reach the app as "could not read it" instead of "wait a moment".

    The two hierarchies also disagree on where the status lives: the newer one
    exposes `status_code`, the older `code`. Read whichever is there, and stay
    out of the private module.
    """
    status = getattr(err, "status_code", None) or getattr(err, "code", None)

    if status == 429:
        raise VisionRateLimited(
            "Gemini is rate limiting this key — the free tier has a small quota. "
            "Wait a minute and try again."
        ) from err

    if status == 503:
        # Not a rate limit, so not a 429 to the app, but the same thing to do
        # about it. Worth saying so rather than blaming the photograph.
        raise VisionFailed("Gemini is overloaded right now. Wait a moment and try again.") from err

    raise VisionFailed(f"Gemini did not answer: {err}") from err


def _client() -> genai.Client:
    if not os.environ.get("GEMINI_API_KEY"):
        raise VisionUnavailable(
            "GEMINI_API_KEY is not set. Add it to service/.env — see service/.env.example."
        )
    return genai.Client()


def _schema(categories: list[str], occasions: list[str]) -> dict:
    """Constrain the answer at generation time rather than validating after.

    The categories and occasions are enums in the schema, so the model cannot
    invent a sixth category that the app has no screen for.
    """
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "brand": {"type": "string"},
            "category": {"type": "string", "enum": categories},
            "dominantColor": {
                "type": "string",
                "description": "The garment's main colour as #RRGGBB",
            },
            "occasions": {
                "type": "array",
                "items": {"type": "string", "enum": occasions},
            },
        },
        "required": ["name", "category", "dominantColor", "occasions"],
    }


def analyse_garment(
    image_base64: str,
    mime_type: str,
    categories: list[str],
    occasions: list[str],
    swatches: list[dict],
) -> dict:
    """Describe the garment in a photo, in the app's own vocabulary.

    Returns the fields Add Piece needs. `color`/`colorName` are absent when the
    model's hex could not be read — the form keeps whatever the user had
    selected rather than being given an invented colour.
    """
    client = _client()

    try:
        interaction = client.interactions.create(
            model=MODEL,
            input=[
                {"type": "text", "text": PROMPT},
                {"type": "image", "data": image_base64, "mime_type": mime_type},
            ],
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _schema(categories, occasions),
            },
        )
    except Exception as err:  # noqa: BLE001 — see _raise_for on why not by type
        _raise_for(err)

    try:
        reading = json.loads(interaction.output_text)
    except (json.JSONDecodeError, AttributeError, TypeError) as err:
        raise VisionFailed("Gemini returned something that was not JSON") from err

    return _to_garment(reading, categories, occasions, swatches)


def _to_garment(
    reading: dict,
    categories: list[str],
    occasions: list[str],
    swatches: list[dict],
) -> dict:
    """Turn the model's answer into a wardrobe item, defensively.

    The schema constrains generation but does not guarantee it, so every field
    is checked against what the app can actually accept. Anything unusable is
    dropped rather than passed on — a form field left for the user to fill is a
    much better outcome than one silently filled with nonsense.
    """
    name = reading.get("name")
    brand = reading.get("brand")
    category = reading.get("category")

    garment: dict = {
        "name": name.strip() if isinstance(name, str) and name.strip() else None,
        "brand": brand.strip() if isinstance(brand, str) and brand.strip() else None,
        "category": category if category in categories else None,
        "occasions": [
            occasion
            for occasion in reading.get("occasions", [])
            if occasion in occasions
        ],
        "detectedColor": None,
        "color": None,
        "colorName": None,
        "deltaE": None,
    }

    detected = reading.get("dominantColor")
    if not isinstance(detected, str):
        return garment

    palette = [swatch["hex"] for swatch in swatches]
    try:
        nearest, distance = nearest_palette_color(detected, palette)
    except ValueError:
        # The model's hex was unreadable. Say nothing about colour rather than
        # snapping an unknown to whichever swatch happens to be first.
        return garment

    if nearest is None:
        return garment

    garment["detectedColor"] = detected
    garment["color"] = nearest
    garment["colorName"] = next(
        (swatch["name"] for swatch in swatches if swatch["hex"] == nearest), None
    )
    garment["deltaE"] = round(distance, 2)
    return garment
