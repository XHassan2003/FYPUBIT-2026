# AI Personal Stylist — frontend

Seven working screens (Home, Style, Wardrobe, Looks, Profile, Add Piece, Colour
Quiz) plus the virtual try-on flow, all reading from one shared store, behind
Clerk sign-in with email or Google. There is still no backend and no database — the wardrobe lives on the
device. That is deliberate; this is the demo layer, and the AI service plugs in
later at two functions.

Built with Expo SDK 54, expo-router, TypeScript, zustand and Clerk.

---

## Run it

Two terminals, both in this folder. Start the service first — if the app asks
for a look before it is listening, you get a four-second pause and the on-device
fallback instead.

```bash
npm run service
```

```bash
npm start
```

Then scan the QR code with Expo Go, or enter the `exp://` address it prints.
Press `a` for an Android emulator.

First time only, or after a fresh clone:

```bash
npm install
```

then the Clerk key below, and the Python environment — see
[service/README.md](service/README.md).

## Authentication

Sign-up, sign-in and sign-out run through [Clerk](https://clerk.com). The app
will not start without a key.

1. Create a free application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Under **User & authentication**, enable **Email address**, **Username** and
   **Password**, with email verification by **code**. Turn **Phone number**
   off — anything left marked *required* that the sign-up form does not collect
   will stop an account from ever completing, and the failure only shows up
   after the emailed code has been accepted.
3. Leave **Username** enabled but **not required**. Google returns an email and
   a name, never a username, so a required username stops every Google sign-up
   from completing — see the warning under "Continue with Google" below.
4. Under **SSO connections**, enable **Google**. Development instances use
   Clerk's shared OAuth credentials, so there is nothing to set up on the Google
   side to test. Production needs your own Google OAuth client.
5. Copy `.env.example` to `.env` and paste the **publishable key** into
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
6. Restart the dev server — env values are inlined at bundle time.

The publishable key is public by design and ends up in the app bundle either
way, so it is safe to share within the team. `.env` is gitignored so nobody
commits one by accident; the secret key (`sk_…`) must never go in this project.

```
app/(auth)/sign-in.tsx      email or username, + password, + Continue with Google
app/(auth)/sign-up.tsx      email, username, password, then the emailed code
app/sso-callback.tsx        where the Google redirect lands
components/AuthLayout.tsx   the shell, field and submit button both screens are built from
components/GoogleButton.tsx the Google mark and the SSO call
constants/auth.ts           reads the key, and turns Clerk errors into readable text
hooks/useDisplayName.ts     the name Today and Profile greet you by
```

Sign-in takes either identifier, so nobody has to remember which one they used.

### Continue with Google

Both screens offer Google below the email form. It runs Clerk's browser-based
SSO — `useSSO` from `@clerk/expo/experimental`, which needs `expo-auth-session`
(already a dependency). The native Google SDK would be faster but needs a custom
dev client, and this project is demoed through Expo Go.

The experimental import is the right one, not an oversight: it is the Core 3
API, matching the `signIn.password()` / `finalize()` calls the email flow
already uses. It activates the session itself, so nothing navigates from the
button — `app/_layout.tsx` is watching `isSignedIn` and moves on its own.

Two things will bite whoever sets this up fresh:

- **Username must not be required.** Google never supplies one, so a required
  username leaves the transferred sign-up at `missing_requirements` and no
  session is ever created. What you see is a blank screen, not an error.
  `components/GoogleButton.tsx` logs `missingFields` to Metro when this happens,
  which names the offending field outright.
- **`app/sso-callback.tsx` has to exist, outside both route guards.** The flow
  redirects to `…/--/sso-callback`; Android delivers that URL to the app as a
  deep link as well as to the auth session, and expo-router answers it by
  looking for a matching route. Without the file you get "Unmatched Route" over
  the top of a sign-in that is otherwise working. It sits outside
  `Stack.Protected` because the redirect arrives in the moment between signed
  out and signed in, and has to be routable in both.

The display name follows from this. `hooks/useDisplayName.ts` prefers Clerk's
`fullName`, then `firstName`, `username`, and the email's local part, falling
back to the seeded profile name last. It is derived on each render rather than
copied into the store — the store is persisted, so a copy would outlive the
session and greet the next person by the last person's name.

Profile's avatar works the same way, in order: a photo picked in the app, then
the Google account's picture, then the initial on ink. It tests `user.hasImage`
rather than `user.imageUrl`, because `imageUrl` is *always* populated — Clerk
generates an initials avatar when there is no real photo, and rendering that
would quietly replace our fallback with one in someone else's palette.

Routing is gated in `app/_layout.tsx` with `Stack.Protected`: the tabs and both
modals are unreachable while signed out, and the auth screens are unreachable
while signed in. expo-router clears the history on each switch, so the back
gesture cannot cross the boundary. Sign out lives at the bottom of Profile.

**The wardrobe is still stored per-device, not per-account.** Signing in does not
fetch anyone's data — that needs the backend, which does not exist yet. Two
accounts on one phone currently see the same wardrobe.

⚠️ **Fast Refresh does not reliably pick up changes to `components/ItemSheet.tsx`.**
It is handed to `Screen` as the `overlay` prop rather than rendered inline, and
React Refresh quietly keeps the old version — the app looks like it ignored your
edit. This has already cost one debugging session chasing a bug that was not
there. After editing it, reload properly (`r` in the Metro terminal, or restart
with `npx expo start --clear`) before concluding anything.

Before pushing, check both of these pass:

```bash
npx tsc --noEmit
npx expo lint
```

If you touched anything under `service/`, run its suite too — from that folder,
and it takes under a second:

```bash
pytest
```

---

## What is where

```
app/_layout.tsx          fonts, storage, Clerk, and the signed-in/signed-out route split
app/(auth)/              sign-in and sign-up, reachable only while signed out
app/sso-callback.tsx     the Google redirect's landing route — outside both guards
app/try-on.tsx           Virtual try-on — the five steps, in order
app/(tabs)/_layout.tsx   tab bar — four tabs around the raised try-on button
app/(tabs)/index.tsx     Home     — try-on landing: hero, the two steps, piece rail, last look
app/(tabs)/style.tsx     Style    — hero, occasion chips, look rail, Colour DNA, stats
app/(tabs)/wardrobe.tsx  Wardrobe — filters, 2-col masonry, add button, long-press delete
app/(tabs)/builder.tsx   Looks    — three rails, live preview, Surprise me, Save look
app/(tabs)/profile.tsx   Profile  — avatar, Colour DNA, tags, measurements, toggles
app/add-item.tsx         Add Piece modal  — photo picker, category, colour, occasions
app/color-quiz.tsx       Colour Quiz modal — four questions, seasonal palette result

constants/theme.ts       colours, type scale, spacing — the ONLY place for hexes
constants/api.ts         the recommendation service's address and timeout
constants/auth.ts        the Clerk key, and Clerk errors turned into readable text
data/mockWardrobe.ts     20 seed items + the placeholder colour-pairing rules
data/colorSeasons.ts     four seasonal palettes, the quiz questions, computeSeason()
store/useWardrobe.ts     zustand + persist — items, outfits, profile, suggestOutfit(), matchItemToProfile()
store/useTryOn.ts        the try-on in progress — shared by Home and the flow, not persisted
hooks/useDisplayName.ts  Clerk's name for the Style greeting and the Profile heading
hooks/useGarmentAnalysis.ts  pick, resize and read a garment photo

components/AuthLayout.tsx       the auth shell, field, submit, divider and notice slab
components/GoogleButton.tsx     the Google mark, and the SSO call behind it
components/PhotoAnalysis.tsx    what the analyser read off the photo, and that it is editable
components/TryOnSteps.tsx       the try-on's four visible steps, kept together like AuthLayout
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

assets/images/editorial/  six photographs used by Home, Style, Wardrobe, Looks,
                          Profile and the quiz result

service/                 the Python service — /recommend, /match, and the colour maths
                         behind them; see service/README.md
```

## Splitting the work across four people

Every screen imports from the same store and the same theme, so you can work in
parallel without stepping on each other:

| Person | Owns | Files |
| --- | --- | --- |
| A | Style + Home | `app/(tabs)/style.tsx`, `app/(tabs)/index.tsx` |
| B | Wardrobe + Add Piece | `app/(tabs)/wardrobe.tsx`, `app/add-item.tsx` |
| C | Looks + Virtual try-on | `app/(tabs)/builder.tsx`, `app/try-on.tsx`, `components/TryOnSteps.tsx` |
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
- **Corners** — nothing is rounded, with one deliberate exception. The layout
  leans on hairline rules, generous whitespace and small uppercase labels
  instead of cards and pills. The two auth screens are the exception: rounded
  fields, pill buttons and a warmer, browner ink, kept in the `auth` block at
  the bottom of `constants/theme.ts` so the rest of the app cannot drift into
  them by accident. Nothing outside `app/(auth)`, `components/AuthLayout.tsx`
  and `components/GoogleButton.tsx` should import from that block.
- **Heroes are one file each**, named for the screen they serve. Swapping one is
  a file replacement, not a code change. What the slot on Home wants, if it is
  ever changed again: portrait, a person full length, room at the top for the
  wordmark. The ink gradient covers the lower 78%, so anything below the waist
  reads as texture behind the headline rather than as subject.
- **Signature** — the flat garment silhouettes. They mean the app looks like a
  stylist app with zero photo assets, and they degrade gracefully: the moment an
  item has a real `image`, `GarmentThumb` renders the photo instead.
- **Structure** — the small uppercase eyebrow labels ("Today's look", "Tops") are
  garment-tag language, used only where they name a real category.
- **Motion** — Reanimated throughout: staggered grid entrances, the hero's slow
  scale-in, the animated match score, and a real drag-to-dismiss sheet. Every
  transition shares one easing curve, defined in `constants/theme.ts`.

## Where the real AI plugs in

`suggestOutfit()` is **wired**. It POSTs the wardrobe to the Python service at
`/recommend` and returns whatever comes back. If the service cannot be reached
within `API_TIMEOUT_MS`, it logs a warning and styles the look on-device with the
old rule instead — so a sleeping laptop or a dropped network degrades the
suggestion rather than breaking the screen.

The address is worked out at runtime in `constants/api.ts` — no IP to edit. In
development the app takes the host Metro is serving it from, which is the same
machine running the service, and points at port 8000 there. Change network,
change laptop, hand the repo to a teammate: it follows.

To point somewhere else — a deployed service, or one hosted by someone else on
the team — set `EXPO_PUBLIC_API_URL` in a `.env` file and it wins:

```
EXPO_PUBLIC_API_URL=http://10.0.0.5:8000
```

Two cases resolve to no address: a production build with no override, and
`--tunnel` (where the service is not reachable at Metro's host anyway). Both fall
back to on-device styling rather than failing.

`build_outfit` is no longer a placeholder either. It shortlists per category,
scores candidate outfits on colour harmony between the pieces, fit to the
user's season and occasion suitability, and returns one of the best few — the
shortlist rather than the single winner, so "Surprise me" still surprises. The
user's season is sent with every `/recommend` call and feeds the second of
those terms. See [service/README.md](service/README.md) for the weights and the
reasoning.

**The offline fallback is the weak half, and says so.** `buildLocalOutfit()` in
the store still runs the old random-within-category rule when the service
cannot be reached, which is no longer equivalent to what the service does.
`suggestOutfit()` therefore returns `{ items, styledOffline }` rather than a
bare array, and Today shows a "Styled offline" note above the look when the
flag is set. The flag travels with the result instead of living in the store,
so it cannot go stale against the look on screen.

The match checker does the same, through `scoredOffline` on `MatchResult`, but
it goes further: offline it shows **no percentage at all**. The in-or-out
verdict there is still real — it comes from the season's own list of colour
names — but the number is `pseudoScore()`, a hash of the item's id, and a
fabricated figure reads as more authoritative than a measured one. So the
verdict stays, the number and its bar are hidden, and a note says why.

`matchItemToProfile()` is **wired too**, and unlike `/recommend` the thing behind
it is not a placeholder. It POSTs the garment and the user's season to `/match`,
where `service/color.py` converts both to CIE Lab and measures the CIEDE2000
distance to the nearest colour in the palette. Same fallback contract as
`suggestOutfit()`: unreachable or slow, and it scores on-device instead.

The season travels in the request rather than being duplicated in Python, so
`data/colorSeasons.ts` stays the only definition of the palettes. See
[service/README.md](service/README.md) for how the score is derived — it is the
part of this project most worth being able to explain out loud.

What that replaced is worth knowing, because the fallback still does it: the old
score was `pseudoScore()`, a hash of the item's id scaled into a flattering
range. Stable per garment, and entirely meaningless.

**Photo analysis is wired too**, through Gemini rather than the OpenCV and YOLO
the project eventually wants. Pick a photo in Add Piece and the form fills
itself in: name, brand, category, occasions and colour. Gemini identifies the
garment and its true colour; `service/color.py` decides which of the app's
swatches that colour is, so the one part of the answer that has to match the
rest of the wardrobe is measured rather than named by a model.

It needs a Gemini API key in `service/.env` — see
[service/README.md](service/README.md). The key stays on the service for a
reason: anything `EXPO_PUBLIC_*` is inlined into the app bundle, and this one is
billable.

Three rules it follows, all worth keeping if the model behind it changes:

- **It only fills fields the user has not answered.** A suggestion never
  overwrites a deliberate choice.
- **It leaves out what it could not determine.** Every field is optional; an
  empty picker costs one tap, a confidently wrong one costs trust.
- **There is no fallback.** Nothing on the device can read a photograph, so a
  failure is reported and the form is filled in by hand, exactly as before.

Swapping in OpenCV and YOLO later is a change to `service/vision.py` alone —
the endpoint, the shapes and the app wiring stay as they are.

**Virtual try-on is built too**, also on Gemini for now. "Try it on" in the
Builder opens a five-step flow: your photograph, the pieces you want to see,
a last look at both, the wait, and the result. `app/try-on.tsx` holds the order
things happen in, `components/TryOnSteps.tsx` the drawing, `hooks/useTryOn.ts`
the work — picking, resizing, encoding every garment, and writing the result to
a file so it can be shared and saved against the look.

Only pieces **with a photograph** can be tried on, and only six at a time. The
generator works from images: a silhouette tells it nothing about the garment.

Be careful how this one is described. A purpose-built try-on model warps a
specific garment onto a specific body; this asks a general image model to
compose a new photograph from references. The result usually looks *plausible*
rather than *accurate*, and faces drift. It demonstrates the idea — it is not a
fitting room, and saying so first is much better than being caught out.

## Status

Done:

- All seven screens plus the try-on flow, wired to the shared store
- Virtual try-on moved to the centre of the app: Home is the landing, and the
  tab bar's raised button opens it from anywhere
- The colour analysis feature — quiz, seasonal palettes, per-item match checker
- Full design system and fifteen shared components
- Email and Google sign-in, both verified on a device
- Real colour matching — CIEDE2000 in CIE Lab, served from `/match`, and checked
  end-to-end from a device: the same garment scores differently against two
  seasons, which the old hashed score could not do
- Outfit selection by scoring rather than sampling — harmony, season and
  occasion, served from `/recommend`
- Garment photo analysis through Gemini, checked against real photographs: a
  cream wool coat shot against a cream wall came back "Wool Overcoat",
  outerwear, cream, with the detected colour 1.6 from the swatch it was
  snapped to
- Both offline fallbacks say so on screen, checked on a device with the service
  stopped: Today shows "Styled offline", and the match checker drops the
  percentage entirely rather than showing a hashed one
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

- Accounts exist, but nothing is stored against them. The wardrobe is still
  per-device — that needs a backend and a database.
- Virtual try-on composes a new photograph rather than fitting a garment to a
  body. Plausible, not accurate — and **not yet run end to end**, because the
  Gemini quota ran out before it could be.
- Outfit selection is a scoring function, not a learned model. It measures real
  colour relationships, but the weights behind it were reasoned about and
  sanity-checked against the seed wardrobe, not fitted to anyone's preferences.
  Say "rule-based, but measured" rather than letting it be heard as "AI".
- The seasonal palettes themselves are still authored by hand. The scoring
  against them is measured, but which six colours make up "True Winter" is a
  designer's list, not an analysis.
- **Web does not run.** iOS and Android are fine; `npx expo export` produces a
  web bundle too, and it builds, but it throws
  `Cannot use 'import.meta' outside a module` before rendering anything. The
  generated `index.html` loads the bundle as a classic script while zustand's
  devtools middleware — pulled in alongside `persist` from `zustand/middleware` —
  ships `import.meta.env`. Only mention web if someone asks.

Being upfront about these reads far better than being caught out.
