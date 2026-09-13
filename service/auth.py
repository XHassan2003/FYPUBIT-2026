"""Verifies who is calling — every wardrobe endpoint depends on this and
nothing else for the user id it writes against.

Clerk session tokens are RS256-signed, so verifying one only needs the
public JWKS document, never Clerk's secret key. `CLERK_JWKS_URL` and
`CLERK_ISSUER` come from the Clerk dashboard — see .env.example. Both are
read lazily, the same way GEMINI_API_KEY and FAL_KEY are elsewhere in this
service, so a service nobody has configured Clerk verification for yet fails
per-request with a 503 rather than at import or startup.
"""

import logging
import os

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None


def _client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = os.environ.get("CLERK_JWKS_URL")
        if not url:
            raise HTTPException(
                status_code=503,
                detail="Wardrobe sync is not set up — the service needs CLERK_JWKS_URL. See .env.example.",
            )
        _jwks_client = PyJWKClient(url)
    return _jwks_client


def get_current_user_id(request: Request) -> str:
    """FastAPI dependency: the verified Clerk user id, or a 401.

    Never trust a user id from a request body — GET/PUT /wardrobe and
    POST /wardrobe/images all read it from here instead, off a token only
    the signed-in user's own device could have produced.
    """
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = header.removeprefix("Bearer ")

    issuer = os.environ.get("CLERK_ISSUER")
    if not issuer:
        raise HTTPException(
            status_code=503,
            detail="Wardrobe sync is not set up — the service needs CLERK_ISSUER. See .env.example.",
        )

    try:
        signing_key = _client().get_signing_key_from_jwt(token)
        # Clerk session tokens do not carry a stable `aud`, so this checks
        # signature, expiry and issuer — not audience. `sub` is the thing
        # every /wardrobe request is partitioned by, so it is the one claim
        # that matters once the token is confirmed genuine.
        #
        # `leeway` matters in practice, not just in theory: a dev machine's
        # clock a few seconds behind Clerk's made every token look "not yet
        # valid" (`iat` in the future) despite being freshly issued and
        # genuinely signed — this is standard tolerance for clock drift
        # between two different machines, not a weakening of the check.
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            leeway=30,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as err:
        # The 401 the client sees is deliberately generic — but the terminal
        # running this service is not a hostile audience, so it gets the real
        # reason: a wrong CLERK_ISSUER and an actually-expired session both
        # collapse to the same response otherwise, and they need opposite fixes.
        logger.warning("Rejected a wardrobe request's token: %s: %s", type(err).__name__, err)
        raise HTTPException(status_code=401, detail="Invalid or expired session") from err

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token has no subject")
    return user_id
