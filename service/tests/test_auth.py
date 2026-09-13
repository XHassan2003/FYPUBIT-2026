"""get_current_user_id — the one thing every /wardrobe request goes through.

No real Clerk JWKS endpoint is touched: `auth._client` is monkeypatched to
serve a throwaway keypair's public half the way a real JWKS lookup would.
What is being tested is the verification logic itself — signature, issuer,
the missing-token case — not Clerk's infrastructure.
"""

from types import SimpleNamespace

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

import auth

ISSUER = "https://example.invalid"


class _StubRequest:
    def __init__(self, headers: dict[str, str]):
        self.headers = headers


@pytest.fixture(autouse=True)
def clerk_issuer(monkeypatch):
    monkeypatch.setenv("CLERK_ISSUER", ISSUER)


def _stub_client(public_key):
    return SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=public_key))


def test_missing_bearer_header_is_401():
    with pytest.raises(HTTPException) as excinfo:
        auth.get_current_user_id(_StubRequest({}))
    assert excinfo.value.status_code == 401


def test_non_bearer_header_is_401():
    with pytest.raises(HTTPException) as excinfo:
        auth.get_current_user_id(_StubRequest({"Authorization": "Basic dXNlcjpwYXNz"}))
    assert excinfo.value.status_code == 401


def test_valid_token_returns_the_subject_claim(monkeypatch, keypair):
    token = pyjwt.encode({"sub": "user_abc", "iss": ISSUER}, keypair, algorithm="RS256")
    monkeypatch.setattr(auth, "_client", lambda: _stub_client(keypair.public_key()))

    assert auth.get_current_user_id(_StubRequest({"Authorization": f"Bearer {token}"})) == "user_abc"


def test_token_signed_by_a_different_key_is_401(monkeypatch, keypair):
    imposter_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = pyjwt.encode({"sub": "user_abc", "iss": ISSUER}, imposter_key, algorithm="RS256")
    monkeypatch.setattr(auth, "_client", lambda: _stub_client(keypair.public_key()))

    with pytest.raises(HTTPException) as excinfo:
        auth.get_current_user_id(_StubRequest({"Authorization": f"Bearer {token}"}))
    assert excinfo.value.status_code == 401


def test_wrong_issuer_is_401(monkeypatch, keypair):
    token = pyjwt.encode({"sub": "user_abc", "iss": "https://someone-else.invalid"}, keypair, algorithm="RS256")
    monkeypatch.setattr(auth, "_client", lambda: _stub_client(keypair.public_key()))

    with pytest.raises(HTTPException) as excinfo:
        auth.get_current_user_id(_StubRequest({"Authorization": f"Bearer {token}"}))
    assert excinfo.value.status_code == 401


def test_missing_clerk_issuer_env_is_503(monkeypatch, keypair):
    monkeypatch.delenv("CLERK_ISSUER", raising=False)
    token = pyjwt.encode({"sub": "user_abc", "iss": ISSUER}, keypair, algorithm="RS256")

    with pytest.raises(HTTPException) as excinfo:
        auth.get_current_user_id(_StubRequest({"Authorization": f"Bearer {token}"}))
    assert excinfo.value.status_code == 503
