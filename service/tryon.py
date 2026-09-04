"""Put the user in the clothes: virtual try-on with CatVTON.

This used to ask Gemini to compose a new photograph from reference images. That
is a different job from try-on, with a different failure mode — the result
looked *plausible* rather than *accurate*, and faces drifted — so it has been
replaced by a model built for the task.

**CatVTON** (Chong et al., ICLR 2025) treats try-on as inpainting rather than
generation. The garment and the person are concatenated along the spatial
dimension and handed to a single denoising UNet: no warping module, no pose
encoder, no ReferenceNet, no text branch. 899M parameters in total, 49.6M of
them trainable. Because the person's pixels outside the garment region are
never regenerated, the face, the hair and the background survive intact —
exactly the thing the Gemini version could not promise.

It is hosted rather than run here. `fal-ai/cat-vton` is one HTTPS call and
needs no GPU, no detectron2, and no CUDA on a Windows laptop. The trade is a
per-generation cost and a network dependency — the same trade the previous
version already made with Gemini, so nothing about the deployment story
changed.

**What CatVTON cannot do**, and the app has to respect rather than paper over:

- *One garment per pass.* The model fits a single garment into a single masked
  region. There is no multi-garment mode, so `MAX_GARMENTS` is 1 — see the note
  on it below for why chaining was not the answer.
- *Clothes only.* It is trained on VITON-HD and DressCode, which are upper
  body, lower body and dresses. Shoes, bags and jewellery are not in the label
  space at all. `CLOTH_TYPES` is therefore a whitelist and everything else is
  refused before anything is spent.

The structure is the part that was built to survive, and it did: this file was
rewritten end to end and `main.py`, `models.py` and the app's request shape
were not touched.
"""

import base64
import logging
import os
import time
from typing import NoReturn, Optional

import fal_client
import httpx

from errors import VisionFailed, VisionRateLimited, VisionUnavailable, status_of

# Every generation is billed, so how long they take is worth having in the
# terminal rather than guessing at. uvicorn's own logger picks this up, so the
# timing appears alongside the request line it belongs to.
log = logging.getLogger("stylist.tryon")

MODEL = "fal-ai/cat-vton"

# Which masked region the model should inpaint. The app's own categories on the
# left, CatVTON's cloth types on the right.
#
# A whitelist, not a mapping with a default. Guessing "upper" for an unknown
# category would put a pair of trousers on someone's chest, and finding that out
# costs a generation — refusing costs nothing. `shoes` and `accessories` are
# absent because the model has no notion of them, not because they were
# forgotten.
CLOTH_TYPES = {
    "tops": "upper",
    "bottoms": "lower",
    # One piece from shoulder to hem — a shalwar kameez, a kurta, a sari, a
    # lehenga, a western dress. `overall` masks the whole torso in a single pass,
    # which is the only correct answer for these: mapping a kameez to `upper`
    # fits its top half and leaves the wearer's own trousers showing through
    # underneath. DressCode, one of CatVTON's two training sets, has a dresses
    # split, so this is a case the model was actually trained for.
    "dresses": "overall",
    # `outer` rather than `upper`: the coat is layered over what the person is
    # already wearing instead of replacing it.
    "outerwear": "outer",
}

# One. Not a tunable — it is what the architecture does.
#
# Chaining passes (dress the top half, feed that result back in as the person,
# dress the bottom half) was the obvious way to keep the old six-garment API.
# It was not worth it: the second pass treats the first pass's output as a
# photograph, so every artifact is baked in and re-inpainted, and the cost and
# latency multiply. The app only ever sends one garment anyway — see
# `app/try-on.tsx`, where step two picks exactly one piece.
MAX_GARMENTS = 1

# 768x1024, portrait — the result is a person and the screen it lands on is a
# phone held upright. Matches PERSON_EDGE in store/useTryOn.ts, so the photo the
# app uploads is already the right size.
IMAGE_SIZE = "portrait_4_3"

# fal's defaults, named here so they are visible and tunable in one place rather
# than implicit in the request. 30 steps is the quality/latency knob; the
# guidance scale is low because there is no text prompt to adhere to — the
# garment image is the condition.
STEPS = 30
GUIDANCE = 2.5

# A ceiling for a queue that never drains, not a target. It sits inside the app's
# own budget (TRY_ON_TIMEOUT_MS) so the service is the one that gives up first
# and can say why, instead of the phone timing out on silence.
#
# **Generous on purpose, and it was not always.** This was 100s, chosen against a
# 64s worst case with no real headroom, and a phone photograph blew straight
# through it. Timing out here does not cancel anything: the job carries on
# running on fal and is billed whether or not we are still listening. So a
# too-tight ceiling does not save money, it spends it and throws the result
# away — which makes waiting longer strictly better than giving up early.
#
# How long a generation takes is really a measure of how well the photograph
# suits the model. Roughly, from what has been observed: a clean studio shot ~11s,
# an awkward editorial crop ~64s, and a difficult phone photograph longer still.
# Anything approaching this ceiling was probably going to produce a poor result
# anyway, which is why the timeout message talks about the photograph.
CLIENT_TIMEOUT_S = 240.0

