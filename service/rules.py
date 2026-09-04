"""Outfit assembly: score candidates, take a good one.

The first version of this file sampled — `random.choice` inside a filtered pool,
with colour handled by a lookup table of colour *names*. It could not tell a
good outfit from a merely legal one, it ignored the user's colour analysis
entirely, and it compared every garment to the top and nothing to each other, so
a shirt could suit both the trousers and the shoes while those two clashed.

This version scores instead. Candidate outfits are built, each is measured on
three things, and one of the best is returned:

  colour harmony  how the pieces sit together, measured in CIE Lab (color.py)
  season fit      how well each piece suits the user's own palette
  occasion fit    whether the pieces are actually meant for the occasion

Two decisions worth knowing about, both deliberate:

*One of the best*, not the best. Always returning the top-scoring outfit means
the same wardrobe and the same occasion produce the same answer forever, which
would make "Surprise me" and the daily suggestion static. A shortlist keeps the
quality while leaving the variety the random version had by accident.

*The core is chosen first.* The core is scored as a set, then outerwear and an
accessory are added only if they earn their place. Scoring everything together
would let outfit length distort the comparison, and a coat is a decision about
whether to wear a coat, not a fourth of the outfit.

*A core comes in two shapes.* Either a top, a bottom and shoes, or a one-piece
garment and shoes — a shalwar kameez, a kurta, a sari, a lehenga, a dress. Both
shapes are generated and then compete in the same ranking, which is the only
honest way to compare them: a dress is not a better top, it is a different
answer to the same question, and the scoring already measures whole sets rather
than slots.
"""

import random
from itertools import product
from typing import Iterable, Optional, Sequence

from color import harmony_score, score_item_against_season
from models import SeasonPayload, WardrobeItem

# Per category, how many garments survive into the combination stage. The
# shortlist is by individual merit — occasion and season — so the pieces most
# likely to appear in a good outfit are the ones that get combined. Ten each
# means at most a thousand cores to score, which is nothing.
CANDIDATES_PER_CATEGORY = 10

# How many of the best cores to choose between.
SHORTLIST = 5

# ...and how far below the best a core may score and still be worth choosing.
# Without this the shortlist quietly discards the scoring on a small wardrobe:
# with only two possible outfits, both make the top five and the pick is a coin
# flip no matter how much better one of them is. The tolerance means variety
# only ever comes from outfits that are genuinely close.
#
# Two points, not more. The terms are averaged over the pieces, so one garment
# being markedly better for the wearer moves the total by only a few points —
# swapping a white shirt for a camel one on a Warm Autumn is worth under four.
# A wider band swallows exactly the differences this is supposed to act on.
SHORTLIST_TOLERANCE = 2.0

# What the three measurements are worth, relative to each other. Harmony leads
# because an outfit that does not hang together is not saved by flattering
# colours; occasion trails because it is close to a hard filter already.
WEIGHT_HARMONY = 0.45
WEIGHT_SEASON = 0.35
WEIGHT_OCCASION = 0.20

# An extra piece has to be this good against the chosen core to be worth adding.
# A coat that merely does not clash is not a reason to carry a coat.
EXTRA_PIECE_THRESHOLD = 62.0

# Used wherever a real measurement is unavailable — no season recorded, or a
# colour the maths cannot read. Deliberately mid-range: it neither recommends
# nor rejects, it abstains.
NEUTRAL_SCORE = 70.0


def _occasion_score(item: WardrobeItem, occasion: str) -> float:
    """100 if the garment is meant for the occasion, 40 if merely possible."""
    return 100.0 if occasion in item.occasions else 40.0


def _season_score(item: WardrobeItem, season: Optional[SeasonPayload]) -> float:
    """How well one garment suits the user's palette, or neutral without one."""
    if season is None:
        return NEUTRAL_SCORE
    try:
        return float(
            score_item_against_season(
                item_hex=item.color,
                item_color_name=item.color_name,
                palette=season.palette,
                compatible_color_names=season.compatible_color_names,
            ).score
        )
    except ValueError:
        # An unreadable colour is not grounds for rejecting the garment.
        return NEUTRAL_SCORE


