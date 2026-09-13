"""The one database table this service has.

Deliberately not normalized into separate item/outfit/profile tables: the
client's shape (`WardrobeItem`, `Outfit`, `Profile` in store/useWardrobe.ts)
is still evolving additively — `Outfit.previewImage` was added with no
version bump — and a JSON column absorbs that kind of change with zero
migrations. This mirrors what zustand's `persist` already does on the app
side: `items`, `outfits` and `profile` are written and read together as one
unit, not three independent records.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Wardrobe(SQLModel, table=True):
    """One row per Clerk account.

    `user_id` is the JWT `sub` claim verified in auth.py — never a value
    trusted from a request body. `updated_at` is informational only; there
    is no field-by-field merge or conflict resolution anywhere in this
    service, so it is not read by anything, only written.
    """

    __tablename__ = "wardrobes"

    user_id: str = Field(primary_key=True)
    items: list[dict[str, Any]] = Field(sa_column=Column(JSON, nullable=False))
    outfits: list[dict[str, Any]] = Field(sa_column=Column(JSON, nullable=False))
    profile: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
