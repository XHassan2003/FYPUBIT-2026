"""The outfit scorer.

These assert judgement, not just shapes: that the season changes what gets
worn, that occasion beats colour, and that an optional piece is left off rather
than forced on. Each one corresponds to something the sampling version it
replaced got wrong.

`build_outfit` chooses at random between outfits within `SHORTLIST_TOLERANCE`
of the best, so the assertions run it repeatedly and check every result rather
than pinning one. A test that seeds `random` would pass even if the scoring
were broken.
"""

import pytest

from models import SeasonPayload, WardrobeItem
from rules import build_outfit

RUNS = 25

WINTER = SeasonPayload(
    id="winter",
    name="True Winter",
    palette=["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"],
    compatibleColorNames=["black", "white", "indigo", "charcoal", "plum", "grey"],
)
AUTUMN = SeasonPayload(
    id="autumn",
    name="Warm Autumn",
    palette=["#B08968", "#6B6E4E", "#6B4A32", "#B98B3E", "#D8D2C4", "#A9784F"],
    compatibleColorNames=["camel", "olive", "brown", "gold", "stone", "tan"],
)


def garment(item_id, category, color, color_name, occasions):
    return WardrobeItem(
        id=item_id,
        name=item_id,
        category=category,
        color=color,
        colorName=color_name,
        occasions=occasions,
    )


def ids_over_runs(items, occasion, **kwargs):
    """Every outfit produced across repeated calls, as sets of ids."""
    return [
        {piece.id for piece in build_outfit(items, occasion, **kwargs)}
        for _ in range(RUNS)
    ]


# A white top and a camel top, each squarely in one season and out of the other,
# with neutral bottoms and shoes so the tops decide the outcome.
TWO_SEASON_WARDROBE = [
    garment("top-winter", "tops", "#FFFFFF", "white", ["work"]),
    garment("top-autumn", "tops", "#B08968", "camel", ["work"]),
    garment("bottom", "bottoms", "#3A3A3A", "charcoal", ["work"]),
    garment("shoes", "shoes", "#2B2420", "black", ["work"]),
]


def test_season_decides_which_top_is_worn():
    winter = ids_over_runs(TWO_SEASON_WARDROBE, "work", season=WINTER)
    autumn = ids_over_runs(TWO_SEASON_WARDROBE, "work", season=AUTUMN)

    assert all("top-winter" in outfit for outfit in winter)
    assert all("top-autumn" in outfit for outfit in autumn)


def test_without_a_season_the_choice_is_left_open():
    """No palette means the season term abstains rather than inventing a winner."""
    outfits = ids_over_runs(TWO_SEASON_WARDROBE, "work")
    assert all(outfit & {"top-winter", "top-autumn"} for outfit in outfits)


OCCASION_WARDROBE = [
    garment("shirt", "tops", "#FFFFFF", "white", ["work"]),
    garment("trousers", "bottoms", "#3A3A3A", "charcoal", ["work"]),
    # Loafers are for work. The trainers are not, but they are a grey that sits
    # exactly in the winter palette — colour alone would pick them.
    garment("loafers", "shoes", "#2B2420", "black", ["work"]),
    garment("trainers", "shoes", "#6E6A62", "grey", ["workout"]),
]


def test_occasion_beats_a_flattering_colour():
    outfits = ids_over_runs(OCCASION_WARDROBE, "work", season=WINTER)

    assert all("loafers" in outfit for outfit in outfits)
    assert all("trainers" not in outfit for outfit in outfits)


def test_unsuitable_garments_are_still_used_when_nothing_else_exists():
    """A sparse wardrobe should produce a complete outfit, not a gap."""
    sparse = [item for item in OCCASION_WARDROBE if item.id != "loafers"]
    outfits = ids_over_runs(sparse, "work", season=WINTER)

    assert all("trainers" in outfit for outfit in outfits)


