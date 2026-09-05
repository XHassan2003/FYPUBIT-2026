"""Virtual try-on.

Nothing here calls CatVTON, and that is deliberate beyond the usual reasons:
generation is the most expensive thing this project does, and a test suite that
quietly spent money on every run would be a trap.

Most of the guards below refuse *before* `fal_client.subscribe` is reached, so
they cannot spend anything however they are run. The two tests that deliberately
get past them stub `tryon.fal_client` â€” see
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
    FASHN_CATEGORIES,
    MAX_GARMENTS,
    _data_uri,
    _fashn_category,
    _ordered_for_chaining,
    _raise_for,
    generate_try_on,
)

client = TestClient(app)

# "fake" â€” a real base64 string, because _data_uri validates before spending.
FAKE = "ZmFrZQ=="


def garment(name="Wool Overcoat", category="outerwear"):
    return {"image": FAKE, "mimeType": "image/jpeg", "name": name, "category": category}


# --- guarding the call -----------------------------------------------------


def test_an_outfit_with_no_garments_is_refused():
    with pytest.raises(VisionFailed, match="No garment"):
        generate_try_on(FAKE, "image/jpeg", [])


def test_more_pieces_than_an_outfit_has_are_refused_before_spending_anything():
    """Each piece is a separate paid pass, so the cap is money, not tidiness."""
    with pytest.raises(VisionFailed, match="at most"):
        generate_try_on(
            FAKE,
            "image/jpeg",
            [garment(category="tops"), garment(category="bottoms"), garment(category="dresses")],
        )


def test_two_pieces_for_the_same_part_of_the_body_are_refused():
    """A shirt and a coat both want the upper body.

    FASHN has one upper-body category, so the second pass would paint over the
    first and the generation spent on the shirt would simply vanish. Nothing
    raises when that happens — an image comes back, wrong, paid for twice —
    which is exactly why it is caught here instead.
    """
    with pytest.raises(VisionFailed, match="same part of the outfit"):
        generate_try_on(
            FAKE, "image/jpeg", [garment(category="tops"), garment(category="outerwear")]
        )


def test_a_one_piece_garment_cannot_be_worn_with_separates():
    """A kameez already covers the body a pair of trousers wants."""
    with pytest.raises(VisionFailed, match="whole outfit on its own"):
        generate_try_on(
            FAKE, "image/jpeg", [garment(category="dresses"), garment(category="bottoms")]
        )


def test_a_full_outfit_is_allowed_through(monkeypatch):
    """A top and a bottom together — the point of the feature.

    The key check is stubbed away because this test deliberately gets past every
    validation, which is the last thing standing between it and two real
    generations. Without the stub it spends money on every run.
    """
    monkeypatch.delenv("FAL_KEY", raising=False)

    with pytest.raises(VisionUnavailable, match="FAL_KEY"):
        generate_try_on(
            FAKE, "image/jpeg", [garment(category="tops"), garment(category="bottoms")]
        )


def test_the_bottom_half_is_rendered_first():
    """Order is not cosmetic: the last pass is drawn freshest, and at the waist
    the top overlaps the bottom. Running tops last lets a shirt fall over a
    waistband instead of having trousers drawn on top of a placed shirt.

    Asserted on the ordering helper rather than through a generation, so it
    costs nothing and still fails if the order is reversed.
    """
    ordered = _ordered_for_chaining(
        [garment(name="Shirt", category="tops"), garment(name="Trousers", category="bottoms")]
    )
    assert [piece["category"] for piece in ordered] == ["bottoms", "tops"]

    # ...and the same however the app happened to send them.
    reversed_in = _ordered_for_chaining(
        [garment(name="Trousers", category="bottoms"), garment(name="Shirt", category="tops")]
    )
    assert [piece["category"] for piece in reversed_in] == ["bottoms", "tops"]


def test_an_unreadable_image_is_caught_before_the_network(monkeypatch):
    """A payload the app could not encode should cost nothing to find out."""
    monkeypatch.setenv("FAL_KEY", "test-key")

    with pytest.raises(VisionFailed, match="could not be read"):
        generate_try_on("not base64 at all!!", "image/jpeg", [garment()])


# --- what the model can and cannot wear ------------------------------------


def test_each_wearable_category_maps_to_a_fashn_one():
    assert _fashn_category("tops") == "tops"
    assert _fashn_category("bottoms") == "bottoms"


def test_outerwear_goes_on_as_a_top_because_there_is_nowhere_else():
    """The one regression in moving from CatVTON to FASHN, pinned so it is a
    known decision rather than a surprise in a demo.

    CatVTON had an `outer` cloth type that layered a coat over what was already
    worn. FASHN has three categories and none of them is outerwear, so a coat is
    a top-half garment and replaces the top instead of going over it.
    """
    assert _fashn_category("outerwear") == "tops"


def test_a_one_piece_garment_covers_the_whole_torso():
    """A shalwar kameez, a kurta, a sari, a lehenga, a dress.

    `one-pieces`, and the alternative is not a near miss: mapping these to
    `tops` fits the top half of the garment and leaves the wearer's own trousers
    visible below it. Pinned because the wrong answer here still produces an
    image, so nothing would fail — it would just quietly look wrong, one paid
    generation at a time.
    """
    assert _fashn_category("dresses") == "one-pieces"


@pytest.mark.parametrize("category", ["shoes", "accessories"])
def test_what_the_model_was_never_trained_on_is_refused_by_name(category):
    """FASHN has tops, bottoms and one-pieces. Shoes and bags are not categories
    it has, so this is a whitelist and the message has to name the piece —
    "generation failed" would send someone retaking a photograph that was never
    the problem."""
    with pytest.raises(VisionFailed, match=category):
        _fashn_category(category)


def test_an_unknown_category_is_refused_rather_than_guessed():
    """FASHN offers an `auto` category that infers from the image. Deliberately
    unused: the wardrobe already knows what each piece is, and defaulting to a
    guess would put trousers on someone's chest at the cost of a generation."""
    with pytest.raises(VisionFailed):
        _fashn_category("hats")

    with pytest.raises(VisionFailed, match="no category"):
        _fashn_category(None)


