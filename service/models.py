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


class Swatch(BaseModel):
    hex: str
    name: str


class AnalyseRequest(BaseModel):
    """A photo, plus the vocabulary the app can actually accept back.

    Categories, occasions and swatches travel with the request for the same
    reason the seasonal palettes do: the app owns them, and a second copy here
    would be one more pair of files to keep in step.
    """

    model_config = ConfigDict(populate_by_name=True)

    image: str = Field(description="Base64-encoded image bytes, no data: prefix")
    mime_type: str = Field(default="image/jpeg", alias="mimeType")
    categories: list[str]
    occasions: list[str]
    swatches: list[Swatch]


class AnalyseResponse(BaseModel):
    """What Add Piece needs to fill itself in.

    Every field is optional. A model that cannot tell what colour something is
    should leave the picker alone, not guess — an empty field costs one tap,
    a wrong one costs trust.
    """

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    occasions: list[str] = Field(default_factory=list)
    # The swatch the app should select, after snapping.
    color: Optional[str] = None
    color_name: Optional[str] = Field(default=None, alias="colorName")
    # What Gemini actually saw, and how far that was from the chosen swatch.
    # Same reasoning as /match: the workings make the answer checkable.
    detected_color: Optional[str] = Field(default=None, alias="detectedColor")
    delta_e: Optional[float] = Field(default=None, alias="deltaE")


class GarmentImage(BaseModel):
    """One piece of the outfit, as a picture plus what it is.

    The label matters: telling the model which reference is the coat and which
    is the shoes produces a better-layered result than handing it a pile of
    unnamed images.
    """

    model_config = ConfigDict(populate_by_name=True)

    image: str = Field(description="Base64-encoded image bytes")
    mime_type: str = Field(default="image/jpeg", alias="mimeType")
    name: Optional[str] = None
    category: Optional[str] = None


class TryOnRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    person: str = Field(description="Base64-encoded photo of the wearer")
    person_mime_type: str = Field(default="image/jpeg", alias="personMimeType")
    garments: list[GarmentImage]


class TryOnResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image: str = Field(description="Base64-encoded generated image")
    mime_type: str = Field(default="image/jpeg", alias="mimeType")


class MatchResponse(BaseModel):
    """What the app's `MatchResult` needs, plus the workings behind it."""

    model_config = ConfigDict(populate_by_name=True)

    is_match: bool = Field(alias="isMatch")
    score: int
    # Kept in the response because "87%" means nothing on its own — the distance
    # and the colour it was measured against are what make the score defensible.
    delta_e: float = Field(alias="deltaE")
    nearest_color: str = Field(alias="nearestColor")
