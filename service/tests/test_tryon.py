"""Virtual try-on.

Nothing here calls CatVTON, and that is deliberate beyond the usual reasons:
generation is the most expensive thing this project does, and a test suite that
quietly spent money on every run would be a trap.

Most of the guards below refuse *before* `fal_client.subscribe` is reached, so
they cannot spend anything however they are run. The two tests that deliberately
get past them stub `tryon.fal_client` — see
`test_the_limit_itself_is_allowed_through` for what happens otherwise.

If this file ever starts taking seconds rather than milliseconds, something in
it is talking to fal.
"""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from errors import VisionFailed, VisionRateLimited, VisionUnavailable
from main import app
from tryon import (
    CLIENT_TIMEOUT_S,
    CLOTH_TYPES,
    MAX_GARMENTS,
    _cloth_type,
    _data_uri,
    _raise_for,
    generate_try_on,
)

client = TestClient(app)

# "fake" — a real base64 string, because _data_uri validates before spending.
FAKE = "ZmFrZQ=="


def garment(name="Wool Overcoat", category="outerwear"):
    return {"image": FAKE, "mimeType": "image/jpeg", "name": name, "category": category}


# --- guarding the call -----------------------------------------------------


def test_an_outfit_with_no_garments_is_refused():
    with pytest.raises(VisionFailed, match="No garment"):
        generate_try_on(FAKE, "image/jpeg", [])


def test_more_than_one_garment_is_refused_before_spending_anything():
    """CatVTON fits one masked region per pass. There is no multi-garment mode
    to fall back on, so this is a refusal rather than a truncation — silently
    dropping the second piece would look like the model ignoring it."""
    with pytest.raises(VisionFailed, match="one garment at a time"):
        generate_try_on(FAKE, "image/jpeg", [garment(), garment(category="tops")])


def test_the_limit_itself_is_allowed_through(monkeypatch):
    """Exactly at the cap must not be refused — off-by-one here would be silent.

    The key check is stubbed away because this test deliberately gets past the
    count check, which is the last thing standing between it and a real
    generation. Without the stub it spends money on every run.
    """
    monkeypatch.delenv("FAL_KEY", raising=False)

    with pytest.raises(VisionUnavailable, match="FAL_KEY"):
        generate_try_on(FAKE, "image/jpeg", [garment() for _ in range(MAX_GARMENTS)])


def test_an_unreadable_image_is_caught_before_the_network(monkeypatch):
    """A payload the app could not encode should cost nothing to find out."""
    monkeypatch.setenv("FAL_KEY", "test-key")

    with pytest.raises(VisionFailed, match="could not be read"):
        generate_try_on("not base64 at all!!", "image/jpeg", [garment()])


# --- what CatVTON can and cannot wear --------------------------------------


def test_each_wearable_category_maps_to_a_region():
    assert _cloth_type("tops") == "upper"
    assert _cloth_type("bottoms") == "lower"
    # `outer`, not `upper`: a coat layers over what is already there.
    assert _cloth_type("outerwear") == "outer"


def test_a_one_piece_garment_covers_the_whole_torso():
    """A shalwar kameez, a kurta, a sari, a lehenga, a dress.

    `overall`, and the alternative is not a near miss: mapping these to `upper`
    fits the top half of the garment and leaves the wearer's own trousers
    visible below it. Pinned because the wrong answer here still produces an
    image, so nothing would fail — it would just quietly look wrong, one paid
    generation at a time.
    """
    assert _cloth_type("dresses") == "overall"


@pytest.mark.parametrize("category", ["shoes", "accessories"])
def test_what_the_model_was_never_trained_on_is_refused_by_name(category):
    """VITON-HD and DressCode are upper body, lower body and dresses. Shoes and
    bags are not in the label space, so this is a whitelist and the message has
    to name the piece — "generation failed" would send someone retaking a
    photograph that was never the problem."""
    with pytest.raises(VisionFailed, match=category):
        _cloth_type(category)


def test_an_unknown_category_is_refused_rather_than_guessed():
    """Defaulting to `upper` would put trousers on someone's chest, and finding
    that out costs a generation."""
    with pytest.raises(VisionFailed):
        _cloth_type("hats")

    with pytest.raises(VisionFailed, match="no category"):
        _cloth_type(None)


def test_the_whitelist_holds_only_regions_catvton_accepts():
    """fal's cloth_type is an enum. A typo here would be a 422 per generation."""
    assert set(CLOTH_TYPES.values()) <= {"upper", "lower", "overall", "inner", "outer"}


# --- inlining the images ---------------------------------------------------


def test_an_image_becomes_a_data_uri_fal_can_read():
    assert _data_uri(FAKE, "image/jpeg") == f"data:image/jpeg;base64,{FAKE}"


