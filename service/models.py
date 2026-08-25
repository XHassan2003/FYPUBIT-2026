"""Request and response shapes.

The field aliases matter: the React Native app sends and expects camelCase
(`colorName`, `includeAccessories`), because that is what `WardrobeItem` in
data/mockWardrobe.ts looks like. Python keeps snake_case internally and Pydantic
translates at the boundary, so neither side has to bend to the other.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WardrobeItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    brand: Optional[str] = None
    category: str
    color: str
    color_name: str = Field(alias="colorName")
    occasions: list[str]
    image: Optional[str] = None
    favorite: Optional[bool] = None


class SeasonPayload(BaseModel):
    """The season the app derived from the colour quiz.

    Sent with every request rather than duplicated here on purpose. The palettes
    live in data/colorSeasons.ts, and a second copy in Python would be one more
    pair of files to keep in step — the trap COLOR_PAIRINGS in rules.py is
    already stuck in.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: Optional[str] = None
    palette: list[str]
    compatible_color_names: list[str] = Field(default_factory=list, alias="compatibleColorNames")


class RecommendRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[WardrobeItem]
    occasion: str
    include_accessories: bool = Field(default=True, alias="includeAccessories")
    # Optional because the user may not have taken the colour quiz yet, and
    # because an older build of the app will not send it. `build_outfit` does
    # not read it yet — see the note there.
    season: Optional[SeasonPayload] = None


class MatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item: WardrobeItem
    season: SeasonPayload


class MatchResponse(BaseModel):
    """What the app's `MatchResult` needs, plus the workings behind it."""

    model_config = ConfigDict(populate_by_name=True)

    is_match: bool = Field(alias="isMatch")
    score: int
    # Kept in the response because "87%" means nothing on its own — the distance
    # and the colour it was measured against are what make the score defensible.
    delta_e: float = Field(alias="deltaE")
    nearest_color: str = Field(alias="nearestColor")
