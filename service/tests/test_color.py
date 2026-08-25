"""Colour maths, checked against published reference data.

The point of the first test is that CIEDE2000 is long enough to get subtly
wrong, and a subtly wrong implementation still returns plausible numbers — it
would score garments confidently and incorrectly, with nothing on screen to
suggest a problem. So it is checked against the reference pairs the formula's
authors published rather than against our own expectations.
"""

import math

import pytest

from color import (
    MATCH_THRESHOLD,
    ciede2000,
    harmony_score,
    hex_to_lab,
    hex_to_rgb,
    nearest_palette_color,
    score_from_distance,
    score_item_against_season,
)

# Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula:
# Implementation Notes, Supplementary Test Data and Mathematical Observations".
# (lab1, lab2, expected dE00)
SHARMA_PAIRS = [
    ((50.0000, 2.6772, -79.7751), (50.0000, 0.0000, -82.7485), 2.0425),
    ((50.0000, 3.1571, -77.2803), (50.0000, 0.0000, -82.7485), 2.8615),
    ((50.0000, 2.8361, -74.0200), (50.0000, 0.0000, -82.7485), 3.4412),
    ((50.0000, -1.3802, -84.2814), (50.0000, 0.0000, -82.7485), 1.0000),
    ((50.0000, -1.1848, -84.8006), (50.0000, 0.0000, -82.7485), 1.0000),
    ((50.0000, -0.9009, -85.5211), (50.0000, 0.0000, -82.7485), 1.0000),
    ((50.0000, 0.0000, 0.0000), (50.0000, -1.0000, 2.0000), 2.3669),
    ((50.0000, -1.0000, 2.0000), (50.0000, 0.0000, 0.0000), 2.3669),
    # The 0.0009 / 0.0011 pairs sit either side of a discontinuity in the hue
    # term; they are in the reference set precisely to catch a naive average.
    ((50.0000, 2.4900, -0.0010), (50.0000, -2.4900, 0.0009), 7.1792),
    ((50.0000, 2.4900, -0.0010), (50.0000, -2.4900, 0.0010), 7.1792),
    ((50.0000, 2.4900, -0.0010), (50.0000, -2.4900, 0.0011), 7.2195),
    ((50.0000, 2.4900, -0.0010), (50.0000, -2.4900, 0.0012), 7.2195),
    ((50.0000, -0.0010, 2.4900), (50.0000, 0.0009, -2.4900), 4.8045),
    ((50.0000, -0.0010, 2.4900), (50.0000, 0.0010, -2.4900), 4.8045),
    ((50.0000, -0.0010, 2.4900), (50.0000, 0.0011, -2.4900), 4.7461),
    ((50.0000, 2.5000, 0.0000), (50.0000, 0.0000, -2.5000), 4.3065),
    ((50.0000, 2.5000, 0.0000), (73.0000, 25.0000, -18.0000), 27.1492),
    ((50.0000, 2.5000, 0.0000), (61.0000, -5.0000, 29.0000), 22.8977),
    ((50.0000, 2.5000, 0.0000), (56.0000, -27.0000, -3.0000), 31.9030),
    ((50.0000, 2.5000, 0.0000), (58.0000, 24.0000, 15.0000), 19.4535),
    ((50.0000, 2.5000, 0.0000), (50.0000, 3.1736, 0.5854), 1.0000),
    ((50.0000, 2.5000, 0.0000), (50.0000, 3.2972, 0.0000), 1.0000),
    ((50.0000, 2.5000, 0.0000), (50.0000, 1.8634, 0.5757), 1.0000),
    ((50.0000, 2.5000, 0.0000), (50.0000, 3.2592, 0.3350), 1.0000),
    ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644),
    ((63.0109, -31.0961, -5.8663), (62.8187, -29.7946, -4.0864), 1.2630),
    ((61.2901, 3.7196, -5.3901), (61.4292, 2.2480, -4.9620), 1.8731),
    ((35.0831, -44.1164, 3.7933), (35.0232, -40.0716, 1.5901), 1.8645),
    ((22.7233, 20.0904, -46.6940), (23.0331, 14.9730, -42.5619), 2.0373),
    ((36.4612, 47.8580, 18.3852), (36.2715, 50.5065, 21.2231), 1.4146),
    ((90.8027, -2.0831, 1.4410), (91.1528, -1.6435, 0.0447), 1.4441),
    ((90.9257, -0.5406, -0.9208), (88.6381, -0.8985, -0.7239), 1.5381),
    ((6.7747, -0.2908, -2.4247), (5.8714, -0.0985, -2.2286), 0.6377),
    ((2.0776, 0.0795, -1.1350), (0.9033, -0.0636, -0.5514), 0.9082),
]


@pytest.mark.parametrize("lab1,lab2,expected", SHARMA_PAIRS)
def test_ciede2000_matches_reference_data(lab1, lab2, expected):
    assert ciede2000(lab1, lab2) == pytest.approx(expected, abs=1e-4)


def test_ciede2000_is_symmetric():
    for lab1, lab2, _ in SHARMA_PAIRS:
        assert ciede2000(lab1, lab2) == pytest.approx(ciede2000(lab2, lab1), abs=1e-9)


def test_ciede2000_is_zero_for_identical_colors():
    assert ciede2000((42.0, -7.5, 13.25), (42.0, -7.5, 13.25)) == pytest.approx(0.0)