# Past this, say so in the log. A clean photograph comes back in about ten
# seconds, so half a minute means the model is struggling with what it was
# given — and every slow generation observed so far has also been a poor one.
SLOW_GENERATION_S = 30.0

# Fetching a finished image off fal's CDN is quick or broken.
DOWNLOAD_TIMEOUT_S = 30.0


def _require_key() -> None:
    """Fail before the request, not during it.

    fal reads FAL_KEY from the environment itself and would raise mid-call. A
    missing key is a setup problem and deserves a 503 that says so, not a 502
    that reads like the model refused the photograph.
    """
    if not os.environ.get("FAL_KEY"):
        raise VisionUnavailable(
            "FAL_KEY is not set. Add it to service/.env — see service/.env.example."
        )


def _cloth_type(category: Optional[str]) -> str:
    """Which region CatVTON should fit this garment into.

    Raises rather than guessing, for both the unknown and the unsupported case.
    The message names the garment, because "shoes cannot be tried on" is
    something the user can act on and "generation failed" is not.
    """
    if not category:
        raise VisionFailed(
            "That piece has no category, so there is nothing to say where it "
            "should sit on the body."
        )

    cloth_type = CLOTH_TYPES.get(category)
    if cloth_type is None:
        wearable = ", ".join(CLOTH_TYPES)
        raise VisionFailed(
            f"CatVTON cannot fit {category} — it dresses {wearable} only. "
            "Pick a different piece."
        )

    return cloth_type


def _data_uri(image_base64: str, mime_type: str) -> str:
    """Inline the image into the request.

    fal accepts data URIs as well as hosted URLs, which is worth the few extra
    kilobytes on the wire: the alternative is uploading both images to storage
    first, which is two more round trips, two more things to fail, and the
    user's photograph left sitting in a bucket.

    The base64 is checked here because a payload the app could not encode should
    fail now, for free, rather than after a generation has been paid for.
    """
    try:
        base64.b64decode(image_base64, validate=True)
    except Exception as err:  # noqa: BLE001 — any decode failure means the same thing
        raise VisionFailed("One of those images could not be read") from err

    return f"data:{mime_type};base64,{image_base64}"


def _raise_for(err: Exception) -> NoReturn:
    """Turn a fal exception into one of ours, by HTTP status.

    Duck-typed rather than matched on class — see `errors.status_of` for the
    reasoning, which predates fal and applies to it just as well.
    """
    # fal's own timeout, which is not an HTTP status at all.
    #
    # "Wait a moment and try again" is what this used to say, and it was poor
    # advice: waiting changes nothing, because the delay is the model labouring
    # over a photograph it finds hard rather than a queue that is busy. Retrying
    # the same photo buys another long wait and another charge. Point at the
    # thing that would actually help.
    if isinstance(err, TimeoutError):
        raise VisionFailed(
            "That photograph took too long for the model to work with. This "
            "usually means it is hard to read — try one where you are standing "
            "head to feet, facing the camera, against a plain background."
        ) from err

    status = status_of(err)

    if status in (401, 403):
        # Still a setup problem rather than a failure, so still a 503 — "not set
        # up" is the thing to go and fix, and waiting will not help.
        #
        # But *which* setup problem matters, and fal answers 403 for at least
        # two that need opposite fixes: a key it does not recognise, and an
        # account locked for an exhausted balance. Asserting "bad key" sends
        # someone with an empty balance off re-copying a key that was always
        # fine — the exact trap `errors.status_of` documents for Gemini quota,
        # which is what makes it worth guarding against twice.
        #
        # fal says which in the message, so its words go through verbatim.
        detail = str(err).strip()
        raise VisionUnavailable(
            detail or "fal rejected the API key. Check FAL_KEY in service/.env."
        ) from err

    if status == 429:
        raise VisionRateLimited(
            "fal is rate limiting this key. Wait a minute and try again."
        ) from err

    if status == 422:
        # fal validates the arguments before queueing, so this is our request
        # being wrong — a malformed image, or a cloth type it did not accept.
        raise VisionFailed(f"CatVTON would not accept that request: {err}") from err

    if status in (502, 503, 504):
        raise VisionFailed(
            "The try-on model is overloaded right now. Wait a moment and try again."
        ) from err

    raise VisionFailed(f"The try-on model did not answer: {err}") from err


