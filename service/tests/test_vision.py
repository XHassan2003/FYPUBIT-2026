"""Garment photo analysis.

No test here calls Gemini. What is worth testing is everything around it: that
a model's answer is checked against what the app can accept, that the colour is
snapped by our own maths rather than taken on trust, and that a field the model
got wrong is dropped instead of passed on. Those are the parts that decide
whether a wrong answer reaches the user's wardrobe.

The endpoint tests stub the vision call, so the suite stays offline, free and
deterministic.
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from vision import VisionFailed, VisionRateLimited, VisionUnavailable, _raise_for, _to_garment

client = TestClient(app)

CATEGORIES = ["tops", "bottoms", "outerwear", "shoes", "accessories"]
OCCASIONS = ["work", "casual", "date night", "workout", "formal"]
SWATCHES = [
    {"hex": "#FFFFFF", "name": "white"},
    {"hex": "#F1E9DA", "name": "cream"},
    {"hex": "#D8D2C4", "name": "stone"},
    {"hex": "#8A9A80", "name": "sage"},
    {"hex": "#6B6E4E", "name": "olive"},
    {"hex": "#B08968", "name": "camel"},
    {"hex": "#A9784F", "name": "tan"},
    {"hex": "#3B4A6B", "name": "indigo"},
    {"hex": "#3A3A3A", "name": "charcoal"},
    {"hex": "#1C1B19", "name": "black"},
]


def read(**overrides):
    """A well-formed model answer, with fields overridden per test."""
    return {
        "name": "Wool Overcoat",
        "brand": "Hartley Row",
        "category": "outerwear",
        "dominantColor": "#B08968",
        "occasions": ["work", "formal"],
        **overrides,
    }


def convert(reading):
    return _to_garment(reading, CATEGORIES, OCCASIONS, SWATCHES)


# --- colour snapping -------------------------------------------------------


def test_exact_swatch_snaps_to_itself():
    garment = convert(read(dominantColor="#B08968"))

    assert garment["color"] == "#B08968"
    assert garment["colorName"] == "camel"
    assert garment["deltaE"] == pytest.approx(0.0)


def test_a_near_colour_snaps_to_the_closest_swatch():
    """The model rarely returns a colour that is exactly one of ours."""
    garment = convert(read(dominantColor="#AD8564"))

    assert garment["colorName"] == "camel"
    assert 0 < garment["deltaE"] < 10


def test_the_colour_the_model_saw_is_reported_alongside():
    """The workings, as with /match — "camel" is checkable against the original."""
    garment = convert(read(dominantColor="#AD8564"))
    assert garment["detectedColor"] == "#AD8564"


def test_snapping_is_by_perceptual_distance_not_string_similarity():
    """A dark navy should become indigo, not black, however the hex reads."""
    garment = convert(read(dominantColor="#3C4C6E"))
    assert garment["colorName"] == "indigo"


@pytest.mark.parametrize("bad", ["not-a-colour", "", "#12345", "rgb(1,2,3)", None, 42])
def test_an_unreadable_colour_is_dropped_not_guessed(bad):
    """Better an empty picker than a garment filed under the wrong colour."""
    garment = convert(read(dominantColor=bad))

    assert garment["color"] is None
    assert garment["colorName"] is None
    assert garment["deltaE"] is None
    # The rest of the reading still stands.
    assert garment["name"] == "Wool Overcoat"
    assert garment["category"] == "outerwear"


# --- everything else the model says ----------------------------------------


def test_an_unknown_category_is_dropped():
    """The schema constrains generation; it does not guarantee it."""
    assert convert(read(category="hats"))["category"] is None


def test_unknown_occasions_are_filtered_out():
    garment = convert(read(occasions=["work", "gardening", "formal"]))
    assert garment["occasions"] == ["work", "formal"]


def test_missing_occasions_become_an_empty_list():
    assert convert(read(occasions=[]))["occasions"] == []


@pytest.mark.parametrize("blank", ["", "   ", None])
def test_a_blank_brand_is_dropped(blank):
    assert convert(read(brand=blank))["brand"] is None


def test_a_brand_is_kept_and_trimmed():
    assert convert(read(brand="  Hartley Row "))["brand"] == "Hartley Row"


def test_a_blank_name_is_dropped():
    assert convert(read(name="   "))["name"] is None


def test_an_empty_reading_produces_no_claims():
    """A model that says nothing useful should fill nothing in."""
    garment = convert({})

    assert garment["name"] is None
    assert garment["category"] is None
    assert garment["color"] is None
    assert garment["occasions"] == []


# --- classifying what the SDK throws ---------------------------------------
#
# Regression tests. A quota error reached the app as "could not read it",
# sending the user off to retake a photograph that was fine, because the
# Interactions API raises from `google.genai._gaos.lib.compat_errors` — whose
# exceptions do NOT inherit from the `google.genai.errors.APIError` you would
# import, and which carry the status on `status_code` rather than `code`.
#
# The fakes below stand in for both hierarchies. Importing the real private
# module to test against would tie the suite to a path the SDK is free to move.


class NewStyleError(Exception):
    """Shaped like the Interactions API's errors: status_code, no code."""

    def __init__(self, status_code: int):
        super().__init__(f"Error code: {status_code} - something went wrong")
        self.status_code = status_code


