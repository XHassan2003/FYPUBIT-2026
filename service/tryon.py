"""Put the user in the clothes: virtual try-on by image generation.

A stand-in, and worth being honest about which part. A purpose-built try-on
model warps a specific garment onto a specific body and keeps both intact. This
asks a general image model to compose a new photograph from references, which
is a different job with a different failure mode: the result usually looks
plausible rather than accurate, and faces drift. Good enough to demonstrate the
idea, not good enough to judge whether a coat fits.

The structure is the part meant to survive. When a real try-on model lands it
replaces `generate_try_on`; the endpoint, the request shape and the whole app
flow stay as they are.
"""

import base64
from typing import Optional

from vision import VisionFailed, VisionRateLimited, VisionUnavailable, _client, _raise_for

# Multi-image composition. The person plus their garments are all reference
# images, and this is the model that takes more than one.
MODEL = "gemini-3.1-flash-image"

# Portrait, because the result is a person and the screen it lands on is a
# phone held upright.
ASPECT_RATIO = "3:4"

# The model accepts up to fourteen references and counts people separately from
# objects. One person plus a full head-to-toe outfit is well inside that; the
# cap is here so a wardrobe full of accessories cannot quietly exceed it.
MAX_GARMENTS = 6

INSTRUCTIONS = """Generate a single photorealistic photograph of the person shown in the first image wearing the garments shown in the images that follow.

Hold these fixed, exactly as they are in the first image:
- the person's face, hair, skin tone, body shape and build
- their pose and the direction they are facing
- the background and the lighting

Change only what they are wearing. Replace their existing clothes entirely with the garments provided — do not layer the new clothes over the old ones, and do not leave parts of the original outfit showing.

Render each garment with the colour, cut, length, fabric and detailing it has in its own reference image. Dress the person as a real outfit: correct layering order, garments sitting naturally on the body with believable folds, shadows and contact with the figure.

Do not add clothing that was not provided. Do not add text, logos, watermarks or borders. Produce one image of one person, framed head to knee or full length."""


def _label(index: int, name: Optional[str], category: Optional[str]) -> str:
    """Name each reference so the model knows what it is looking at."""
    described = " — ".join(part for part in (category, name) if part)
    return f"Garment {index}{f' ({described})' if described else ''}:"


def generate_try_on(
    person_base64: str,
    person_mime_type: str,
    garments: list[dict],
    aspect_ratio: str = ASPECT_RATIO,
) -> dict:
    """Compose the person wearing the garments. Returns base64 image bytes.

    `garments` is a list of {image, mimeType, name, category}. Raises the same
    three exception types as the photo analyser, so the endpoint above can
    treat a missing key, a quota error and a failure the same way it already
    does for `/analyse`.
    """
    if not garments:
        raise VisionFailed("No garments were sent to try on")

    if len(garments) > MAX_GARMENTS:
        raise VisionFailed(
            f"Too many garments for one look — {MAX_GARMENTS} is the most this can compose"
        )

    # Raises VisionUnavailable when the key is missing, same as /analyse.
    client = _client()

    # Interleaved so each image arrives already labelled, rather than the model
    # having to guess which reference is the coat and which is the shoes.
    contents: list[dict] = [
        {"type": "text", "text": INSTRUCTIONS},
        {"type": "text", "text": "The person:"},
        {"type": "image", "data": person_base64, "mime_type": person_mime_type},
    ]

    for index, garment in enumerate(garments, start=1):
        contents.append(
            {"type": "text", "text": _label(index, garment.get("name"), garment.get("category"))}
        )
        contents.append(
            {
                "type": "image",
                "data": garment["image"],
                "mime_type": garment.get("mimeType", "image/jpeg"),
            }
        )

    try:
        interaction = client.interactions.create(
            model=MODEL,
            input=contents,
            response_format={
                "type": "image",
                "mime_type": "image/jpeg",
                "aspect_ratio": aspect_ratio,
            },
        )
    except Exception as err:  # noqa: BLE001 — see vision._raise_for
        _raise_for(err)

    output = getattr(interaction, "output_image", None)
    data = getattr(output, "data", None)

    if not data:
        # The model can decline to produce an image — a photo it will not put
        # clothes on, a safety refusal — and answer with text instead. That is
        # not a crash, and the app should say so plainly.
        raise VisionFailed(
            "Gemini did not return an image for that photo. Try a clearer, "
            "front-facing photograph of one person."
        )

    # Fail here rather than handing the app something it cannot decode.
    try:
        base64.b64decode(data, validate=True)
    except Exception as err:  # noqa: BLE001
        raise VisionFailed("Gemini returned an image that could not be read") from err

    return {"image": data, "mimeType": "image/jpeg"}


__all__ = ["generate_try_on", "VisionFailed", "VisionRateLimited", "VisionUnavailable", "MAX_GARMENTS"]