def test_the_whitelist_holds_only_categories_fashn_accepts():
    """fal's `category` is an enum. A typo here would be a 422 per generation."""
    assert set(FASHN_CATEGORIES.values()) <= {"tops", "bottoms", "one-pieces", "auto"}


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
# move â€” the same reasoning as the fakes in test_vision.py.


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

    and the service reported "fal rejected the API key. Check FAL_KEY" â€” which
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


def test_the_request_sent_to_fal_is_the_one_fashn_expects(monkeypatch):
    """The arguments are the contract, and nothing else checks them.

    A renamed key or a category fal does not accept fails as a 422 *per
    generation* — paid for, and only visible at runtime. Pinning them here is
    the cheap version of finding that out.

    Every field below changed name or value in the move from CatVTON:
    `human_image_url` became `model_image`, `cloth_type` became `category` with
    a different vocabulary, and `image_size`/`num_inference_steps`/
    `guidance_scale` were replaced by a single `mode`. Sending the old shape
    would have been a 422 on every call.
    """
    monkeypatch.setenv("FAL_KEY", "test-key")
    sent = {}

    def fake_subscribe(model, arguments, **kwargs):
        sent["model"] = model
        sent["arguments"] = arguments
        sent["kwargs"] = kwargs
        return {"images": [{"url": "https://fal.media/files/look.png", "content_type": "image/png"}]}

    monkeypatch.setattr("tryon.fal_client.subscribe", fake_subscribe)
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"\x89PNG"))

    generate_try_on(FAKE, "image/jpeg", [garment(category="tops")])

    assert sent["model"] == "fal-ai/fashn/tryon/v1.6"
    assert sent["arguments"]["model_image"] == f"data:image/jpeg;base64,{FAKE}"
    assert sent["arguments"]["garment_image"] == f"data:image/jpeg;base64,{FAKE}"
    assert sent["arguments"]["category"] == "tops"
    # `auto` is the whole reason for the swap: it lets a photograph of someone
    # *wearing* the garment work as a reference, not just a flat-lay.
    assert sent["arguments"]["garment_photo_type"] == "auto"
    assert sent["arguments"]["mode"] in {"performance", "balanced", "quality"}
    # At most the budget, not exactly it: the timeout handed to each pass is
    # what remains of one shared deadline, so the first pass gets very nearly
    # the whole thing and a later one gets whatever is left.
    assert 0 < sent["kwargs"]["client_timeout"] <= CLIENT_TIMEOUT_S


def test_a_two_pass_outfit_still_fits_inside_one_budget(monkeypatch):
    """The invariant chaining could easily have broken.

    `CLIENT_TIMEOUT_S` was written as a per-call timeout. Handing it to each
    pass unchanged would let a two-piece outfit run for twice as long as the app
    is prepared to wait, and the app would then abandon a request the service
    still thought it owned — silence on the phone instead of an explanation,
    which is the exact failure the two timeouts are arranged to prevent.
    """
    monkeypatch.setenv("FAL_KEY", "test-key")
    budgets: list[float] = []

    def fake_subscribe(model, arguments, **kwargs):
        budgets.append(kwargs["client_timeout"])
        return {"images": [{"url": "https://fal.media/files/look.png"}]}

    monkeypatch.setattr("tryon.fal_client.subscribe", fake_subscribe)
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"\x89PNG"))

    generate_try_on(
        FAKE, "image/jpeg", [garment(category="tops"), garment(category="bottoms")]
    )

    assert len(budgets) == 2, "a two-piece outfit is two passes"
    # Each pass is bounded by what is left, so the later one can never exceed
    # the earlier — and neither exceeds the whole.
    assert all(0 < budget <= CLIENT_TIMEOUT_S for budget in budgets)
    assert budgets[1] <= budgets[0]


