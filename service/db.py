"""Wardrobe persistence — the one place SQLModel/SQLAlchemy is set up.

`DATABASE_URL` is read lazily, on first use, exactly like `GEMINI_API_KEY` and
`FAL_KEY` elsewhere in this service. That matters here more than there: the
four endpoints that came before this file have nothing to do with the
database, and must keep working on a service nobody has pointed at Supabase
yet. So a missing `DATABASE_URL` turns into a 503 from `/wardrobe` and
`/wardrobe/images` alone, never a crash at import or startup.
"""

import logging
import os
from typing import Iterator

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

import db_models  # noqa: F401 — import registers Wardrobe with SQLModel.metadata

logger = logging.getLogger(__name__)

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise HTTPException(
                status_code=503,
                detail="Wardrobe sync is not set up — the service needs DATABASE_URL. See .env.example.",
            )
        _engine = create_engine(url, pool_pre_ping=True)
    return _engine


def init_db() -> None:
    """Create the wardrobes table if DATABASE_URL is configured.

    A no-op, not a crash, when it is not — called once from main.py's
    startup, and the other four endpoints must survive it either way.
    """
    if not os.environ.get("DATABASE_URL"):
        logger.info("DATABASE_URL not set — /wardrobe and /wardrobe/images will return 503 until it is.")
        return
    SQLModel.metadata.create_all(_get_engine())


def get_session() -> Iterator[Session]:
    """FastAPI dependency: a session, or the 503 from _get_engine()."""
    with Session(_get_engine()) as session:
        yield session
