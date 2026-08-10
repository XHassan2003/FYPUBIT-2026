"""Placeholder styling rules, ported verbatim from the React Native store.

This is deliberately the same naive logic the app already runs locally
(`store/useWardrobe.ts`). Moving it across unchanged means the first version of
the service produces identical results to the placeholder, so when the app is
switched over to `fetch()` you are only debugging the network layer — not the
network layer and a new model at the same time.

Replace `pick_for_category` and `build_outfit` once that round-trip is proven.
"""

import random
from typing import Optional, Sequence

from models import WardrobeItem

# Mirror of data/mockWardrobe.ts#colorPairings. Keep the two in sync until the
# app stops falling back to its local copy.
COLOR_PAIRINGS: dict[str, list[str]] = {
    "white": ["indigo", "charcoal", "black", "camel", "tan", "olive"],
    "black": ["white", "cream", "camel", "stone", "gold", "grey"],
    "sage": ["cream", "stone", "black", "tan", "white"],
    "cream": ["black", "camel", "plum", "indigo", "brown"],
    "stone": ["black", "denim", "sage", "brown", "white"],
    "indigo": ["white", "cream", "tan", "camel"],
    "charcoal": ["white", "cream", "gold", "black"],
    "olive": ["white", "stone", "tan", "brown"],
    "camel": ["white", "black", "denim", "cream"],
    "denim": ["white", "stone", "tan", "camel"],
    "tan": ["indigo", "white", "olive", "denim"],
    "gold": ["black", "charcoal", "plum"],
    "brown": ["cream", "olive", "stone"],
    "plum": ["cream", "black", "gold"],
    "grey": ["black", "white", "sage"],
}


def pick_for_category(
    items: Sequence[WardrobeItem],
    category: str,
    occasion: str,
    anchor_color: Optional[str] = None,
) -> Optional[WardrobeItem]:
    """Pick one garment of `category`, preferring ones that suit the occasion.

    Falls back to the whole category when nothing matches the occasion, so a
    sparse wardrobe still produces a complete look rather than a gap.
    """
    in_category = [i for i in items if i.category == category and occasion in i.occasions]
    pool = in_category or [i for i in items if i.category == category]
    if not pool:
        return None

    if anchor_color:
        compatible = COLOR_PAIRINGS.get(anchor_color, [])
        matched = [i for i in pool if i.color_name in compatible]
        if matched:
            return random.choice(matched)

    return random.choice(pool)


def build_outfit(
    items: Sequence[WardrobeItem],
    occasion: str,
    include_accessories: bool = True,
) -> list[WardrobeItem]:
    """Assemble a head-to-toe look, colour-anchored on the top."""
    top = pick_for_category(items, "tops", occasion)
    anchor = top.color_name if top else None

    bottom = pick_for_category(items, "bottoms", occasion, anchor)
    shoes = pick_for_category(items, "shoes", occasion, anchor)

    # Outerwear is a coin flip, matching the app's placeholder — a jacket is not
    # always part of a look.
    outerwear = pick_for_category(items, "outerwear", occasion, anchor) if random.random() > 0.5 else None
    accessory = pick_for_category(items, "accessories", occasion, anchor) if include_accessories else None

    return [piece for piece in (top, bottom, shoes, outerwear, accessory) if piece is not None]
