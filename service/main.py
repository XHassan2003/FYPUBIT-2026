"""AI Personal Stylist — recommendation service.

One endpoint, deliberately. `POST /recommend` accepts the user's wardrobe and an
occasion, and returns the pieces that make up a look. The response shape is
exactly what `suggestOutfit()` in store/useWardrobe.ts already returns, so
swapping the app over is a one-function change.

Run it:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from color import score_item_against_season
from errors import VisionFailed, VisionRateLimited, VisionUnavailable
from models import (
    AnalyseRequest,
    AnalyseResponse,
    MatchRequest,
    MatchResponse,
    RecommendRequest,
    TryOnRequest,
    TryOnResponse,
    WardrobeItem,
)
from rules import build_outfit
from tryon import generate_try_on
from vision import analyse_garment

# Before anything reads GEMINI_API_KEY (photo analysis) or FAL_KEY (try-on).
# The path is explicit because npm runs the service from the project root, so
# the working directory is not this one.
load_dotenv(Path(__file__).parent / ".env")

# Give our own loggers somewhere to go.
#
# Not optional, and it was missing. uvicorn configures handlers for its own
# `uvicorn.*` loggers and leaves the root logger bare, so anything logged from
# `tryon.py` propagated up to a root with no handler and was silently dropped.
# The effect was worse than no logging: `/try-on` had timing and per-pass
# instrumentation written into it, the README told people to watch the terminal
# for it, and none of it ever appeared. Discovered by looking for a line that
# should have been there and was not.
#
# `basicConfig` is a no-op if the root logger already has handlers, so this
# cannot fight a host that configured logging itself.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")

# ...and immediately quieten httpx, which turning on INFO logging also switched
# on. It logs a line per request, and fal's client polls the queue roughly twice
# a second, so a single try-on buried its own two timing lines under a hundred
# identical status polls. The point of the logging is that the useful lines are
# findable.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

app = FastAPI(
    title="AI Personal Stylist",
    description="Outfit recommendation service for the stylist app.",
    version="0.1.0",
)

# Wide open because this only ever runs on a laptop during development. Lock the
# origins down before this is deployed anywhere reachable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Cheap endpoint to confirm the phone can actually reach this machine."""
    return {"status": "ok"}


@app.post("/recommend", response_model=list[WardrobeItem])
def recommend(request: RecommendRequest) -> list[WardrobeItem]:
    """Return a head-to-toe look drawn from the user's own wardrobe.

    Currently rule-based (see rules.py). The contract is what matters: whatever
    replaces the body must keep returning a list of the items it was given.
    """
    return build_outfit(
        items=request.items,
        occasion=request.occasion,
        include_accessories=request.include_accessories,
        season=request.season,
    )


@app.post("/match", response_model=MatchResponse)
def match(request: MatchRequest) -> MatchResponse:
    """Score one garment against the user's seasonal palette.

    Unlike /recommend, this is not a placeholder: the score is a real CIEDE2000
    measurement in CIE Lab (see color.py), not the hash of an item id the app
    used to show.
    """
    try:
        outcome = score_item_against_season(
            item_hex=request.item.color,
            item_color_name=request.item.color_name,
            palette=request.season.palette,
            compatible_color_names=request.season.compatible_color_names,
        )
    except ValueError as err:
        # A colour the maths cannot read is a bad request, not a server fault.
        raise HTTPException(status_code=422, detail=str(err)) from err

    return MatchResponse(
        isMatch=outcome.is_match,
        score=outcome.score,
        deltaE=outcome.delta_e,
        nearestColor=outcome.nearest_color,
    )


@app.post("/analyse", response_model=AnalyseResponse)
def analyse(request: AnalyseRequest) -> AnalyseResponse:
    """Read a garment from a photo so Add Piece can fill itself in.

    Gemini identifies the garment and its true colour; `color.py` decides which
    of the app's swatches that colour is. Fields the model could not determine
    come back null, and the form leaves them for the user.
    """
    try:
        garment = analyse_garment(
            image_base64=request.image,
            mime_type=request.mime_type,
            categories=request.categories,
            occasions=request.occasions,
            swatches=[swatch.model_dump() for swatch in request.swatches],
        )
    except VisionUnavailable as err:
        # Missing configuration, not a failed request — 503 so the app can say
        # "not set up" rather than "try again".
        raise HTTPException(status_code=503, detail=str(err)) from err
    except VisionRateLimited as err:
        # Passed straight through as 429. The photo and the request were both
        # fine, and the same request will work later — telling someone to try a
        # different photo would send them fixing the wrong thing.
        raise HTTPException(status_code=429, detail=str(err)) from err
    except VisionFailed as err:
        raise HTTPException(status_code=502, detail=str(err)) from err

    return AnalyseResponse(
        name=garment["name"],
        brand=garment["brand"],
        category=garment["category"],
        occasions=garment["occasions"],
        color=garment["color"],
        colorName=garment["colorName"],
        detectedColor=garment["detectedColor"],
        deltaE=garment["deltaE"],
    )


@app.post("/try-on", response_model=TryOnResponse)
def try_on(request: TryOnRequest) -> TryOnResponse:
    """Fit the wearer's chosen garment onto their photograph.

    FASHN v1.6, hosted on fal — see tryon.py. Slower and dearer than the other
    endpoints because it runs a diffusion model rather than reading an image,
    so the app gives it a much longer budget and says what it is doing while it
    waits.

    One garment per request. The model fits a single masked region and has no
    multi-garment mode, so `garments` is a list of one; sending more is refused
    before anything is spent.
    """
    try:
        result = generate_try_on(
            person_base64=request.person,
            person_mime_type=request.person_mime_type,
            garments=[garment.model_dump(by_alias=True) for garment in request.garments],
        )
    except VisionUnavailable as err:
        raise HTTPException(status_code=503, detail=str(err)) from err
    except VisionRateLimited as err:
        raise HTTPException(status_code=429, detail=str(err)) from err
    except VisionFailed as err:
        raise HTTPException(status_code=502, detail=str(err)) from err

    return TryOnResponse(image=result["image"], mimeType=result["mimeType"])
