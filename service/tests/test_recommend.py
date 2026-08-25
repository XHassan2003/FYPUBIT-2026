"""The /recommend endpoint and its request contract.

`build_outfit` is still the placeholder, so these do not test styling quality —
there is none to test. They pin the contract instead: the shapes the app sends,
the shape it gets back, and that the newly added `season` field is accepted
without changing anything yet.
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

WINTER = {
    "id": "winter",
    "name": "True Winter",
    "palette": ["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"],
    "compatibleColorNames": ["black", "white", "indigo", "charcoal", "plum", "grey"],
}

WARDROBE = [
    {"id": "top-1", "name": "Oxford Shirt", "category": "tops", "color": "#FFFFFF",
     "colorName": "white", "occasions": ["work", "formal"]},
    {"id": "top-2", "name": "Crewneck Tee", "category": "tops", "color": "#1C1B19",
     "colorName": "black", "occasions": ["casual"]},
    {"id": "bottom-1", "name": "Tailored Trousers", "category": "bottoms", "color": "#3A3A3A",
     "colorName": "charcoal", "occasions": ["work", "formal"]},
    {"id": "shoe-1", "name": "Leather Loafers", "category": "shoes", "color": "#2B2420",
     "colorName": "black", "occasions": ["work", "formal"]},
    {"id": "outer-1", "name": "Wool Coat", "category": "outerwear", "color": "#B08968",
     "colorName": "camel", "occasions": ["work", "formal"]},
    {"id": "acc-1", "name": "Leather Belt", "category": "accessories", "color": "#6B4A32",
     "colorName": "brown", "occasions": ["work"]},
]


def post_recommend(body: dict):
    return client.post("/recommend", json=body)


def test_returns_a_subset_of_what_was_sent():
    response = post_recommend({"items": WARDROBE, "occasion": "work"})
    assert response.status_code == 200

    sent = {item["id"] for item in WARDROBE}
    got = [item["id"] for item in response.json()]

    assert got, "an outfit should not be empty for a wardrobe this complete"
    assert set(got) <= sent
    assert len(got) == len(set(got)), "the same garment must not appear twice"


def test_response_keeps_the_camel_case_the_app_expects():
    body = post_recommend({"items": WARDROBE, "occasion": "work"}).json()
    assert all("colorName" in item for item in body)


def test_outfit_is_ordered_top_bottom_shoes():
    """Wearing order is part of the contract — the app renders it as given."""
    by_id = {item["id"]: item for item in WARDROBE}
    categories = [by_id[item["id"]]["category"] for item in post_recommend(
        {"items": WARDROBE, "occasion": "work"}
    ).json()]

    assert categories[:3] == ["tops", "bottoms", "shoes"]


def test_accessories_can_be_excluded():
    for _ in range(10):
        body = post_recommend(
            {"items": WARDROBE, "occasion": "work", "includeAccessories": False}
        ).json()
        assert all(item["id"] != "acc-1" for item in body)


def test_season_is_accepted():
    response = post_recommend({"items": WARDROBE, "occasion": "work", "season": WINTER})
    assert response.status_code == 200


def test_season_is_optional():
    """An older build of the app does not send it, and the quiz may be untaken."""
    assert post_recommend({"items": WARDROBE, "occasion": "work"}).status_code == 200
    assert post_recommend(
        {"items": WARDROBE, "occasion": "work", "season": None}
    ).status_code == 200


def test_empty_wardrobe_returns_an_empty_outfit():
    response = post_recommend({"items": [], "occasion": "work"})
    assert response.status_code == 200
    assert response.json() == []
