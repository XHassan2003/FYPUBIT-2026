"""Uploads a garment photo to Supabase Storage and hands back its public URL.

The backend authenticates with the project's service-role key, not a
per-user Supabase session — auth.py's verified Clerk token is what already
proves who is uploading, so nothing here re-derives that. Keep this the only
file in the service that touches Supabase Storage.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read lazily, like every
other credential in this service, so /recommend, /match, /analyse and
/try-on keep working on a service nobody has set this up for yet.
"""

import os
import uuid

from fastapi import HTTPException

_BUCKET = "wardrobe-photos"

_client = None


def _storage():
    global _client
    if _client is None:
        from supabase import create_client

        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Photo upload is not set up — the service needs SUPABASE_URL and "
                    "SUPABASE_SERVICE_ROLE_KEY. See .env.example."
                ),
            )
        _client = create_client(url, key)
    return _client.storage.from_(_BUCKET)


def upload_photo(user_id: str, data: bytes, content_type: str) -> str:
    """Store one photo under its owner's id and return a URL anyone can load it from.

    The bucket is public and the filename is an unguessable uuid4 — the same
    trade this project already makes for the sake of staying a two-terminal
    dev setup rather than a hosted service with its own secrets manager.
    Good enough for a submitted project, not for a real product; see the
    README's "Known gaps".
    """
    extension = (content_type.split("/")[-1] or "jpg").split(";")[0]
    path = f"{user_id}/{uuid.uuid4()}.{extension}"

    bucket = _storage()
    bucket.upload(path, data, {"content-type": content_type})
    return bucket.get_public_url(path)
