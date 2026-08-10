"""AI Personal Stylist — recommendation service.

One endpoint, deliberately. `POST /recommend` accepts the user's wardrobe and an
occasion, and returns the pieces that make up a look. The response shape is
exactly what `suggestOutfit()` in store/useWardrobe.ts already returns, so
swapping the app over is a one-function change.

Run it:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import RecommendRequest, WardrobeItem
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