def test_a_broken_payload_does_not_become_a_data_uri():
    with pytest.raises(VisionFailed, match="could not be read"):
        _data_uri("!!!not base64!!!", "image/jpeg")


# --- reading fal's failures ------------------------------------------------
#
# Shaped like fal's FalClientHTTPError, which carries the status on
# `status_code` and shares no ancestor with Gemini's exceptions. Faked rather
# than imported so the suite is not tied to a class path the client is free to
# move — the same reasoning as the fakes in test_vision.py.


class FalError(Exception):
    def __init__(self, status_code: int):
        super().__init__(f"fal returned {status_code}")
        self.status_code = status_code


def test_a_rejected_key_is_setup_not_failure():
    """401 and 403 belong with the missing key, not with the failures. The app
    shows "not set up yet", which is the thing to go and fix."""
    for status in (401, 403):
        with pytest.raises(VisionUnavailable):
            _raise_for(FalError(status))


def test_an_exhausted_balance_does_not_get_reported_as_a_bad_key():
    """A regression test with a story. The first real generation failed with

        403  User is locked. Reason: Exhausted balance.

    and the service reported "fal rejected the API key. Check FAL_KEY" — which
    was wrong, and wrong in the expensive direction: the key was valid, and the
    advice sent you re-copying it instead of topping up. fal uses 403 for both,
    so the status alone cannot tell them apart and the message has to survive.

    This is the same trap `errors.status_of` documents for Gemini quota errors,
    which is why it is worth a test on both providers rather than a comment.
    """
    locked = FalError(403)
    locked.args = ("User is locked. Reason: Exhausted balance. Top up your balance.",)

    with pytest.raises(VisionUnavailable, match="Exhausted balance"):
        _raise_for(locked)


def test_a_rejected_key_with_nothing_to_say_still_names_the_setting():
    """The fallback, for a 401 that carried no message worth passing on."""

    class Silent(Exception):
        status_code = 401

        def __str__(self):
            return ""

    with pytest.raises(VisionUnavailable, match="FAL_KEY"):
        _raise_for(Silent())


def test_a_429_is_rate_limiting():
    with pytest.raises(VisionRateLimited):
        _raise_for(FalError(429))


def test_an_overloaded_model_says_to_wait_rather_than_blaming_the_photo():
    with pytest.raises(VisionFailed, match="overloaded"):
        _raise_for(FalError(503))


def test_a_timeout_is_a_failure_that_says_so():
    with pytest.raises(VisionFailed, match="too long"):
        _raise_for(TimeoutError("client timeout"))


def test_an_exception_with_no_status_is_still_handled():
    with pytest.raises(VisionFailed):
        _raise_for(RuntimeError("connection reset"))


# --- the whole path, with fal and its CDN stubbed out ----------------------


class FakeResponse:
    """Enough of an httpx response for _download."""

    def __init__(self, content: bytes, content_type: str = "image/png"):
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        return None


def test_the_request_sent_to_fal_is_the_one_catvton_expects(monkeypatch):
    """The arguments are the contract, and nothing else checks them.

    A renamed key or a cloth type fal does not accept fails as a 422 *per
    generation* — paid for, and only visible at runtime. Pinning them here is
    the cheap version of finding that out.
    """
    monkeypatch.setenv("FAL_KEY", "test-key")
    sent = {}

    def fake_subscribe(model, arguments, **kwargs):
        sent["model"] = model
        sent["arguments"] = arguments
        sent["kwargs"] = kwargs
        return {"image": {"url": "https://fal.media/files/look.png", "content_type": "image/png"}}

    monkeypatch.setattr("tryon.fal_client.subscribe", fake_subscribe)
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"\x89PNG"))

    result = generate_try_on(FAKE, "image/jpeg", [garment(category="tops")])

    assert sent["model"] == "fal-ai/cat-vton"
    assert sent["arguments"]["human_image_url"] == f"data:image/jpeg;base64,{FAKE}"
    assert sent["arguments"]["garment_image_url"] == f"data:image/jpeg;base64,{FAKE}"
    assert sent["arguments"]["cloth_type"] == "upper"
    assert sent["arguments"]["image_size"] == "portrait_4_3"
    assert sent["kwargs"]["client_timeout"] == CLIENT_TIMEOUT_S