def _download(url: str, fallback_mime: Optional[str]) -> dict:
    """Fetch the finished image and hand it back as base64.

    The service downloads rather than passing fal's URL through to the phone,
    for two reasons. The app already writes base64 straight to a file (see
    `useTryOn.generate`), so returning a URL would mean changing the response
    shape and the app for no gain. And the URL is an unauthenticated public
    link to a photograph of the user — better it never leaves this process.
    """
    try:
        response = httpx.get(url, timeout=DOWNLOAD_TIMEOUT_S, follow_redirects=True)
        response.raise_for_status()
    except Exception as err:  # noqa: BLE001
        raise VisionFailed(
            "The look was generated but could not be fetched back. Try again."
        ) from err

    # fal returns PNG by default, so this is not always the JPEG the request
    # sent. Passed through honestly rather than relabelled — the app uses it to
    # name the file and to share it.
    header = response.headers.get("content-type") or fallback_mime or "image/png"
    mime_type = header.split(";")[0].strip()

    return {
        "image": base64.b64encode(response.content).decode("ascii"),
        "mimeType": mime_type,
    }


def generate_try_on(
    person_base64: str,
    person_mime_type: str,
    garments: list[dict],
    image_size: str = IMAGE_SIZE,
) -> dict:
    """Fit the garment onto the person. Returns base64 image bytes.

    `garments` is a list of {image, mimeType, name, category} — a list of one,
    kept as a list so the request shape did not have to change when the model
    did. `name` is now unused: CatVTON reads the garment out of its photograph
    and has no text branch to tell it what the photograph is of.

    Raises the same three exception types as the photo analyser, so the endpoint
    treats a missing key, a quota error and a failure exactly as it already does
    for `/analyse`.
    """
    if not garments:
        raise VisionFailed("No garment was sent to try on")

    if len(garments) > MAX_GARMENTS:
        raise VisionFailed(
            "CatVTON fits one garment at a time. Send a single piece."
        )

    garment = garments[0]

    # Both of these refuse before the network is touched, so an unwearable
    # category or an unreadable image costs nothing.
    cloth_type = _cloth_type(garment.get("category"))
    human_image = _data_uri(person_base64, person_mime_type)
    garment_image = _data_uri(garment["image"], garment.get("mimeType", "image/jpeg"))

    _require_key()

    # Roughly what is being uploaded. Base64 is 4 bytes per 3, and a payload far
    # larger than expected means the app's resize did not happen — worth seeing
    # before blaming the model for being slow.
    payload_kb = (len(human_image) + len(garment_image)) * 3 // 4 // 1024
    log.info("try-on: %s garment, %s, ~%d KB up", cloth_type, image_size, payload_kb)

    started = time.monotonic()

    try:
        result = fal_client.subscribe(
            MODEL,
            arguments={
                "human_image_url": human_image,
                "garment_image_url": garment_image,
                "cloth_type": cloth_type,
                "image_size": image_size,
                "num_inference_steps": STEPS,
                "guidance_scale": GUIDANCE,
            },
            client_timeout=CLIENT_TIMEOUT_S,
        )
    except Exception as err:  # noqa: BLE001 — see _raise_for on why not by type
        # Logged before it is translated, because the elapsed time is most of
        # the diagnosis and _raise_for is about to discard it. A generation that
        # ran for minutes and a key that was rejected in 200ms both arrive at the
        # app as one 502, and they are not remotely the same problem.
        log.warning("try-on: failed after %.1fs — %s", time.monotonic() - started, err)
        _raise_for(err)

    elapsed = time.monotonic() - started
    log.info("try-on: fal returned in %.1fs", elapsed)

    if elapsed > SLOW_GENERATION_S:
        # Not an error, and nothing to do about it now — but the correlation is
        # strong enough to be worth flagging while the photograph is still on
        # screen: slow generations have so far been the ones that came back
        # smeared. See the note on CLIENT_TIMEOUT_S.
        log.warning(
            "try-on: %.1fs is slow — the photograph is probably hard for the "
            "model, and the result may be poor",
            elapsed,
        )

    image = (result or {}).get("image") or {}
    url = image.get("url")

    if not url:
        # A queued job that finishes without an image. Rare, and not something
        # the user can fix by choosing a different photograph — so do not tell
        # them to.
        raise VisionFailed(
            "The try-on model finished without producing an image. Try again."
        )

    return _download(url, fallback_mime=image.get("content_type"))


__all__ = [
    "generate_try_on",
    "VisionFailed",
    "VisionRateLimited",
    "VisionUnavailable",
    "MAX_GARMENTS",
    "CLOTH_TYPES",
]
