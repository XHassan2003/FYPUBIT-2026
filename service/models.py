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


class RecommendRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[WardrobeItem]
    occasion: str
    include_accessories: bool = Field(default=True, alias="includeAccessories")
