"""Perceptual colour distance, for scoring a garment against a seasonal palette.

The app used to answer "does this suit me?" with a hash of the item's id — a
number that was stable per garment and otherwise meaningless. This module
replaces it with the actual measurement the question deserves.

The chain is the standard one: sRGB -> linear RGB -> CIE XYZ (D65) -> CIE Lab,
then CIEDE2000 for the distance between two Lab colours. Lab exists because RGB
distance does not match human vision — the same numeric gap is glaring in one
part of the space and invisible in another. CIEDE2000 goes further and corrects
Lab's own remaining unevenness around hue, chroma and the blue region.

Pure stdlib on purpose. The maths is a few dozen lines and adding numpy to a
service this size would cost more than it saves.

Reference: Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula".
"""

import math
from typing import NamedTuple, Optional

# D65 white point, the illuminant sRGB is defined against.
WHITE_X, WHITE_Y, WHITE_Z = 0.95047, 1.00000, 1.08883


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    """Parse "#RRGGBB" (or "RRGGBB", or the 3-digit short form) into 0-255."""
    cleaned = value.strip().lstrip("#")

    if len(cleaned) == 3:
        cleaned = "".join(channel * 2 for channel in cleaned)

    if len(cleaned) != 6:
        raise ValueError(f"Not a hex colour: {value!r}")

    try:
        return int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16)
    except ValueError as err:
        raise ValueError(f"Not a hex colour: {value!r}") from err


def _to_linear(channel: int) -> float:
    """Undo the sRGB transfer function. Stored values are gamma-encoded."""
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _pivot(t: float) -> float:
    """The cube-root-with-a-linear-toe used by the XYZ -> Lab conversion."""
    epsilon = (6 / 29) ** 3
    return t ** (1 / 3) if t > epsilon else t / (3 * (6 / 29) ** 2) + 4 / 29