def test_the_service_gives_up_before_the_phone_does():
    """The one invariant that spans both halves of the project.

    The service must time out *first*, so that a wait which goes nowhere comes
    back as a message the app can show rather than the phone abandoning a
    request in silence. Get the order wrong and the failure mode is a user
    staring at a spinner that resolves into nothing.

    This read the app's number as a hardcoded `< 120` at first, which quietly
    defeated the point: when both timeouts were raised, the test failed on the
    stale literal rather than on the relationship it existed to protect. So it
    now reads the real value out of constants/api.ts. Parsing TypeScript from a
    Python test is not elegant, but the alternative is a constant duplicated
    across two languages with nothing keeping them honest — and that is exactly
    the pair that has already drifted once.
    """
    api_ts = Path(__file__).resolve().parent.parent.parent / "constants" / "api.ts"
    if not api_ts.exists():  # pragma: no cover — only if the app is not checked out
        pytest.skip(f"{api_ts} not found")

    found = re.search(r"TRY_ON_TIMEOUT_MS\s*=\s*(\d+)", api_ts.read_text(encoding="utf-8"))
    assert found, "TRY_ON_TIMEOUT_MS not found in constants/api.ts — did it get renamed?"

    app_timeout_s = int(found.group(1)) / 1000

    assert CLIENT_TIMEOUT_S < app_timeout_s, (
        f"the service waits {CLIENT_TIMEOUT_S}s but the app gives up at "
        f"{app_timeout_s}s — the app must be the more patient of the two"
    )


def test_the_generated_image_comes_back_as_bytes_not_a_link(monkeypatch):
    """fal answers with a public URL to a photograph of the user. The service
    fetches it so that link never reaches the phone, and so the app can keep
    writing base64 straight to a file."""
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"image": {"url": "https://fal.media/files/look.png"}},
    )
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"look"))

    result = generate_try_on(FAKE, "image/jpeg", [garment(category="bottoms")])

    assert result == {"image": "bG9vaw==", "mimeType": "image/png"}


def test_a_charset_on_the_content_type_does_not_reach_the_app(monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"image": {"url": "https://fal.media/files/look.jpg"}},
    )
    monkeypatch.setattr(
        "tryon.httpx.get", lambda url, **_: FakeResponse(b"look", "image/jpeg; charset=binary")
    )

    assert generate_try_on(FAKE, "image/jpeg", [garment()])["mimeType"] == "image/jpeg"


def test_a_finished_job_with_no_image_does_not_blame_the_photograph(monkeypatch):
    """Rare, and not something the user can fix by choosing a different photo —
    so the message must not tell them to."""
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr("tryon.fal_client.subscribe", lambda *_, **__: {})

    with pytest.raises(VisionFailed, match="without producing an image"):
        generate_try_on(FAKE, "image/jpeg", [garment()])


def test_an_image_that_cannot_be_fetched_back_is_its_own_failure(monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"image": {"url": "https://fal.media/files/gone.png"}},
    )

    def refuse(url, **_):
        raise RuntimeError("connection reset")

    monkeypatch.setattr("tryon.httpx.get", refuse)

    with pytest.raises(VisionFailed, match="could not be fetched"):
        generate_try_on(FAKE, "image/jpeg", [garment()])


# --- the endpoint ----------------------------------------------------------


def post_try_on(**overrides):
    body = {
        "person": FAKE,
        "personMimeType": "image/jpeg",
        "garments": [garment()],
        **overrides,
    }
    return client.post("/try-on", json=body)


def test_a_generated_image_comes_back_camel_cased(monkeypatch):
    monkeypatch.setattr(
        "main.generate_try_on", lambda **_: {"image": "Z2VuZXJhdGVk", "mimeType": "image/png"}
    )
    body = post_try_on().json()

    assert body["image"] == "Z2VuZXJhdGVk"
    # PNG, not JPEG: fal returns PNG by default, and the app names and shares
    # the file by whatever comes back rather than assuming.
    assert body["mimeType"] == "image/png"


def test_missing_api_key_is_a_503(monkeypatch):
    def unavailable(**_):
        raise VisionUnavailable("FAL_KEY is not set.")

    monkeypatch.setattr("main.generate_try_on", unavailable)
    response = post_try_on()

    assert response.status_code == 503
    assert "FAL_KEY" in response.json()["detail"]


def test_rate_limiting_is_a_429(monkeypatch):
    def limited(**_):
        raise VisionRateLimited("busy")

    monkeypatch.setattr("main.generate_try_on", limited)
    assert post_try_on().status_code == 429


def test_an_unwearable_piece_is_a_502_with_something_to_act_on(monkeypatch):
    """The message names the garment. The app shows it verbatim, because "shoes
    cannot be tried on" is actionable and "try-on failed" is not."""

    def refused(**_):
        raise VisionFailed("CatVTON cannot fit shoes — it dresses tops, bottoms, outerwear only.")

    monkeypatch.setattr("main.generate_try_on", refused)
    response = post_try_on(garments=[garment(category="shoes")])

    assert response.status_code == 502
    assert "shoes" in response.json()["detail"]


def test_a_person_is_required():
    response = client.post("/try-on", json={"garments": [garment()]})
    assert response.status_code == 422


def test_the_other_endpoints_are_untouched():
    assert client.get("/health").status_code == 200
