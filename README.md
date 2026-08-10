# AI Personal Stylist — frontend

Six working screens (Today, Wardrobe, Outfit Builder, Profile, Add Piece, Colour
Quiz) all reading from one shared store. No backend, no auth, no Python. That is
deliberate — this is the demo layer. The AI service plugs in later at two
functions.

Built with Expo SDK 54, expo-router, TypeScript and zustand.

---

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. Press `a` for an Android emulator.

Before pushing, check both of these pass:

```bash
npx tsc --noEmit
npx expo lint
```

---

## What is where

```
app/_layout.tsx          fonts + gesture root + stack (both modals are headerless)
app/(tabs)/_layout.tsx   custom tab bar with the sliding hairline indicator
app/(tabs)/index.tsx     Today    — hero, occasion chips, look rail, Colour DNA, stats
app/(tabs)/wardrobe.tsx  Wardrobe — filters, 2-col masonry, add button, long-press delete
app/(tabs)/builder.tsx   Builder  — three rails, live preview, Surprise me, Save look
app/(tabs)/profile.tsx   Profile  — avatar, Colour DNA, tags, measurements, toggles
app/add-item.tsx         Add Piece modal  — photo picker, category, colour, occasions
app/color-quiz.tsx       Colour Quiz modal — four questions, seasonal palette result

constants/theme.ts       colours, type scale, spacing — the ONLY place for hexes
data/mockWardrobe.ts     20 seed items + the placeholder colour-pairing rules
data/colorSeasons.ts     four seasonal palettes, the quiz questions, computeSeason()
store/useWardrobe.ts     zustand + persist — items, outfits, profile, suggestOutfit(), matchItemToProfile()

components/Screen.tsx           screen shell: safe area, scroll, sticky headers, entry fade
components/Sheet.tsx            bottom sheet with drag-to-dismiss
components/ItemSheet.tsx        garment detail + colour match checker, built on Sheet
components/ItemTile.tsx         masonry tile with favourite toggle
components/GarmentThumb.tsx     photo, or the silhouette fallback
components/GarmentSilhouette.tsx flat per-category garment shapes
components/Button.tsx           primary / secondary / ghost
components/Chip.tsx             filter and multi-select chip
components/SectionHeader.tsx    eyebrow + hairline rule + optional action
components/EmptyState.tsx       image, headline, message, action
components/Toggle.tsx           square switch for preferences

assets/images/editorial/  five photographs used by Today, Wardrobe, Builder,
                          Profile and the quiz result
```

## Splitting the work across four people

Every screen imports from the same store and the same theme, so you can work in
parallel without stepping on each other:

| Person | Owns | Files |
| --- | --- | --- |
| A | Today | `app/(tabs)/index.tsx` |
| B | Wardrobe + Add Piece | `app/(tabs)/wardrobe.tsx`, `app/add-item.tsx` |
| C | Outfit Builder | `app/(tabs)/builder.tsx` |
| D | Profile, Colour Quiz + shared components | `app/(tabs)/profile.tsx`, `app/color-quiz.tsx`, `components/`, `constants/` |

One rule: nobody edits `constants/theme.ts` or `store/useWardrobe.ts` on a feature
branch without telling the group. Those two files are the shared contract.

## Design notes (so it stays coherent)

- **Palette** — warm paper (`#F3F0EA`) and sand (`#E9E3D9`) grounds, near-black
  ink for every action, and muted accents (ember, forest) used only to signal
  results. Garment colours are the only other colours on screen; the UI stays
  quiet so the clothes carry the visual weight.
- **Type** — Bodoni Moda for display, Jost for everything else. Headlines are set
  tight; a Didone at 42pt needs the line box pulled in to read as a masthead.
- **Corners** — nothing is rounded. The layout leans on hairline rules, generous
  whitespace and small uppercase labels instead of cards and pills.
- **Signature** — the flat garment silhouettes. They mean the app looks like a
  stylist app with zero photo assets, and they degrade gracefully: the moment an
  item has a real `image`, `GarmentThumb` renders the photo instead.
- **Structure** — the small uppercase eyebrow labels ("Today's look", "Tops") are
  garment-tag language, used only where they name a real category.
- **Motion** — Reanimated throughout: staggered grid entrances, the hero's slow
  scale-in, the animated match score, and a real drag-to-dismiss sheet. Every
  transition shares one easing curve, defined in `constants/theme.ts`.

## Where the real AI plugs in

Two functions in `store/useWardrobe.ts` are placeholders. Replace their bodies
and every screen keeps working unchanged.

`suggestOutfit()` is currently random-with-a-filter:

```ts
suggestOutfit: async (occasion) => {
  const res = await fetch('http://<your-ip>:8000/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: get().items, occasion }),
  });
  return res.json();
}
```

`matchItemToProfile()` currently checks the item's colour name against a
hardcoded seasonal list in `data/colorSeasons.ts`. It should become a call to the
same service, scoring the garment properly against the user's analysis.

Same for `addItem` — that is where the OpenCV colour-extraction and YOLO
categorisation call goes once a photo comes in. The hook is marked with a comment
in `app/add-item.tsx`.

## Status

Done:

- All six screens, wired to the shared store
- The colour analysis feature — quiz, seasonal palettes, per-item match checker
- Full design system and eleven shared components
- Local persistence — the wardrobe survives an app restart
- Typecheck, lint and a production bundle all pass
- Verified on a physical device in Expo Go: added pieces, deletions and the quiz
  result all survive a force-quit

Next: the AI service. See "Where the real AI plugs in" above — that is the whole
remaining project.

## Persistence

The store is wrapped in zustand's `persist` middleware, writing to AsyncStorage
under the key `stylist-wardrobe`. Only `items`, `outfits` and `profile` are
saved — the actions are rebuilt on each launch.

`app/_layout.tsx` holds the splash screen until both the fonts and the store have
loaded, so the app never flashes the seed wardrobe before the saved one arrives.

If you change the shape of the persisted data, bump `version` in the persist
options and add a `migrate` function. Otherwise an already-installed app will
rehydrate into a state the new code does not expect. To wipe storage during
development, uninstall the app or call `useWardrobe.persist.clearStorage()`.

## Known gaps (say these out loud in the demo)

- No auth, no backend, no virtual try-on yet.
- The pairing notes and the seasonal palettes are hardcoded rules, not a model.

Being upfront about these reads far better than being caught out.