GYM_WARDROBE = [
    garment("tee", "tops", "#1C1B19", "black", ["workout"]),
    garment("shorts", "bottoms", "#3A3A3A", "charcoal", ["workout"]),
    garment("trainers", "shoes", "#6E6A62", "grey", ["workout"]),
    # Black, so it harmonises with everything here — but nobody wears a blazer
    # to the gym.
    garment("blazer", "outerwear", "#1C1B19", "black", ["work", "formal"]),
    garment("earrings", "accessories", "#B98B3E", "gold", ["formal"]),
]


def test_extras_are_not_worn_out_of_occasion():
    outfits = ids_over_runs(GYM_WARDROBE, "workout", season=WINTER)

    assert all("blazer" not in outfit for outfit in outfits)
    assert all("earrings" not in outfit for outfit in outfits)
    assert all(outfit == {"tee", "shorts", "trainers"} for outfit in outfits)


def test_an_extra_is_worn_when_it_does_suit_the_occasion():
    wardrobe = GYM_WARDROBE + [
        garment("hoodie", "outerwear", "#3A3A3A", "charcoal", ["workout"])
    ]
    outfits = ids_over_runs(wardrobe, "workout", season=WINTER)

    assert all("hoodie" in outfit for outfit in outfits)


def test_pieces_are_compared_to_each_other_not_just_the_top():
    """The old version anchored everything on the top, so two pieces could each
    suit the shirt and clash with one another. Here the only neutral bottom
    keeps the set coherent."""
    wardrobe = [
        garment("shirt", "tops", "#FFFFFF", "white", ["casual"]),
        garment("clashing", "bottoms", "#6B6E4E", "olive", ["casual"]),
        garment("neutral", "bottoms", "#3A3A3A", "charcoal", ["casual"]),
        garment("shoes", "shoes", "#6B2545", "plum", ["casual"]),
    ]
    outfits = ids_over_runs(wardrobe, "casual", season=WINTER)

    assert all("neutral" in outfit for outfit in outfits)


def test_accessories_can_be_excluded():
    wardrobe = GYM_WARDROBE + [
        garment("band", "accessories", "#1C1B19", "black", ["workout"])
    ]
    with_extra = ids_over_runs(wardrobe, "workout", include_accessories=True)
    without = ids_over_runs(wardrobe, "workout", include_accessories=False)

    assert all("band" in outfit for outfit in with_extra)
    assert all("band" not in outfit for outfit in without)


def test_a_garment_is_never_worn_twice():
    for outfit in [build_outfit(TWO_SEASON_WARDROBE, "work", season=WINTER) for _ in range(RUNS)]:
        ids = [piece.id for piece in outfit]
        assert len(ids) == len(set(ids))


def test_missing_categories_are_simply_absent():
    topless = [item for item in OCCASION_WARDROBE if item.category != "tops"]
    outfit = build_outfit(topless, "work", season=WINTER)

    assert outfit
    assert all(piece.category != "tops" for piece in outfit)


def test_empty_wardrobe_produces_nothing():
    assert build_outfit([], "work", season=WINTER) == []


def test_unreadable_colours_do_not_break_the_scorer():
    """A bad hex should cost the garment nothing worse than an abstention."""
    wardrobe = [
        garment("shirt", "tops", "not-a-colour", "white", ["work"]),
        garment("trousers", "bottoms", "#3A3A3A", "charcoal", ["work"]),
        garment("shoes", "shoes", "#2B2420", "black", ["work"]),
    ]
    outfit = build_outfit(wardrobe, "work", season=WINTER)
    assert {piece.id for piece in outfit} == {"shirt", "trousers", "shoes"}


@pytest.mark.parametrize("occasion", ["work", "casual", "formal", "workout"])
def test_every_occasion_produces_something_wearable(occasion):
    wardrobe = [
        garment("top", "tops", "#FFFFFF", "white", [occasion]),
        garment("bottom", "bottoms", "#3A3A3A", "charcoal", [occasion]),
        garment("shoes", "shoes", "#2B2420", "black", [occasion]),
    ]
    outfit = build_outfit(wardrobe, occasion, season=WINTER)
    assert [piece.category for piece in outfit] == ["tops", "bottoms", "shoes"]
