"""AI Personal Stylist — recommendation service.

One endpoint, deliberately. `POST /recommend` accepts the user's wardrobe and an
occasion, and returns the pieces that make up a look. The response shape is
exactly what `suggestOutfit()` in store/useWardrobe.ts already returns, so
swapping the app over is a one-function change.

Run it:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from color import score_item_against_season
from models import MatchRequest, MatchResponse, RecommendRequest, WardrobeItem
from rules import build_outfit

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