def test_the_second_pass_wears_the_first_passs_result(monkeypatch):
    """What makes it a chain rather than two unrelated generations.

    Pass two has to dress the person who is already wearing the top, not the
    original photograph. Getting this wrong produces a perfectly good image of
    the wrong outfit — only the last garment on — with nothing raising to say
    the first generation was thrown away.
    """
    monkeypatch.setenv("FAL_KEY", "test-key")
    sent: list[dict] = []
    first_output = "https://fal.media/files/after-trousers.png"

    def fake_subscribe(model, arguments, **kwargs):
        sent.append(arguments)
        return {"images": [{"url": first_output if len(sent) == 1 else "https://fal.media/x.png"}]}

    monkeypatch.setattr("tryon.fal_client.subscribe", fake_subscribe)
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"\x89PNG"))

    generate_try_on(
        FAKE, "image/jpeg", [garment(category="tops"), garment(category="bottoms")]
    )

    # Bottoms first — see test_the_bottom_half_is_rendered_first.
    assert sent[0]["category"] == "bottoms"
    assert sent[0]["model_image"].startswith("data:")

    assert sent[1]["category"] == "tops"
    assert sent[1]["model_image"] == first_output


def test_a_single_image_object_is_not_mistaken_for_a_result(monkeypatch):
    """CatVTON answered with `image`; FASHN answers with `images`, a list.

    Reading the old shape against the new one yields None rather than raising,
    so the mistake would have surfaced as "finished without producing an image"
    on every single call — after paying for each one. This pins the plural.
    """
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"image": {"url": "https://fal.media/files/old-shape.png"}},
    )

    with pytest.raises(VisionFailed, match="without producing an image"):
        generate_try_on(FAKE, "image/jpeg", [garment()])


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
    across two languages with nothing keeping them honest â€” and that is exactly
    the pair that has already drifted once.
    """
    api_ts = Path(__file__).resolve().parent.parent.parent / "constants" / "api.ts"
    if not api_ts.exists():  # pragma: no cover â€” only if the app is not checked out
        pytest.skip(f"{api_ts} not found")

    found = re.search(r"TRY_ON_TIMEOUT_MS\s*=\s*(\d+)", api_ts.read_text(encoding="utf-8"))
    assert found, "TRY_ON_TIMEOUT_MS not found in constants/api.ts â€” did it get renamed?"

    app_timeout_s = int(found.group(1)) / 1000

    assert CLIENT_TIMEOUT_S < app_timeout_s, (
        f"the service waits {CLIENT_TIMEOUT_S}s but the app gives up at "
        f"{app_timeout_s}s â€” the app must be the more patient of the two"
    )


def test_the_generated_image_comes_back_as_bytes_not_a_link(monkeypatch):
    """fal answers with a public URL to a photograph of the user. The service
    fetches it so that link never reaches the phone, and so the app can keep
    writing base64 straight to a file."""
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"images": [{"url": "https://fal.media/files/look.png"}]},
    )
    monkeypatch.setattr("tryon.httpx.get", lambda url, **_: FakeResponse(b"look"))

    result = generate_try_on(FAKE, "image/jpeg", [garment(category="bottoms")])

    assert result == {"image": "bG9vaw==", "mimeType": "image/png"}


def test_a_charset_on_the_content_type_does_not_reach_the_app(monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"images": [{"url": "https://fal.media/files/look.jpg"}]},
    )
    monkeypatch.setattr(
        "tryon.httpx.get", lambda url, **_: FakeResponse(b"look", "image/jpeg; charset=binary")
    )

    assert generate_try_on(FAKE, "image/jpeg", [garment()])["mimeType"] == "image/jpeg"


def test_a_finished_job_with_no_image_does_not_blame_the_photograph(monkeypatch):
    """Rare, and not something the user can fix by choosing a different photo â€”
    so the message must not tell them to."""
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr("tryon.fal_client.subscribe", lambda *_, **__: {})

    with pytest.raises(VisionFailed, match="without producing an image"):
        generate_try_on(FAKE, "image/jpeg", [garment()])


def test_an_image_that_cannot_be_fetched_back_is_its_own_failure(monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(
        "tryon.fal_client.subscribe",
        lambda *_, **__: {"images": [{"url": "https://fal.media/files/gone.png"}]},
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
        raise VisionFailed("CatVTON cannot fit shoes â€” it dresses tops, bottoms, outerwear only.")

    monkeypatch.setattr("main.generate_try_on", refused)
    response = post_try_on(garments=[garment(category="shoes")])

    assert response.status_code == 502
    assert "shoes" in response.json()["detail"]


def test_a_person_is_required():
    response = client.post("/try-on", json={"garments": [garment()]})
    assert response.status_code == 422


def test_the_other_endpoints_are_untouched():
    assert client.get("/health").status_code == 200

