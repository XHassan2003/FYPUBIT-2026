"""The /match endpoint, over the real request/response shapes.

These use the app's actual season data and real garments from
data/mockWardrobe.ts, so a change to the camelCase aliases or the response shape
fails here rather than silently on a phone.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

WINTER = {
    "id": "winter",
    "name": "True Winter",
    "palette": ["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"],
    "compatibleColorNames": ["black", "white", "indigo", "charcoal", "plum", "grey"],
}
AUTUMN = {
    "id": "autumn",
    "name": "Warm Autumn",
    "palette": ["#B08968", "#6B6E4E", "#6B4A32", "#B98B3E", "#D8D2C4", "#A9784F"],
    "compatibleColorNames": ["camel", "olive", "brown", "gold", "stone", "tan"],
}


def item(color: str, color_name: str, name: str = "Test piece") -> dict:
    return {
        "id": "test-1",
        "name": name,
        "category": "tops",
        "color": color,
        "colorName": color_name,
        "occasions": ["work"],
    }


def post_match(body: dict):
    return client.post("/match", json=body)


def test_health_still_answers():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_match_returns_camel_case_for_the_app():
    response = post_match({"item": item("#1C1B19", "black"), "season": WINTER})
    assert response.status_code == 200
    assert set(response.json()) == {"isMatch", "score", "deltaE", "nearestColor"}


def test_garment_in_the_palette_matches():
    response = post_match({"item": item("#3B4A6B", "indigo", "Denim Jeans"), "season": WINTER})
    body = response.json()

    assert body["isMatch"] is True
    assert body["score"] == 100
    assert body["deltaE"] == pytest.approx(0.0)
    assert body["nearestColor"] == "#3B4A6B"


def test_garment_against_the_wrong_season_does_not_match():
    response = post_match({"item": item("#B98B3E", "gold", "Gold Hoops"), "season": WINTER})
    body = response.json()

    assert body["isMatch"] is False
    assert body["score"] < 70
    assert body["deltaE"] > 10


def test_the_same_garment_can_match_one_season_and_not_another():
    camel = item("#B08968", "camel", "Wool Coat")

    assert post_match({"item": camel, "season": AUTUMN}).json()["isMatch"] is True
    assert post_match({"item": camel, "season": WINTER}).json()["isMatch"] is False


def test_scoring_is_deterministic():
    body = {"item": item("#8A9A80", "sage"), "season": AUTUMN}
    first, second = post_match(body).json(), post_match(body).json()
    assert first == second


def test_unreadable_garment_colour_is_a_422():
    response = post_match({"item": item("not-a-colour", "white"), "season": WINTER})
    assert response.status_code == 422


def test_empty_palette_is_a_422():
    empty = {"id": "winter", "palette": [], "compatibleColorNames": []}
    response = post_match({"item": item("#FFFFFF", "white"), "season": empty})
    assert response.status_code == 422


def test_season_name_is_optional():
    season = {k: v for k, v in WINTER.items() if k != "name"}
    assert post_match({"item": item("#FFFFFF", "white"), "season": season}).status_code == 200


def test_missing_season_is_rejected():
    assert client.post("/match", json={"item": item("#FFFFFF", "white")}).status_code == 422