def hex_to_lab(value: str) -> tuple[float, float, float]:
    """Convert a hex colour to CIE Lab (L*, a*, b*) under D65."""
    red, green, blue = hex_to_rgb(value)
    r, g, b = _to_linear(red), _to_linear(green), _to_linear(blue)

    # sRGB -> XYZ, D65.
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_X
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / WHITE_Y
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / WHITE_Z

    fx, fy, fz = _pivot(x), _pivot(y), _pivot(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def ciede2000(lab1: tuple[float, float, float], lab2: tuple[float, float, float]) -> float:
    """Perceptual distance between two Lab colours.

    Roughly: under 1 is invisible, 2-10 is noticeable but related, over 25 reads
    as a different colour entirely, and 100 is the span of the space.
    """
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2

    c1 = math.hypot(a1, b1)
    c2 = math.hypot(a2, b2)
    c_bar = (c1 + c2) / 2

    # Stretch a* so greys are not treated as arbitrarily hued.
    c_bar7 = c_bar**7
    g = 0.5 * (1 - math.sqrt(c_bar7 / (c_bar7 + 25**7))) if c_bar > 0 else 0.0

    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = math.hypot(a1p, b1), math.hypot(a2p, b2)

    def _hue(a: float, b: float) -> float:
        if a == 0 and b == 0:
            return 0.0
        return math.degrees(math.atan2(b, a)) % 360

    h1p, h2p = _hue(a1p, b1), _hue(a2p, b2)

    delta_lp = l2 - l1
    delta_cp = c2p - c1p

    if c1p * c2p == 0:
        delta_hp = 0.0
    else:
        diff = h2p - h1p
        if diff > 180:
            diff -= 360
        elif diff < -180:
            diff += 360
        delta_hp = diff
    delta_big_hp = 2 * math.sqrt(c1p * c2p) * math.sin(math.radians(delta_hp) / 2)

    l_bar_p = (l1 + l2) / 2
    c_bar_p = (c1p + c2p) / 2

    if c1p * c2p == 0:
        h_bar_p = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        h_bar_p = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        h_bar_p = (h1p + h2p + 360) / 2
    else:
        h_bar_p = (h1p + h2p - 360) / 2

    t = (
        1
        - 0.17 * math.cos(math.radians(h_bar_p - 30))
        + 0.24 * math.cos(math.radians(2 * h_bar_p))
        + 0.32 * math.cos(math.radians(3 * h_bar_p + 6))
        - 0.20 * math.cos(math.radians(4 * h_bar_p - 63))
    )

    delta_theta = 30 * math.exp(-(((h_bar_p - 275) / 25) ** 2))
    c_bar_p7 = c_bar_p**7
    r_c = 2 * math.sqrt(c_bar_p7 / (c_bar_p7 + 25**7)) if c_bar_p > 0 else 0.0
    r_t = -math.sin(math.radians(2 * delta_theta)) * r_c

    s_l = 1 + (0.015 * (l_bar_p - 50) ** 2) / math.sqrt(20 + (l_bar_p - 50) ** 2)
    s_c = 1 + 0.045 * c_bar_p
    s_h = 1 + 0.015 * c_bar_p * t

    term_l = delta_lp / s_l
    term_c = delta_cp / s_c
    term_h = delta_big_hp / s_h

    return math.sqrt(term_l**2 + term_c**2 + term_h**2 + r_t * term_c * term_h)


def nearest_palette_color(item_hex: str, palette: list[str]) -> tuple[Optional[str], float]:
    """Closest colour in `palette` to `item_hex`, and the distance to it.

    Unparseable palette entries are skipped rather than fatal — one bad hex in
    the season data should not take the endpoint down.
    """
    item_lab = hex_to_lab(item_hex)

    nearest: Optional[str] = None
    shortest = math.inf

    for candidate in palette:
        try:
            distance = ciede2000(item_lab, hex_to_lab(candidate))
        except ValueError:
            continue
        if distance < shortest:
            nearest, shortest = candidate, distance

    return nearest, shortest


# Anchors mapping CIEDE2000 distance onto a 0-100 score, interpolated linearly
# between them. The breakpoints follow the usual reading of the metric rather
# than being tuned to flatter the palettes: identical, barely perceptible,
# clearly different but related, distant, unrelated.
_SCORE_ANCHORS: list[tuple[float, float]] = [
    (0.0, 100.0),
    (2.0, 92.0),
    (10.0, 70.0),
    (25.0, 45.0),
    (50.0, 20.0),
]

# Agreeing with the season's named colours is worth a nudge, not a verdict: the
# lists carry stylist intent that raw distance cannot see.
NAME_AGREEMENT_BONUS = 6.0

# A garment scoring at or above this is reported as a match. Sits at the
# 10-distance anchor — "clearly different but still related".
MATCH_THRESHOLD = 70.0


def score_from_distance(distance: float) -> float:
    """Map a CIEDE2000 distance onto 0-100, higher being a better match."""
    if distance <= _SCORE_ANCHORS[0][0]:
        return _SCORE_ANCHORS[0][1]

    for (d_low, s_low), (d_high, s_high) in zip(_SCORE_ANCHORS, _SCORE_ANCHORS[1:]):
        if distance <= d_high:
            span = d_high - d_low
            ratio = (distance - d_low) / span if span else 0.0
            return s_low + (s_high - s_low) * ratio

    # Beyond the last anchor the colours are simply unrelated; do not go
    # negative, and keep the floor clear of the match threshold.
    return _SCORE_ANCHORS[-1][1]


class MatchOutcome(NamedTuple):
    is_match: bool
    score: int
    delta_e: float
    nearest_color: str


def score_item_against_season(
    item_hex: str,
    item_color_name: str,
    palette: list[str],
    compatible_color_names: list[str],
) -> MatchOutcome:
    """Score one garment against a seasonal palette.

    Distance to the nearest palette colour is the measurement; the season's
    named colours only nudge the result. Doing it the other way round — names
    first, distance as a tiebreak — is what the app did before, and it could not
    tell a near-miss from an obvious clash because it never looked at the
    colours at all.

    Raises ValueError if the item's colour or the whole palette is unreadable.
    """
    nearest, distance = nearest_palette_color(item_hex, palette)
    if nearest is None:
        raise ValueError("Season palette contains no usable colours")

    score = score_from_distance(distance)

    if item_color_name and item_color_name.casefold() in {
        name.casefold() for name in compatible_color_names
    }:
        # The bonus is capped below 100 so a name agreement cannot claim a
        # perfect match the measurement did not earn — but it must never pull a
        # score down either, or a garment sitting exactly on a palette colour
        # would be marked 99 for the crime of also being named correctly.
        score = max(score, min(99.0, score + NAME_AGREEMENT_BONUS))

    return MatchOutcome(
        is_match=score >= MATCH_THRESHOLD,
        score=round(score),
        delta_e=round(distance, 2),
        nearest_color=nearest,
    )