class OldStyleError(Exception):
    """Shaped like google.genai.errors.ClientError: code, no status_code."""

    def __init__(self, code: int):
        super().__init__(f"{code} error")
        self.code = code


def test_a_429_is_rate_limiting_however_the_sdk_spells_it():
    for err in (NewStyleError(429), OldStyleError(429)):
        with pytest.raises(VisionRateLimited):
            _raise_for(err)


def test_an_overloaded_model_says_to_wait_rather_than_blaming_the_photo():
    with pytest.raises(VisionFailed, match="overloaded"):
        _raise_for(NewStyleError(503))


@pytest.mark.parametrize("status", [400, 401, 404, 500])
def test_other_statuses_are_ordinary_failures(status):
    with pytest.raises(VisionFailed) as caught:
        _raise_for(NewStyleError(status))
    assert not isinstance(caught.value, VisionRateLimited)


def test_an_exception_with_no_status_is_still_handled():
    with pytest.raises(VisionFailed):
        _raise_for(RuntimeError("connection reset"))


# --- the endpoint ----------------------------------------------------------


def post_analyse(**overrides):
    body = {
        "image": "ZmFrZQ==",
        "mimeType": "image/jpeg",
        "categories": CATEGORIES,
        "occasions": OCCASIONS,
        "swatches": SWATCHES,
        **overrides,
    }
    return client.post("/analyse", json=body)


def test_analyse_returns_camel_case_for_the_app(monkeypatch):
    # `main` imports the function directly, so that is the name to replace.
    monkeypatch.setattr("main.analyse_garment", lambda **_: convert(read(dominantColor="#AD8564")))

    body = post_analyse().json()

    assert body["colorName"] == "camel"
    assert body["detectedColor"] == "#AD8564"
    assert body["deltaE"] > 0
    assert body["category"] == "outerwear"


def test_missing_api_key_is_a_503_not_a_500(monkeypatch):
    """Configuration, not failure — the app should say "not set up", not "retry"."""

    def unavailable(**_):
        raise VisionUnavailable("GEMINI_API_KEY is not set.")

    monkeypatch.setattr("main.analyse_garment", unavailable)
    response = post_analyse()

    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_a_model_failure_is_a_502(monkeypatch):
    def failed(**_):
        raise VisionFailed("Gemini did not answer")

    monkeypatch.setattr("main.analyse_garment", failed)
    assert post_analyse().status_code == 502


def test_rate_limiting_is_a_429_not_a_502(monkeypatch):
    """A quota error must not be reported as a bad photo.

    The free tier is small enough to reach during a demo. Passing this through
    as 429 is what lets the app say "wait a moment" instead of sending someone
    off to retake a photograph that was never the problem.
    """

    def limited(**_):
        raise VisionRateLimited("Gemini is rate limiting this key")

    monkeypatch.setattr("main.analyse_garment", limited)
    response = post_analyse()

    assert response.status_code == 429
    assert "rate limiting" in response.json()["detail"]


def test_the_request_requires_an_image():
    response = client.post(
        "/analyse",
        json={"categories": CATEGORIES, "occasions": OCCASIONS, "swatches": SWATCHES},
    )
    assert response.status_code == 422


def test_the_other_endpoints_still_work():
    assert client.get("/health").status_code == 200
