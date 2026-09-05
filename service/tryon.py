"""Put the user in the clothes: virtual try-on with FASHN v1.6.

Third model in this endpoint's life, and each swap was for a reason worth
knowing.

*Gemini* composed a new photograph from reference images. Plausible rather than
accurate, and faces drifted, because nothing in the method required the output
to contain the same person as the input.

*CatVTON* fixed that by treating try-on as inpainting — only the masked garment
region is regenerated, so the face, hair and background survive untouched. It
was a real try-on model and a large step up. Two things kept biting:

  - It wants the garment as a **flat product shot**. Given a photograph of a
    *person wearing* the garment it has to separate garment from wearer first,
    and the result came back smeared. That made half the useful sources on the
    internet unusable, and it is why the South Asian formalwear in the seed
    wardrobe reads worse than the hanger-shot shirts beside it.
  - 768x1024, and fine detail did not survive. An Oxford shirt came back the
    right colour and the right shape with no collar and no buttons.

**FASHN v1.6** is built for exactly those two problems. It renders at
**864x1296**, it is trained to preserve garment text and print, and it takes a
`garment_photo_type` control that accepts **on-model photographs as well as
flat-lay** ones. That last point is the reason for this swap: it means a
garment picture found on a retailer's site or in a search result works as a
reference, rather than only clothes you have photographed on a hanger yourself.

Still hosted on fal, so nothing about deployment changed: one HTTPS call, no
GPU, no CUDA.

**What it still cannot do**, and the app respects rather than papers over:

- *One garment per pass.* `MAX_GARMENTS` is 1 — see the note on it below.
- *Clothes only, in three shapes.* `tops`, `bottoms`, `one-pieces`. Shoes, bags
  and jewellery are not categories it has, so `FASHN_CATEGORIES` is a whitelist
  and everything else is refused before anything is spent.
- *No separate outerwear category.* CatVTON had `outer`, which layered a coat
  over what the person already wore. FASHN has no equivalent, so outerwear maps
  to `tops` and **replaces** the existing top rather than going over it. That is
  a genuine regression from the previous model and the only one in this swap.

The structure is the part that was built to survive, and it has now done so
twice: this file was rewritten end to end again, and `main.py`, `models.py` and
the app's request shape were not touched either time.
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

MODEL = "fal-ai/fashn/tryon/v1.6"

# The app's own categories on the left, FASHN's on the right.
#
# A whitelist, not a mapping with a default. Guessing `tops` for an unknown
# category would put a pair of trousers on someone's chest, and finding that out
# costs a generation — refusing costs nothing. `shoes` and `accessories` are
# absent because the model has no notion of them, not because they were
# forgotten.
#
# FASHN also offers `auto`, which infers the category from the garment image.
# Deliberately unused: the wardrobe already *knows* what each piece is, and
# letting the model re-guess would trade a fact for a prediction — one that,
# when wrong, is wrong expensively and silently.
FASHN_CATEGORIES = {
    "tops": "tops",
    "bottoms": "bottoms",
    # One piece from shoulder to hem — a shalwar kameez, a kurta, a sari, a
    # lehenga, a western dress. Fitting these as `tops` would dress the upper
    # half and leave the wearer's own trousers showing through underneath.
    "dresses": "one-pieces",
    # The one regression in moving off CatVTON, which had a dedicated `outer`
    # type that layered a coat over what was already worn. FASHN has three
    # categories and none of them is outerwear, so a coat is a top-half garment
    # and **replaces** the top rather than going over it. Worth knowing before
    # demoing a blazer over a shirt and wondering where the shirt went.
    "outerwear": "tops",
}

# One. Not a tunable — it is what the architecture does.
#
# Chaining passes (dress the top half, feed that result back in as the person,
# Two: one for the lower body and one for the upper. A full outfit.
#
# **This reverses an earlier decision, and the reason it reverses is the model.**
# Under CatVTON chaining was rejected outright: the second pass treats the first
# pass's output as a photograph, and CatVTON's output was rough enough that
# every artifact got baked in and re-inpainted, so a two-piece look came out
# visibly worse than either piece alone. FASHN v1.6 returns a clean enough image
# to survive being fed back in, which is what makes this worth doing now and did
# not before.
#
# The costs are real and unchanged: two passes are two generations, billed and
# waited for. That is the honest price of seeing a whole outfit, and the app says
# so before spending it.
#
# **What chaining is good at, measured rather than assumed.** Three two-piece
# runs against the same photograph:
#
#   plain polo + tailored trousers   45s   both garments clean, nothing bled
#   dip-dye shirt + jeans            57s   the shirt's print ran down the legs
#   the same, segmentation_free off  46s   worse — trousers became a skirt
#
# The pattern is the garment, not the chaining. A loud all-over print gives pass
# two something to smear, and because pass two's canvas *is* pass one's output
# there is nothing downstream to correct it — errors accumulate across passes
# rather than averaging out. Ordinary clothes chain fine.
MAX_GARMENTS = 2

# Which part of the body a garment occupies, for deciding what can be worn
# together. Keyed by the app's own categories, not FASHN's, because two app
# categories (`tops` and `outerwear`) collapse onto one FASHN category and the
# distinction still matters here: a coat and a shirt both want the upper body,
# so asking for both would mean the second pass simply erasing the first.
BODY_SLOTS = {
    "tops": "upper",
    "outerwear": "upper",
    "bottoms": "lower",
    # Covers both halves at once, which is why it cannot be combined with
    # anything: a kameez and a pair of trousers is not a two-piece outfit, it is
    # one garment fighting another for the same pixels.
    "dresses": "whole",
}

# The order passes run in, lower body first.
#
# The last pass is the one drawn freshest, and at the waist the top overlaps the
# bottom — a shirt falls over a waistband, not under it. Running tops last lets
# that overlap render naturally instead of having trousers drawn on top of a
# shirt that was already placed.
SLOT_ORDER = ["lower", "upper", "whole"]

# The speed/quality trade, and the reason to be on this model at all.
#
# `balanced` is fal's default. `quality` is set here because the complaint that
# prompted the swap was accuracy — collars and buttons vanishing, prints turning
# to mush — and paying for the slower path is the whole point of having changed
# model. Drop to `balanced` if generations start feeling long; `performance`
# gives up most of what was gained.
MODE = "quality"

# `auto` lets FASHN work out whether the garment picture is a flat-lay or a
# photograph of someone wearing the item, and parse it accordingly.
#
# Left on auto rather than pinned, because both kinds are in play here and the
# app cannot tell them apart: the seed wardrobe mixes hanger shots with editorial
# photographs, clothes imported from your own camera are flat-lays, and a garment
# saved off a shop's website is almost always on a model. Pinning either value
# would quietly ruin the other half.
GARMENT_PHOTO_TYPE = "auto"

# PNG, matching fal's own default. Lossless, and the point of this model is that
# fine detail survives — re-encoding it as JPEG on the way out would be an odd
# way to spend the quality just paid for.
OUTPUT_FORMAT = "png"

# fal's default, and left alone after trying the alternative.
#
# The reasoning for turning it off was sound: mask-free lets the model decide
# where a garment goes rather than confining it to a segmented region, and the
# first chained outfit came back with the shirt's print bleeding down the
# trousers. An explicit mask should have contained that.
#
# It did not. Set to `false`, the same request turned the trousers into a
# knee-length skirt and mangled a foot — worse on shape as well as no better on
# bleed. Recorded here so the next person does not spend the same two
# generations rediscovering it.
SEGMENTATION_FREE = True

# There is no size argument, which is why the `image_size` this file used to
# send is gone rather than renamed.
#
# fal documents the model as rendering at 864x1296. Measured, it does not: two
# runs against a 1024-wide person photograph both came back **1024x1280**, which
# is the person image's own size. So the output tracks the input rather than
# being fixed, and PERSON_EDGE in store/useTryOn.ts is what actually decides the
# resolution the user gets. Worth knowing before trying to raise quality by
# changing something here — the lever is on the app side.

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
# How long a generation takes is partly a measure of how well the photograph
# suits the model. Under CatVTON: a clean studio shot ~11s, an awkward editorial
# crop ~64s, a difficult phone photograph past 100s. FASHN on `quality` is a
# heavier model, so read those as the shape of the relationship rather than
# numbers to expect — but a run pushing this ceiling still says something is
# wrong with the input, which is why the timeout message talks about the
# photograph.
CLIENT_TIMEOUT_S = 240.0

# Past this, say so in the log. Deliberately not tightened for FASHN: `quality`
# mode is slower by design, and a threshold that fires on every healthy run
# teaches you to ignore it.
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


def _fashn_category(category: Optional[str]) -> str:
    """Which of FASHN's three categories this garment belongs to.

    Raises rather than guessing, for both the unknown and the unsupported case.
    The message names the garment, because "shoes cannot be tried on" is
    something the user can act on and "generation failed" is not.
    """
    if not category:
        raise VisionFailed(
            "That piece has no category, so there is nothing to say where it "
            "should sit on the body."
        )

    fashn_category = FASHN_CATEGORIES.get(category)
    if fashn_category is None:
        wearable = ", ".join(FASHN_CATEGORIES)
        raise VisionFailed(
            f"Try-on cannot fit {category} — it dresses {wearable} only. "
            "Pick a different piece."
        )

    return fashn_category


def _ordered_for_chaining(garments: list[dict]) -> list[dict]:
    """Check the outfit is wearable, and put it in the order to render it.

    Every refusal here happens before the network is touched, so an impossible
    combination costs nothing rather than one generation per pass.

    Two rules, and both exist because breaking them still produces an image —
    just a wrong one, paid for, with nothing raising to say so:

    - **One garment per part of the body.** Two tops means the second pass paints
      over the first and the money spent on it disappears. A coat counts as a
      top; FASHN has no outerwear category to layer with.
    - **A one-piece is worn alone.** A kameez already covers the body a pair of
      trousers wants, so the two cannot both survive.
    """
    seen: dict[str, str] = {}

    for garment in garments:
        category = garment.get("category")
        # Raises for an unknown or unwearable category, and names it.
        _fashn_category(category)

        slot = BODY_SLOTS[category]
        if slot in seen:
            raise VisionFailed(
                f"You have picked two things for the same part of the outfit — "
                f"{seen[slot]} and {category}. Choose one of them."
            )
        seen[slot] = category

    if "whole" in seen and len(seen) > 1:
        others = ", ".join(name for slot, name in seen.items() if slot != "whole")
        raise VisionFailed(
            f"A {seen['whole'][:-2]} is a whole outfit on its own, so it cannot "
            f"be worn with {others}. Try it by itself."
        )

    return sorted(garments, key=lambda g: SLOT_ORDER.index(BODY_SLOTS[g["category"]]))


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
        raise VisionFailed(f"The try-on model would not accept that request: {err}") from err

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
    mode: str = MODE,
) -> dict:
    """Dress the person in the outfit. Returns base64 image bytes.

    `garments` is a list of {image, mimeType, name, category}: one piece, or a
    bottom and a top for a whole outfit. `name` is unused — FASHN reads the
    garment out of its photograph and has no text branch to be told what the
    photograph is of.

    **A garment per pass, chained.** The model fits one region at a time, so a
    two-piece outfit is two calls, with the first call's output becoming the
    second call's person. The intermediate is passed on as fal's own URL rather
    than being downloaded and re-uploaded — it is already on their CDN, and
    round-tripping several megabytes through this process to hand it straight
    back would be pure latency.

    Raises the same three exception types as the photo analyser, so the endpoint
    treats a missing key, a quota error and a failure exactly as it already does
    for `/analyse`.
    """
    if not garments:
        raise VisionFailed("No garment was sent to try on")

    if len(garments) > MAX_GARMENTS:
        raise VisionFailed(
            f"Try-on fits {MAX_GARMENTS} pieces at most — one for the top half "
            "and one for the bottom."
        )

    # Everything below refuses before the network is touched, so an impossible
    # outfit or an unreadable image costs nothing.
    ordered = _ordered_for_chaining(garments)
    model_image = _data_uri(person_base64, person_mime_type)
    passes = [
        (
            _fashn_category(garment["category"]),
            _data_uri(garment["image"], garment.get("mimeType", "image/jpeg")),
        )
        for garment in ordered
    ]

    _require_key()

    image: dict = {}
    url: Optional[str] = None
    started = time.monotonic()

    # One budget for the whole request, not one per pass.
    #
    # This matters more than it looks. `CLIENT_TIMEOUT_S` used to be handed
    # straight to a single call; with chaining, passing it per pass would let a
    # two-piece outfit run for twice as long as the app is prepared to wait,
    # which quietly breaks the invariant that the service gives up first and
    # gets to explain why. A deadline keeps that promise whatever the outfit,
    # and a quick first pass hands its unused time to the second rather than
    # wasting it.
    deadline = started + CLIENT_TIMEOUT_S

    for index, (category, garment_image) in enumerate(passes, start=1):
        # Roughly what is being uploaded. Base64 is 4 bytes per 3, and a payload
        # far larger than expected means the app's resize did not happen — worth
        # seeing before blaming the model for being slow. From the second pass on
        # the person is a URL, not bytes, so only the garment counts.
        payload_kb = (len(model_image) + len(garment_image)) * 3 // 4 // 1024
        log.info(
            "try-on: pass %d/%d — %s, mode=%s, ~%d KB up",
            index,
            len(passes),
            category,
            mode,
            payload_kb,
        )

        pass_started = time.monotonic()
        remaining = deadline - pass_started

        if remaining <= 0:
            # The budget went on an earlier pass. Raised through _raise_for so
            # it reads as the same failure a single slow pass would give.
            _raise_for(TimeoutError(f"no time left after pass {index - 1}"))

        try:
            result = fal_client.subscribe(
                MODEL,
                arguments={
                    "model_image": model_image,
                    "garment_image": garment_image,
                    "category": category,
                    "mode": mode,
                    "garment_photo_type": GARMENT_PHOTO_TYPE,
                    "output_format": OUTPUT_FORMAT,
                    "segmentation_free": SEGMENTATION_FREE,
                },
                client_timeout=remaining,
            )
        except Exception as err:  # noqa: BLE001 — see _raise_for on why not by type
            # Logged before it is translated, because the elapsed time and which
            # pass failed are most of the diagnosis and _raise_for is about to
            # discard both. A generation that ran for minutes and a key rejected
            # in 200ms both arrive at the app as one 502.
            log.warning(
                "try-on: pass %d/%d failed after %.1fs — %s",
                index,
                len(passes),
                time.monotonic() - pass_started,
                err,
            )
            _raise_for(err)

        # `images`, plural and a list — FASHN can return several when
        # `num_samples` is raised. CatVTON answered with a single `image` object,
        # and reading that shape here yields None rather than raising, so the
        # mistake would surface as "finished without producing an image" on every
        # call. One sample is requested, so the first is the only one.
        images = (result or {}).get("images") or []
        image = images[0] if images and isinstance(images[0], dict) else {}
        url = image.get("url")

        if not url:
            # A queued job that finishes without an image. Rare, and not
            # something the user can fix by choosing a different photograph — so
            # do not tell them to.
            raise VisionFailed(
                "The try-on model finished without producing an image. Try again."
            )

        log.info(
            "try-on: pass %d/%d done in %.1fs", index, len(passes), time.monotonic() - pass_started
        )

        # The person for the next pass is this pass's result. Handing fal back
        # its own URL keeps the image on their side of the network.
        model_image = url

    elapsed = time.monotonic() - started
    log.info("try-on: %d pass(es) in %.1fs total", len(passes), elapsed)

    if elapsed > SLOW_GENERATION_S * len(passes):
        # Scaled by the number of passes, so a two-piece outfit is not reported
        # as slow purely for being two generations. See the note on
        # CLIENT_TIMEOUT_S: slow has correlated with poor.
        log.warning(
            "try-on: %.1fs across %d pass(es) is slow — the photograph is "
            "probably hard for the model, and the result may be poor",
            elapsed,
            len(passes),
        )

    return _download(url, fallback_mime=image.get("content_type"))


__all__ = [
    "generate_try_on",
    "VisionFailed",
    "VisionRateLimited",
    "VisionUnavailable",
    "MAX_GARMENTS",
    "FASHN_CATEGORIES",
]
