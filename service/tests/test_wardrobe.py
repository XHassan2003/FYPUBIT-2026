"""GET/PUT /wardrobe and POST /wardrobe/images — the sync contract.

Auth and the database are both swapped for stand-ins here: a header-based
fake user id instead of a verified Clerk token (real verification is
test_auth.py's job), and an in-memory SQLite engine instead of Supabase's
Postgres. What these tests pin is the contract — whose wardrobe comes back,
and what a first sync versus a second one look like — not the database
engine or the identity provider.
"""

from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import auth
import db
import storage
from main import app

# StaticPool matters here: a plain sqlite:///:memory: engine hands out a new,
# empty in-memory database on every pooled connection, so create_all() and
# the requests below would silently talk to different databases without it.
_test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
SQLModel.metadata.create_all(_test_engine)


def _fake_session():
    with Session(_test_engine) as session:
        yield session


def _fake_user(request: Request) -> str:
    user_id = request.headers.get("X-Test-User")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return user_id


app.dependency_overrides[db.get_session] = _fake_session
app.dependency_overrides[auth.get_current_user_id] = _fake_user

client = TestClient(app)

WARDROBE = {
    "items": [
        {
            "id": "top-1",
            "name": "Oxford Shirt",
            "category": "tops",
            "color": "#FFFFFF",
            "colorName": "white",
            "occasions": ["work"],
        }
    ],
    "outfits": [],
    "profile": {
        "name": "Hassan",
        "avatarColor": "#15120E",
        "styleTags": [],
        "measurements": {"height": "", "chest": "", "waist": "", "hips": "", "shoeSize": ""},
        "preferences": {"notifications": True, "useMetric": False, "includeAccessories": True},
    },
}


def test_missing_token_is_401():
    assert client.get("/wardrobe").status_code == 401


def test_unseen_user_gets_404():
    response = client.get("/wardrobe", headers={"X-Test-User": "user_never_synced"})
    assert response.status_code == 404


def test_put_then_get_round_trips():
    headers = {"X-Test-User": "user_round_trip"}
    assert client.put("/wardrobe", json=WARDROBE, headers=headers).status_code == 204

    body = client.get("/wardrobe", headers=headers).json()
    assert body["items"][0]["id"] == "top-1"
    assert body["profile"]["name"] == "Hassan"


def test_put_again_replaces_rather_than_appends():
    headers = {"X-Test-User": "user_replace"}
    client.put("/wardrobe", json=WARDROBE, headers=headers)

    second = {**WARDROBE, "items": []}
    client.put("/wardrobe", json=second, headers=headers)

    assert client.get("/wardrobe", headers=headers).json()["items"] == []


def test_two_accounts_do_not_see_each_others_wardrobe():
    client.put("/wardrobe", json=WARDROBE, headers={"X-Test-User": "user_a"})

    assert client.get("/wardrobe", headers={"X-Test-User": "user_b"}).status_code == 404


def test_upload_image_returns_a_url(monkeypatch):
    monkeypatch.setattr(
        storage, "upload_photo", lambda user_id, data, content_type: "https://example.invalid/photo.jpg"
    )

    response = client.post(
        "/wardrobe/images",
        headers={"X-Test-User": "user_a"},
        files={"file": ("shirt.jpg", b"fake-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["url"] == "https://example.invalid/photo.jpg"
