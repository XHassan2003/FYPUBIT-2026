"""Virtual try-on.

Nothing here calls Gemini, and that is deliberate beyond the usual reasons:
image generation is the most expensive thing this project does, and a test
suite that quietly spent quota on every run would be a trap.

Two of the guards below refuse before the client is ever built, so they cannot
reach the network. Any test that gets past them must stub `tryon._client` — see
`test_the_limit_itself_is_allowed_through` for what happens otherwise.

If this file ever starts taking seconds rather than milliseconds, something in
it is talking to Google.
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from tryon import MAX_GARMENTS, _label, generate_try_on
from vision import VisionFailed, VisionRateLimited, VisionUnavailable

client = TestClient(app)


def garment(name="Wool Overcoat", category="outerwear"):
    return {"image": "ZmFrZQ==", "mimeType": "image/jpeg", "name": name, "category": category}


# --- guarding the call -----------------------------------------------------


def test_an_outfit_with_no_garments_is_refused():
    with pytest.raises(VisionFailed, match="No garments"):
        generate_try_on("ZmFrZQ==", "image/jpeg", [])


def test_too_many_garments_is_refused_before_spending_anything():
    """The model starts dropping pieces rather than layering them, and finding
    that out costs a generation. Cheaper to say no."""
    with pytest.raises(VisionFailed, match="Too many garments"):
        generate_try_on("ZmFrZQ==", "image/jpeg", [garment() for _ in range(MAX_GARMENTS + 1)])


def test_the_limit_itself_is_allowed_through(monkeypatch):
    """Exactly at the cap must not be refused — off-by-one here would be silent.

    `_client` is stubbed because this test deliberately gets past the count
    check, which is the only thing standing between it and a real generation.
    Without the stub it spends quota on every run: the first version of this
    test did exactly that, and the giveaway was the suite jumping from under
    two seconds to seven.
    """
    monkeypatch.setattr("tryon._client", lambda: (_ for _ in ()).throw(VisionUnavailable("stubbed")))

    with pytest.raises(VisionUnavailable):
        generate_try_on("ZmFrZQ==", "image/jpeg", [garment() for _ in range(MAX_GARMENTS)])


# --- labelling the references ----------------------------------------------


def test_a_garment_is_labelled_with_what_it_is():
    assert _label(1, "Wool Overcoat", "outerwear") == "Garment 1 (outerwear — Wool Overcoat):"


def test_a_garment_with_no_details_still_gets_a_number():
    assert _label(2, None, None) == "Garment 2:"


def test_a_partial_description_does_not_leave_a_dangling_dash():
    assert _label(3, "Ankle Boots", None) == "Garment 3 (Ankle Boots):"
    assert _label(4, None, "shoes") == "Garment 4 (shoes):"


# --- the endpoint ----------------------------------------------------------


def post_try_on(**overrides):
    body = {
        "person": "ZmFrZQ==",
        "personMimeType": "image/jpeg",
        "garments": [garment()],
        **overrides,
    }
    return client.post("/try-on", json=body)


def test_a_generated_image_comes_back_camel_cased(monkeypatch):
    monkeypatch.setattr(
        "main.generate_try_on", lambda **_: {"image": "Z2VuZXJhdGVk", "mimeType": "image/jpeg"}
    )
    body = post_try_on().json()

    assert body["image"] == "Z2VuZXJhdGVk"
    assert body["mimeType"] == "image/jpeg"


def test_missing_api_key_is_a_503(monkeypatch):
    def unavailable(**_):
        raise VisionUnavailable("GEMINI_API_KEY is not set.")

    monkeypatch.setattr("main.generate_try_on", unavailable)
    assert post_try_on().status_code == 503


def test_rate_limiting_is_a_429(monkeypatch):
    def limited(**_):
        raise VisionRateLimited("busy")

    monkeypatch.setattr("main.generate_try_on", limited)
    assert post_try_on().status_code == 429


def test_a_refused_photo_is_a_502_with_something_to_act_on(monkeypatch):
    """The model can decline and answer in text. The message usually says what
    to change about the photo, so it is worth passing through."""

    def refused(**_):
        raise VisionFailed("Gemini did not return an image for that photo. Try a clearer photograph.")

    monkeypatch.setattr("main.generate_try_on", refused)
    response = post_try_on()

    assert response.status_code == 502
    assert "clearer" in response.json()["detail"]


def test_a_person_is_required():
    response = client.post("/try-on", json={"garments": [garment()]})
    assert response.status_code == 422


def test_the_other_endpoints_are_untouched():
    assert client.get("/health").status_code == 200