def _shortlist(
    items: Sequence[WardrobeItem],
    category: str,
    occasion: str,
    scores: "_Scores",
    limit: int = CANDIDATES_PER_CATEGORY,
    strict: bool = False,
) -> list[WardrobeItem]:
    """The most promising garments in one category, before combining.

    `strict` drops anything not meant for the occasion. The core cannot afford
    that — a wardrobe with no workout trousers still needs trousers — but an
    optional extra can simply not be added, and a blazer has no business over
    gym clothes however well it happens to match them.
    """
    in_category = [item for item in items if item.category == category]
    suited = [item for item in in_category if occasion in item.occasions]

    # Garments meant for the occasion always win over garments that merely
    # could be worn, whatever the colours say — running shoes are not office
    # shoes because they happen to be the right grey. The rest of the category
    # is only reached when nothing in it suits, so a sparse wardrobe still
    # produces a complete outfit instead of a gap.
    pool = suited if strict else (suited or in_category)
    if not pool:
        return []

    def merit(item: WardrobeItem) -> float:
        return _occasion_score(item, occasion) + scores.season(item)

    # Ties are broken at random, and that matters more than it sounds.
    #
    # This sorted by `(-merit, item.id)` at first, for a stable shortlist. The
    # trouble is that ties here are not rare, they are the normal case: with no
    # colour season recorded every garment scores NEUTRAL, so merit collapses to
    # the occasion term and every garment meant for the occasion ties exactly.
    # The cap then stops being "the ten best" and becomes "the ten
    # alphabetically first", which is arbitrary — and, worse, *consistently*
    # arbitrary, so the same garments are excluded on every single call.
    #
    # It also had a specific victim. Seeded pieces are `top-1`, `top-2`; a piece
    # the user adds is `${category}-${Date.now()}`, so `tops-1757...`. Compare
    # those and `-` (0x2D) beats `s` (0x73), which put every id the app
    # generates behind every id in the seed data. A wardrobe with more than ten
    # tops silently never recommended the user's own clothes — which is exactly
    # how this was found.
    #
    # Shuffle first, then sort: Python's sort is stable, so equal merit keeps
    # the shuffled order and better merit still wins outright. Nothing about the
    # ranking changes, only who survives an arbitrary cut. `build_outfit`
    # already chooses at random among close outfits, so this is the same idea
    # one step earlier rather than a new source of randomness.
    shuffled = list(pool)
    random.shuffle(shuffled)
    return sorted(shuffled, key=lambda item: -merit(item))[:limit]


class _Scores:
    """Per-call memo for the two expensive measurements.

    Scoring a thousand cores asks for the same garment's season fit and the same
    pair of colours over and over. Neither changes during a call, and there are
    only a few dozen garments involved, so both are cached and the combination
    stage becomes dictionary lookups.
    """

    def __init__(self, season: Optional[SeasonPayload]) -> None:
        self._season = season
        self._season_cache: dict[str, float] = {}
        self._harmony_cache: dict[tuple[str, str], float] = {}

    def season(self, item: WardrobeItem) -> float:
        if item.id not in self._season_cache:
            self._season_cache[item.id] = _season_score(item, self._season)
        return self._season_cache[item.id]

    def between(self, a: WardrobeItem, b: WardrobeItem) -> float:
        key = (a.color, b.color) if a.color <= b.color else (b.color, a.color)
        if key not in self._harmony_cache:
            try:
                self._harmony_cache[key] = harmony_score(a.color, b.color)
            except ValueError:
                self._harmony_cache[key] = NEUTRAL_SCORE
        return self._harmony_cache[key]

    def mean_harmony(self, pieces: Sequence[WardrobeItem]) -> float:
        """Every piece against every other, not everything against the top."""
        scores = [
            self.between(a, b)
            for index, a in enumerate(pieces)
            for b in pieces[index + 1 :]
        ]
        return sum(scores) / len(scores) if scores else NEUTRAL_SCORE


def _score_set(
    pieces: Sequence[WardrobeItem],
    occasion: str,
    scores: _Scores,
) -> float:
    """The weighted score for a set of garments worn together."""
    if not pieces:
        return 0.0

    season_fit = sum(scores.season(item) for item in pieces) / len(pieces)
    occasion_fit = sum(_occasion_score(item, occasion) for item in pieces) / len(pieces)

    return (
        WEIGHT_HARMONY * scores.mean_harmony(pieces)
        + WEIGHT_SEASON * season_fit
        + WEIGHT_OCCASION * occasion_fit
    )


def _best_extra(
    candidates: Iterable[WardrobeItem],
    core: Sequence[WardrobeItem],
    occasion: str,
    scores: _Scores,
) -> Optional[WardrobeItem]:
    """The best outerwear or accessory for a chosen core, if any is good enough."""
    scored = [
        (_score_set([*core, candidate], occasion, scores), candidate.id, candidate)
        for candidate in candidates
    ]
    if not scored:
        return None

    score, _, best = max(scored)
    return best if score >= EXTRA_PIECE_THRESHOLD else None


