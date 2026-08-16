# AI Personal Stylist — frontend

Six working screens (Today, Wardrobe, Outfit Builder, Profile, Add Piece, Colour
Quiz) all reading from one shared store, behind Clerk sign-in with email or
Google. There is still no backend and no database — the wardrobe lives on the
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

Before pushing, check both of these pass:

```bash
npx tsc --noEmit
npx expo lint
```

---

## What is where

```
app/_layout.tsx          fonts, storage, Clerk, and the signed-in/signed-out route split
app/(auth)/              sign-in and sign-up, reachable only while signed out
app/sso-callback.tsx     the Google redirect's landing route — outside both guards
app/(tabs)/_layout.tsx   custom tab bar with the sliding hairline indicator
app/(tabs)/index.tsx     Today    — hero, occasion chips, look rail, Colour DNA, stats
app/(tabs)/wardrobe.tsx  Wardrobe — filters, 2-col masonry, add button, long-press delete
app/(tabs)/builder.tsx   Builder  — three rails, live preview, Surprise me, Save look
app/(tabs)/profile.tsx   Profile  — avatar, Colour DNA, tags, measurements, toggles
app/add-item.tsx         Add Piece modal  — photo picker, category, colour, occasions
app/color-quiz.tsx       Colour Quiz modal — four questions, seasonal palette result

constants/theme.ts       colours, type scale, spacing — the ONLY place for hexes
constants/api.ts         the recommendation service's address and timeout
constants/auth.ts        the Clerk key, and Clerk errors turned into readable text
data/mockWardrobe.ts     20 seed items + the placeholder colour-pairing rules
data/colorSeasons.ts     four seasonal palettes, the quiz questions, computeSeason()
store/useWardrobe.ts     zustand + persist — items, outfits, profile, suggestOutfit(), matchItemToProfile()
hooks/useDisplayName.ts  Clerk's name for the Today greeting and the Profile heading

components/AuthLayout.tsx       the auth shell, field, submit, divider and notice slab
components/GoogleButton.tsx     the Google mark, and the SSO call behind it
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

service/                 the Python recommendation service — see service/README.md
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
- **Corners** — nothing is rounded, with one deliberate exception. The layout
  leans on hairline rules, generous whitespace and small uppercase labels
  instead of cards and pills. The two auth screens are the exception: rounded
  fields, pill buttons and a warmer, browner ink, kept in the `auth` block at
  the bottom of `constants/theme.ts` so the rest of the app cannot drift into
  them by accident. Nothing outside `app/(auth)`, `components/AuthLayout.tsx`
  and `components/GoogleButton.tsx` should import from that block.
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

The real model goes in `service/rules.py#build_outfit`. Nothing in the app needs
to change again for it.

Two integration points are still placeholders:

- `matchItemToProfile()` checks the item's colour name against a hardcoded
  seasonal list in `data/colorSeasons.ts`. It should become a second endpoint on
  the service, scoring the garment properly against the user's analysis.
- `addItem` is where the OpenCV colour-extraction and YOLO categorisation call
  goes once a photo comes in. The hook is marked with a comment in
  `app/add-item.tsx`.

## Status

Done:

- All six screens, wired to the shared store
- The colour analysis feature — quiz, seasonal palettes, per-item match checker
- Full design system and thirteen shared components
- Email and Google sign-in, both verified on a device
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
- No virtual try-on yet.
- The pairing notes and the seasonal palettes are hardcoded rules, not a model.

Being upfront about these reads far better than being caught out.