@pytest.mark.parametrize(
    "value,expected",
    [
        ("#FFFFFF", (100.0, 0.0, 0.0)),
        ("#000000", (0.0, 0.0, 0.0)),
        # The textbook Lab for sRGB red under D65.
        ("#FF0000", (53.2408, 80.0925, 67.2032)),
    ],
)
def test_hex_to_lab_known_values(value, expected):
    assert hex_to_lab(value) == pytest.approx(expected, abs=1e-3)


@pytest.mark.parametrize("value", ["#B08968", "B08968", "#b08968"])
def test_hex_parsing_accepts_the_usual_spellings(value):
    assert hex_to_rgb(value) == (176, 137, 104)


def test_hex_parsing_expands_the_short_form():
    assert hex_to_rgb("#FFF") == (255, 255, 255)


@pytest.mark.parametrize("value", ["", "#12345", "not-a-colour", "#GGGGGG"])
def test_hex_parsing_rejects_nonsense(value):
    with pytest.raises(ValueError):
        hex_to_rgb(value)


def test_score_hits_its_anchors():
    for distance, expected in [(0, 100), (2, 92), (10, 70), (25, 45), (50, 20)]:
        assert score_from_distance(distance) == pytest.approx(expected)


def test_score_never_increases_with_distance():
    previous = math.inf
    for step in range(0, 1200):
        current = score_from_distance(step / 10)
        assert current <= previous + 1e-9
        previous = current


def test_score_stays_in_range_beyond_the_last_anchor():
    assert 0 <= score_from_distance(500) <= 100


WINTER_PALETTE = ["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"]
WINTER_NAMES = ["black", "white", "indigo", "charcoal", "plum", "grey"]


def test_nearest_palette_color_picks_the_closest():
    nearest, distance = nearest_palette_color("#FFFFFF", WINTER_PALETTE)
    assert nearest == "#FFFFFF"
    assert distance == pytest.approx(0.0)


def test_nearest_palette_color_skips_unreadable_entries():
    nearest, _ = nearest_palette_color("#FFFFFF", ["oops", "#FFFFFF"])
    assert nearest == "#FFFFFF"


def test_garment_on_a_palette_colour_scores_full_marks():
    """Regression: the name bonus used to cap a measured 100 down to 99."""
    outcome = score_item_against_season("#1C1B19", "black", WINTER_PALETTE, WINTER_NAMES)
    assert outcome.score == 100
    assert outcome.is_match


def test_name_agreement_lifts_but_does_not_decide():
    without = score_item_against_season("#8A9A80", "sage", WINTER_PALETTE, WINTER_NAMES)
    with_name = score_item_against_season("#8A9A80", "sage", WINTER_PALETTE, WINTER_NAMES + ["sage"])

    assert with_name.score > without.score
    # A distant colour stays a non-match however it is labelled.
    assert not with_name.is_match


def test_clashing_garment_scores_below_the_threshold():
    outcome = score_item_against_season("#B98B3E", "gold", WINTER_PALETTE, WINTER_NAMES)
    assert outcome.score < MATCH_THRESHOLD
    assert not outcome.is_match
    assert outcome.delta_e > 10


def test_empty_palette_is_an_error_not_a_score():
    with pytest.raises(ValueError):
        score_item_against_season("#FFFFFF", "white", [], [])


# --- harmony between two garments -----------------------------------------
#
# A different question from palette matching, and it must not collapse into
# "closer is better": an outfit in one flat colour is not the best possible
# outfit, and the most distant colour is usually a clash.

WHITE, BLACK, CHARCOAL = "#FFFFFF", "#1C1B19", "#3A3A3A"
RED, ORANGE, GREEN, BLUE = "#C0392B", "#D35400", "#27AE60", "#2C6FBB"


def test_harmony_is_symmetric():
    for a, b in [(WHITE, BLACK), (RED, GREEN), (ORANGE, BLUE)]:
        assert harmony_score(a, b) == pytest.approx(harmony_score(b, a))


def test_harmony_stays_in_range():
    for a in [WHITE, BLACK, RED, ORANGE, GREEN, BLUE, CHARCOAL]:
        for b in [WHITE, BLACK, RED, ORANGE, GREEN, BLUE, CHARCOAL]:
            assert 0 <= harmony_score(a, b) <= 100


def test_neutrals_with_contrast_are_the_easy_win():
    assert harmony_score(WHITE, BLACK) == pytest.approx(100)


def test_one_flat_colour_is_allowed_but_dull():
    """All-charcoal should score respectably and still lose to some contrast."""
    flat = harmony_score(CHARCOAL, CHARCOAL)
    contrasted = harmony_score(CHARCOAL, WHITE)

    assert 50 < flat < contrasted


def test_neutrals_go_with_any_hue():
    """Whatever the colour, a neutral partner should not be penalised on hue."""
    for color in [RED, ORANGE, GREEN, BLUE]:
        assert harmony_score(color, BLACK) > 75


def test_analogous_hues_beat_the_clash_zone():
    analogous = harmony_score(RED, ORANGE)
    awkward = harmony_score(RED, GREEN)
    assert analogous > awkward


def test_near_opposites_beat_the_clash_zone():
    """Complementary pairs are a classical harmony; the middle is the problem."""
    assert harmony_score(ORANGE, BLUE) > harmony_score(RED, GREEN)


def test_identical_saturated_colours_are_not_the_top_score():
    """Two of the same strong colour is coherent but flat — it must not beat a
    well-contrasted pairing, or the scorer would dress people head to toe in
    one hue."""
    assert harmony_score(RED, RED) < harmony_score(WHITE, BLACK)