def _candidate_cores(
    items: Sequence[WardrobeItem],
    occasion: str,
    scores: _Scores,
) -> list[list[WardrobeItem]]:
    """Every core worth scoring, in both shapes a look can take.

    Two shapes, generated separately and returned in one list so they compete
    directly:

      top + bottom + shoes
      dress + shoes

    where "dress" is any one-piece garment — a shalwar kameez, a kurta, a sari,
    a lehenga, a western dress. It is not a third slot bolted onto the first
    shape: it *replaces* the top and the bottom, so an outfit containing one has
    no business also containing trousers.

    Pieces come back already filtered of gaps, in wearing order. A category the
    wardrobe cannot fill simply drops out, so a sparse wardrobe still yields the
    best core it can rather than nothing — the same reason the two-piece shape
    tolerates a missing top or missing shoes.

    A note on comparing the shapes fairly. `_score_set` averages its terms over
    the pieces, so a shorter core is not rewarded for being short. It does have
    one quirk worth knowing: harmony is the mean over every *pair*, and a
    dress-and-shoes core has exactly one pair where a three-piece core has
    three. A single pair does not regress toward the middle the way three do, so
    dress cores land at the extremes more often — brilliant when those two
    colours sing, poor when they clash. That is variance, not bias, and it is
    the same behaviour the two-piece shape has always had on a wardrobe with no
    shoes in it.
    """
    tops = _shortlist(items, "tops", occasion, scores)
    bottoms = _shortlist(items, "bottoms", occasion, scores)
    shoes = _shortlist(items, "shoes", occasion, scores)

    # Dresses are shortlisted *strictly*, unlike every other core category, and
    # the asymmetry is the point. A wardrobe with no workout trousers still
    # needs trousers, so `bottoms` falls back to whatever exists. A dress is not
    # a slot that must be filled — it is an alternative shape — so when nothing
    # in it suits the occasion the right answer is to offer no dress core at
    # all and let separates carry the outfit. Without this a lehenga turns up at
    # the gym, purely because it was the only thing in its category.
    dresses = _shortlist(items, "dresses", occasion, scores, strict=True)
    if not dresses and not tops and not bottoms:
        # ...unless there is nothing else to wear, in which case the usual
        # sparse-wardrobe rule applies and an unsuitable dress beats no outfit.
        dresses = _shortlist(items, "dresses", occasion, scores)

    # `or [None]` keeps a shape alive when one of its categories is empty;
    # product() over an empty list yields nothing at all, which would discard
    # the whole shape rather than the missing piece.
    combinations = [
        *product(tops or [None], bottoms or [None], shoes or [None]),
        # No `or [None]` on dresses: without one there is no dress core to build,
        # and pairing "nothing" with shoes would just duplicate a core the first
        # shape already produced.
        *product(dresses, shoes or [None]),
    ]

    cores = [
        [piece for piece in combination if piece is not None]
        for combination in combinations
        if any(piece is not None for piece in combination)
    ]

    # Shoes on their own are not an outfit. The two-piece shape yields exactly
    # that when the wardrobe has shoes but no top and no bottom — it always did,
    # and it went unnoticed while shoes were the only thing that could be left
    # standing. Now that a dress core competes beside it, a lone pair of shoes
    # can score inside the tolerance band and get worn *instead of the dress*.
    #
    # Dropped rather than penalised, so the ranking stays a ranking. The `or`
    # keeps the old behaviour for a wardrobe that genuinely holds nothing but
    # shoes: something to wear beats nothing.
    dressed = [core for core in cores if any(piece.category != "shoes" for piece in core)]
    return dressed or cores


def build_outfit(
    items: Sequence[WardrobeItem],
    occasion: str,
    include_accessories: bool = True,
    season: Optional[SeasonPayload] = None,
) -> list[WardrobeItem]:
    """Assemble a head-to-toe look from the user's own wardrobe.

    Returns the pieces in wearing order — either top, bottom, shoes or a
    one-piece garment and shoes, then outerwear and an accessory if they earn a
    place. A category the wardrobe cannot fill is simply absent, so a sparse
    wardrobe still produces the best outfit it can rather than nothing.

    `season` is the user's colour analysis. Without it the season term abstains
    and the outfit is chosen on harmony and occasion alone.
    """
    scores = _Scores(season)

    cores = _candidate_cores(items, occasion, scores)
    if not cores:
        return []

    scored_cores = sorted(
        (
            (
                -_score_set(core, occasion, scores),
                tuple(piece.id for piece in core),
                core,
            )
            for core in cores
        )
    )

    # One of the best rather than the best — see the note at the top of the
    # file. "Best" is a band, not a rank: a core only shares the choice if it is
    # within a few points of the leader.
    best_score = -scored_cores[0][0]
    pool = [
        core
        for core in scored_cores[:SHORTLIST]
        if -core[0] >= best_score - SHORTLIST_TOLERANCE
    ]

    _, _, chosen = random.choice(pool)
    outfit = list(chosen)

    # Extras are shortlisted strictly: an optional piece that is not meant for
    # the occasion is simply not worn.
    outerwear = _best_extra(
        _shortlist(items, "outerwear", occasion, scores, strict=True), outfit, occasion, scores
    )
    if outerwear:
        outfit.append(outerwear)

    if include_accessories:
        accessory = _best_extra(
            _shortlist(items, "accessories", occasion, scores, strict=True),
            outfit,
            occasion,
            scores,
        )
        if accessory:
            outfit.append(accessory)

    return outfit
