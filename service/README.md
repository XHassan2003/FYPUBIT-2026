# Recommendation service

The Python half of the project. Five endpoints, all doing real work now:
`/match` scores one garment against the user's seasonal palette and
`/recommend` assembles a whole outfit, both measuring colour in CIE Lab rather
than looking it up in a table; `/analyse` reads a garment out of a photograph;
and `/try-on` fits one onto the wearer with FASHN v1.6.

## Setup

Needs Python 3.10 or newer. From this folder:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS or Linux the activate line is `source .venv/bin/activate`.

To run the tests as well, add the dev dependencies:

```bash
pip install -r requirements-dev.txt
```

### The API keys

Two, one per model-backed endpoint. `/recommend` and `/match` need neither —
they are our own maths and work offline.

```bash
cp .env.example .env
```

| Key | Endpoint | Where from |
| --- | --- | --- |
| `GEMINI_API_KEY` | `POST /analyse` — reading a garment from a photo | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `FAL_KEY` | `POST /try-on` — FASHN v1.6 | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |

Both are **secrets**, unlike the app's Clerk publishable key. That is why these
calls live here rather than in the app: anything named `EXPO_PUBLIC_*` is
inlined into the bundle at build time and can be read out of a shipped app, and
both of these are billable. `service/.env` is gitignored.

Missing either one returns **503** from that endpoint rather than 500 — it is a
setup problem, not a failure, so the app says "not set up yet" instead of asking
the user to try again. The other endpoint keeps working; the keys are
independent.

To check them without running a model or spending anything:

```bash
python tools/check_keys.py
```

Worth it because a missing key, a key fal does not recognise, and an account
with no balance left all arrive as the same 503, and they need different fixes.
That tool tells them apart and prints no part of a key, so its output is safe to
share.

⚠️ **Put keys in `.env`, never in `.env.example`.** Only `.env` is gitignored.
The template is committed, so a key pasted there is a key that ships with the
project — and the fix then is to rotate it, not just delete the line.

⚠️ **The free tier's quota is small enough to hit while demoing.** Analysing a
handful of photos in quick succession earns a `429`, which `/analyse` passes
through as `429` so the app can say "wait a moment" rather than blaming the
photo. Two things make this confusing if you do not know to expect it:

- The SDK retries internally with backoff before surfacing the error, so a
  rate-limited call can take **60-90 seconds to fail** rather than failing at
  once. A healthy call takes about **6 seconds**.
- Once the quota is gone, every call fails fast with 429 until it resets.

If analysis is suddenly slow and then fails, check the quota before suspecting
the photo or the code.

**A trap if you ever touch the error handling.** The Interactions API raises
from `google.genai._gaos.lib.compat_errors`, and those exceptions do **not**
inherit from `google.genai.errors.APIError` — there are two unrelated classes
of that name, so `isinstance` against the one you would naturally import is
simply `False`. They also carry the status on `status_code`, where the older
hierarchy uses `code`. Getting either wrong sends every quota error through as
a generic failure, and the app then tells the user their photograph is the
problem. `_raise_for` in `vision.py` reads both attributes and matches on
neither class; `test_vision.py` pins the behaviour with fakes for both shapes.

## Run

From the project root, once the environment above exists:

```bash
npm run service
```

That wrapper exists so nobody has to remember `--host 0.0.0.0`, which is not
optional — the default binds to localhost only, and your phone is a different
machine, so it will simply time out. It is the single most common thing to get
stuck on.

To run uvicorn directly instead, from this folder:

```bash
.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On macOS or Linux that path is `.venv/bin/python`.

Interactive API docs are at `http://localhost:8000/docs` once it is running. You
can fire a test request from there without touching the app.

## Check the phone can reach it

Find this machine's LAN address (`ipconfig` on Windows, `ifconfig` on macOS),
then open `http://<that-ip>:8000/health` in your phone's browser. You should see
`{"status":"ok"}`.

If it hangs, in order of likelihood: Windows Firewall is blocking inbound
connections to Python, the phone is on a different network (guest Wi-Fi is a
common culprit), or you forgot `--host 0.0.0.0`.

## Endpoints

`GET /health` — returns `{"status": "ok"}`. Use it to prove connectivity.

`POST /recommend` — takes the wardrobe and an occasion, returns the look:

```json
{
  "items": [ /* WardrobeItem[], exactly as the app stores them */ ],
  "occasion": "work",
  "includeAccessories": true,
  "season": { /* the same shape /match takes, or null */ }
}
```

`season` is optional — the user may not have taken the colour quiz, and an
older build of the app will not send it. When it is absent the season term
abstains and the outfit is chosen on harmony and occasion alone.

`POST /analyse` — reads a garment from a photograph:

```json
{
  "image": "<base64, no data: prefix>",
  "mimeType": "image/jpeg",
  "categories": ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"],
  "occasions": ["work", "casual", "date night", "workout", "formal"],
  "swatches": [{ "hex": "#B08968", "name": "camel" }]
}
```

```json
{
  "name": "Wool Overcoat", "brand": "Hartley Row", "category": "outerwear",
  "occasions": ["work", "formal"],
  "color": "#B08968", "colorName": "camel",
  "detectedColor": "#AD8564", "deltaE": 3.4
}
```

**Every field is optional.** A model that cannot tell what colour something is
should leave the picker alone rather than guess — an empty field costs one tap,
a confidently wrong one costs trust. The app only fills in fields the user has
not already answered.

`POST /try-on` — fits the chosen garment onto the wearer's photograph:

```json
{
  "person": "<base64>",
  "personMimeType": "image/jpeg",
  "garments": [
    { "image": "<base64>", "mimeType": "image/jpeg", "name": "Wool Overcoat", "category": "outerwear" }
  ]
}
```

```json
{ "image": "<base64 png>", "mimeType": "image/png" }
```

**One garment** (`MAX_GARMENTS`), and that is the architecture rather than a
setting — see "How the try-on works" below. `garments` stays a list because the
request shape predates the model change and there was no reason to break it;
sending more than one is refused before anything is spent.

`category` decides which region of the body is inpainted, so it is **required**
now — it is not a label for a prompt any more. Only `tops`, `bottoms`,
`dresses` and `outerwear` can be worn; `shoes` and `accessories` are refused by
name, for free, because the model was never trained on them.

⚠️ **This is the expensive endpoint** — a diffusion model, not a read. The app
allows it 270 seconds (`TRY_ON_TIMEOUT_MS`) against roughly 25 for analysis, and
the service gives up at 240 (`CLIENT_TIMEOUT_S`) so that it is the one that
explains why rather than the phone timing out on silence. Both are generous on
purpose: giving up does not cancel the job, which keeps running on fal and is
billed either way, so a tight ceiling spends the money and discards the result.

Note the response is **PNG**, which is what fal returns. The app reads
`mimeType` rather than assuming — a PNG named `.jpg` is a file some share
targets refuse to open.

### How the try-on works

`tryon.py`. **FASHN Virtual Try-On v1.6**, hosted on fal as
`fal-ai/fashn/tryon/v1.6`.

### Why this model, and what it replaced

Three models have held this endpoint, and each swap fixed a specific failure.

**Gemini** composed a new photograph from references — plausible rather than
accurate, and faces drifted, because nothing in the method required the output
to contain the same person as the input.

**CatVTON** ([ICLR 2025](https://arxiv.org/abs/2407.15886)) fixed that by
treating try-on as inpainting: only the masked garment region is regenerated, so
face, hair, pose and background survive untouched. A real try-on model and a
large step up. Two things kept biting:

- It wants the garment as a **flat product shot**. Handed a photograph of a
  *person wearing* the item it has to separate garment from wearer first, and
  the result came back smeared. That ruled out most garment pictures on the
  internet, and it is why the South Asian formalwear in the seed wardrobe read
  worse than the hanger-shot shirts beside it.
- 768x1024, and fine detail did not survive — an Oxford shirt came back the
  right colour and shape with no collar and no buttons.

**FASHN v1.6** targets both. It is trained to preserve garment text and print,
and it takes a `garment_photo_type` control that accepts **on-model photographs
as well as flat-lay** ones. That second point is the reason for the swap: a
garment picture from a retailer's site or a search result now works as a
reference, instead of only clothes photographed on a hanger.

Measured on the same lilac shalwar kameez — an editorial photo of a model
wearing it, the exact case CatVTON was worst at:

| | CatVTON | FASHN v1.6 |
| --- | --- | --- |
| result | shapeless drape, hand smeared | correct colour, embroidery legible, full-length one-piece |
| time | 64s | 19s |
| output | 768x1024 | 1024x1280 |

**⚠️ The documented output size is wrong.** fal says 864x1296. Measured, two
runs against a 1024-wide person photograph both returned **1024x1280** — the
person image's own size. The output tracks the input, so `PERSON_EDGE` in
`store/useTryOn.ts` is what actually sets the resolution. The lever is on the
app side, not here.

**Hosted, not local.** One HTTPS call, no GPU, no CUDA. The trade is a
per-generation cost and a network dependency, which is the trade this endpoint
already made with Gemini, so nothing about the deployment changed.

### The knobs that are set, and why

| argument | value | reasoning |
| --- | --- | --- |
| `mode` | `quality` | fal defaults to `balanced`. Accuracy is the reason for being on this model at all, so the slower path is the point. Drop to `balanced` if generations feel long; `performance` gives up most of what was gained. |
| `garment_photo_type` | `auto` | Both kinds are in play and the app cannot tell them apart — the seed mixes hanger shots with editorial photos, imported clothes are flat-lays, and anything saved off a shop's site is on a model. Pinning either value would ruin the other half. |
| `category` | from the wardrobe | FASHN offers `auto`, which infers from the image. Deliberately unused: the wardrobe already *knows* what each piece is, and letting the model re-guess trades a fact for a prediction that is wrong expensively and silently. |
| `output_format` | `png` | Lossless. The point of this model is that fine detail survives; re-encoding to JPEG would spend the quality just paid for. |

### Whole outfits, by chaining

A top **and** a bottom, which the model cannot do in one call. Two passes: the
bottom half first, then the top, with the first pass's output becoming the
second pass's person. The intermediate travels as fal's own URL rather than
being downloaded and re-uploaded — it is already on their CDN.

Bottoms first is not arbitrary. The last pass is drawn freshest, and at the
waist the top overlaps the bottom; running tops last lets a shirt fall over a
waistband instead of having trousers drawn on top of a placed shirt.

**This reverses an earlier decision.** Under CatVTON chaining was rejected
outright — its output was rough enough that feeding it back in compounded every
artifact. FASHN's is clean enough to survive the round trip, which is what makes
it viable now and did not before.

**Measured, on the same photograph:**

| outfit | time | result |
| --- | --- | --- |
| plain polo + tailored trousers | 45s | both garments clean, nothing bled |
| dip-dye shirt + jeans | 57s | the shirt's print ran down the legs |
| the same, `segmentation_free` off | 46s | worse — the trousers became a skirt |

The variable is the garment, not the chaining. A loud all-over print gives pass
two something to smear, and because pass two's canvas *is* pass one's output,
nothing downstream can correct it — errors accumulate rather than average out.
Ordinary clothes chain fine.

`segmentation_free` was tried at `false` on exactly that reasoning: an explicit
mask should confine each pass to its own half. It did not, and cost shape
accuracy as well, so it is left at fal's default. Recorded so nobody spends the
same two generations rediscovering it.

**Two passes are two generations**, billed and waited for. The confirm step says
so before the user spends it.

**What it cannot do**, all enforced before a request is sent:

- **One garment per body region.** A shirt and a coat both want the upper body,
  and FASHN has one upper-body category — the second pass would paint over the
  first and the generation spent on it would vanish. A one-piece cannot be
  combined at all, since it already covers what a pair of trousers wants.
- **Clothes only, in three categories.** Shoes, bags and jewellery are not
  categories it has, so there is no setting that would make it try.
  `FASHN_CATEGORIES` is a whitelist:

  | wardrobe category | FASHN `category` |
  | --- | --- |
  | `tops` | `tops` |
  | `bottoms` | `bottoms` |
  | `dresses` | `one-pieces` — one pass over the whole body |
  | `outerwear` | `tops` — **see the regression below** |
  | `shoes`, `accessories` | *refused* |

  `dresses` covers anything worn as a single piece from shoulder to hem — a
  shalwar kameez, a kurta, a sari, a lehenga, a western dress. `one-pieces` is
  not a nicety: mapping one of these to `tops` fits the upper half of the
  garment and leaves the wearer's own trousers showing underneath.

- **⚠️ No outerwear category, and this is a regression.** CatVTON had an `outer`
  cloth type that layered a coat *over* what the person already wore. FASHN has
  three categories and none of them is outerwear, so a coat maps to `tops` and
  **replaces** the top instead of going over it. It is the only thing this swap
  made worse, and it is worth knowing before demoing a blazer over a shirt and
  wondering where the shirt went.

  An unknown category is refused too rather than defaulted to `upper`, which
  would put trousers on someone's chest — and finding that out costs a
  generation. The app knows the same list (`TRY_ON_CATEGORIES` in
  `data/mockWardrobe.ts`) so the picker never offers a piece that would be
  refused; the service's check is the backstop, not the only line of defence.

**The input photograph decides the result**, more than any setting here. This
was measured, not guessed — the same Oxford Shirt, the same model, the same
code, two photographs:

| person photo | time | result |
| --- | --- | --- |
| editorial crop — subject small in frame, chest-up, heavy coat | 64s | shapeless drape, hand smeared, no collar |
| studio shot — full length, front on, plain wall, fitted top | 11s | clean white top, face/hair/trousers/shoes/background all intact |

The rule is whatever VITON-HD and DressCode look like: **one person, head to
foot, front on, plain background, not already in something bulky.** Break it and
the human parser produces a poor mask, and a poor mask is what turns a shirt
into a blob. `TRY_ON_DEMO_PHOTO` in `store/useTryOn.ts` obeys it deliberately —
read the comment there before swapping that image for a prettier one.

Even at its best, **fine garment detail does not survive**: colour and
silhouette transfer, collars and buttons do not. That is worth being straight
about — "see how it looks on you", not "see how it fits".

**Images go up as data URIs** rather than being uploaded to storage first. That
is two fewer round trips, two fewer things to fail, and the user's photograph is
not left sitting in a bucket. The result comes back as a public URL, which the
service **downloads and re-encodes** rather than passing through: the app
already writes base64 straight to a file, and an unauthenticated link to a
photograph of the user is better not leaving this process.

### How the photo is read

`vision.py`, and the split is the point:

- **Gemini** answers what only a model can — what garment is this, what would
  you call it, when would you wear it, and what colour is it *actually*. It is
  asked for a free `#RRGGBB` hex, never for a colour name.
- **`color.py`** then decides which of the app's swatches that hex is, by
  CIEDE2000 distance. The one part of the answer that has to line up with the
  rest of the wardrobe is therefore deterministic, explainable, and not left to
  a model's choice of adjective. `detectedColor` and `deltaE` come back too, so
  "camel" is checkable against what was actually seen.

Categories and occasions are **enums in the response schema**, so the model
cannot invent a sixth category the app has no screen for. Generation is
constrained; the answer is then checked again in `_to_garment` anyway, because
a schema constrains but does not guarantee, and this is the boundary where a
wrong value would become a wardrobe item.

The app resizes to 1024px before sending. Gemini bills images in 768px tiles,
so a 4000px phone photo costs more, uploads slower, and says nothing extra
about what a garment is.

### How the outfit is chosen

`rules.py`. Candidate outfits are built and scored; one of the best is
returned.

1. **Shortlist per category.** Garments meant for the occasion always beat
   garments that merely could be worn — running shoes are not office shoes
   because they happen to be the right grey. The rest of a category is only
   reached when nothing in it suits, so a sparse wardrobe still produces a
   complete outfit rather than a gap. Ten per category survive.

   **Ties are broken at random, and that is a fix rather than a flourish.** They
   used to be broken by `item.id`, which sounds harmless until you notice ties
   are the normal case: with no colour season recorded every garment scores
   NEUTRAL, so merit collapses to the occasion term and everything suitable ties
   exactly. The cap then meant "the ten alphabetically first" — the same ten
   forever. Seed pieces are `top-1`; the app names a user's piece
   `${category}-${Date.now()}`, so `tops-1757…`, and `-` sorts before `s`. Past
   ten seeded tops, **a user's own clothes could never be recommended at all.**
   Shuffle then stable-sort keeps the ranking and removes the arbitrary cut.

   **`dresses` is the exception: it is shortlisted strictly.** A wardrobe with
   no workout trousers still needs trousers, so `bottoms` falls back to whatever
   exists. A one-piece garment is not a slot that must be filled — it is an
   alternative shape — so when none suits the occasion the right answer is to
   offer no dress core and let separates carry the outfit. Without that a
   lehenga turns up at the gym purely for being the only thing in its category.
   The fallback still applies when there are no separates at all: an unsuitable
   dress beats no outfit.
2. **Build cores in both shapes.** Either **top + bottom + shoes**, or
   **dress + shoes** — where "dress" is any one-piece garment: a shalwar kameez,
   a kurta, a sari, a lehenga, a western dress. Both shapes go into one ranking
   and compete directly, which is the only honest comparison: a dress is not a
   better top, it is a different answer to the same question.

   Cores made of nothing but shoes are dropped. The separates shape produces one
   whenever the wardrobe has shoes and no top or bottom, and while that was the
   only core available it was harmless — but with a dress core beside it, a lone
   pair of shoes can score inside the tolerance band and be recommended
   *instead* of the dress.
3. **Score each core** on three terms:
   - **colour harmony**, 45% — every piece against every other, not everything
     against the top
   - **season fit**, 35% — the same measurement `/match` returns
   - **occasion fit**, 20% — close to a hard filter already, so it trails
3. **Choose from the best few.** Not the single best: that would make the same
   wardrobe and occasion produce the same answer forever, and "Surprise me"
   static. Cores within two points of the leader share the choice, so variety
   only ever comes from outfits that are genuinely close.
5. **Add outerwear and an accessory** only if they earn a place against the
   chosen core, and only from garments meant for the occasion. A coat that
   merely does not clash is not a reason to carry a coat, and a blazer has no
   business over gym clothes however well it matches them. Both layer over a
   dress core exactly as they do over separates — a coat over a kameez is an
   ordinary thing to wear.

Scoring the core as a set is what fixes the old anchoring bug, where a shirt
could suit both the trousers and the shoes while those two clashed with each
other.

**One quirk of comparing the two shapes**, worth knowing before defending the
output. Harmony is the mean over every *pair* of pieces, and a dress-and-shoes
core has one pair where a three-piece core has three. A single pair does not
regress toward the middle the way three do, so dress cores land at the extremes
more often — excellent when those two colours sing, poor when they clash. That
is variance rather than bias; the averaging in `_score_set` already stops a
shorter core from being rewarded merely for being short.

**Harmony is not "closer is better".** Matching a garment to a palette wants
distance minimised; two garments worn together do not. An outfit in one flat
colour is not the best possible outfit and the most distant colour is usually a
clash. `color.py#harmony_score` works in LCh: below a chroma threshold a colour
behaves as a neutral and goes with anything, and above it, hues that are
close (within 30°) or near-opposite (beyond 150°) read well while the middle is
the clash zone. Lightness separation is worth the remaining 35%.

**Speed.** Brute force over the shortlists, with the two expensive measurements
memoised per call. A 200-item wardrobe takes about 13ms per outfit — nowhere
near the app's 4-second timeout. The cache matters: without it the same call
took 192ms, because the season score was being recomputed for every candidate.

The response is a JSON array of the items that make up the outfit — a subset of
what was sent in, in wearing order: either top, bottom, shoes or a one-piece
garment and shoes, then optionally outerwear and an accessory.

`POST /match` — scores one garment against the user's colour season:

```json
{
  "item": { /* a single WardrobeItem */ },
  "season": {
    "id": "winter",
    "name": "True Winter",
    "palette": ["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"],
    "compatibleColorNames": ["black", "white", "indigo", "charcoal", "plum", "grey"]
  }
}
```

```json
{ "isMatch": false, "score": 45, "deltaE": 25.16, "nearestColor": "#6E6A62" }
```

The season is sent with the request rather than stored here, so
`data/colorSeasons.ts` stays the single definition of the palettes. An
unreadable colour or an empty palette returns 422, not 500 — that is a bad
request, not a server fault.

### How the score is worked out

`color.py`, and it is worth being able to explain in a viva:

1. Both the garment's hex and every palette hex are converted sRGB → linear RGB
   → CIE XYZ (D65) → **CIE Lab**. Lab exists because RGB distance does not match
   human vision — the same numeric gap is glaring in one part of the space and
   invisible in another.
2. The distance from the garment to each palette colour is measured with
   **CIEDE2000**, which corrects Lab's own remaining unevenness around hue,
   chroma and the blues. The nearest palette colour wins.
3. That distance maps onto 0–100 through the metric's usual perceptual bands:
   0 → 100, 2 → 92, 10 → 70, 25 → 45, 50 → 20, interpolated linearly.
4. If the garment's `colorName` also appears in the season's
   `compatibleColorNames`, the score gains 6 points, capped at 99. The names
   carry stylist intent the raw distance cannot see, so they nudge the answer —
   they do not decide it. The cap never pulls a measured score down.
5. `isMatch` is score ≥ 70, i.e. the "clearly different but still related" band.

The CIEDE2000 implementation is verified against the 31 reference pairs from
Sharma, Wu & Dalal (2005), matching to within 1×10⁻⁴. That check is
`tests/test_color.py`, not a claim in a README — run it yourself.

## Tests

```bash
pytest
```

From this folder, with the dev dependencies installed. 156 tests in about three
seconds — there is no reason not to run them before pushing.

### Testing the try-on without spending anything

Two of its refusals happen *before* `FAL_KEY` is read, so they exercise the
whole HTTP path — request shape, aliases, guards, status mapping — with no key
and no generation. With the service running:

```bash
curl -s -X POST localhost:8000/try-on -H "Content-Type: application/json" -d "{\"person\":\"ZmFrZQ==\",\"garments\":[{\"image\":\"ZmFrZQ==\",\"category\":\"shoes\"}]}"
```

That should be a **502** naming shoes. Change `shoes` to `tops` and it becomes a
**503** asking for `FAL_KEY` — which means everything up to the model works.

For a real generation, once `FAL_KEY` is in `.env`:

```bash
python tools/try_one.py
```

One generation, the sample photograph, a seeded garment, result written to
`tryon-result.png`. `--dry-run` builds the request and sends nothing.

`tests/test_color.py` is the one that matters. CIEDE2000 is long enough to get
subtly wrong, and a subtly wrong version still returns plausible numbers: it
would score garments confidently and incorrectly with nothing on screen to
suggest a problem. So it is pinned to the formula authors' own published pairs,
including the ones either side of the hue discontinuity that catch a naive
implementation. The rest covers the sRGB→Lab conversion against textbook values,
the score curve's anchors and monotonicity, and hex parsing.

`tests/test_match.py` drives the endpoint through FastAPI's `TestClient`, using
real garments and the real seasons. It asserts the response keys are camelCase,
so a change that would break the app on a phone fails here instead.

**What this replaced.** The old score was `pseudoScore()` — a hash of the item's
id, scaled into a flattering range. It was stable per garment and completely
meaningless. That function still exists in the store as the offline fallback,
and is still meaningless; it is only there so the sheet shows something when the
service is unreachable.

## How the app calls it

Already wired. `suggestOutfit()` in `store/useWardrobe.ts` POSTs here every time
the user picks an occasion on the Today screen.

There is no IP to configure. `constants/api.ts` reads the host Metro is serving
the app from — which in development is this machine — and points at port 8000
there. So as long as you run the app and this service on the same laptop, it
finds you.

To point the app at a service somewhere else, set `EXPO_PUBLIC_API_URL` in a
`.env` file at the project root.

If the service does not answer within `API_TIMEOUT_MS` (4 seconds), the app logs
a warning and falls back to its own copy of these rules. That means a demo
survives a dead laptop, but it also means **a silent fallback looks like
success**. If you are testing a change here, watch this window for the request —
no log line means the app never reached you.

## What is where

```
main.py                  FastAPI app, CORS, the five endpoints
vision.py                garment photo analysis — Gemini, then our own colour snapping
tryon.py                 virtual try-on — FASHN v1.6, hosted on fal
errors.py                the three failure types, and reading a status off any provider
models.py                request/response shapes; camelCase aliases for the RN client
rules.py                 outfit assembly — shortlist, score, choose
color.py                 Lab conversion, CIEDE2000, palette scoring, garment harmony
conftest.py              puts this folder on the import path for the suite
tools/try_one.py         one real try-on generation, from the command line.
                         The only thing here that spends money when you run it
                         — which is why it is a tool and not a test
tools/check_keys.py      are the keys in .env going to work? Free, and prints
                         no part of a key, so it is safe to run on a shared
                         screen or paste into a chat
tools/import_wardrobe.py a folder of garment photographs -> data/myWardrobe.ts,
                         named and categorised by /analyse. How your own clothes
                         get into the app without typing twenty forms
tests/test_color.py      the colour maths, against published reference data
tests/test_match.py      the /match endpoint, over the real request shapes
tests/test_recommend.py  the /recommend contract — shapes and ordering
tests/test_rules.py      the scorer's judgement — season, occasion, and what it leaves off
tests/test_vision.py     the checking around Gemini — no test here calls it
tests/test_tryon.py      the guards around the try-on model, and the request sent —
                         no test here calls fal; the happy path is stubbed
                         because a suite that spent money per run would be a trap
requirements.txt         pinned to major versions
requirements-dev.txt     pytest and httpx2, needed only to run the suite
```

`color.py` needs nothing beyond the standard library. The maths is a few dozen
lines and adding numpy to a service this size would cost more than it saves.

## Where the real work goes

**Photo analysis is Gemini for now, by choice.** `/analyse` is a stand-in for
the OpenCV colour extraction and YOLO categorisation the project intends: it
proves the round-trip, the request and response shapes, and the app wiring,
so swapping the model later is a change to `vision.py` alone. When OpenCV and
YOLO land they replace `analyse_garment`; nothing else moves.

**Virtual try-on is done.** It was the other stand-in here and is not one any
more: `/try-on` runs FASHN v1.6, a model built for the job, rather than asking a
general image model to compose a photograph. See "How the try-on works" above.

That swap is also the evidence for the claim this section keeps making. The
prediction was that replacing the model would mean rewriting `generate_try_on`
and nothing else. In the event `tryon.py` was rewritten end to end, `errors.py`
was split out of `vision.py` so try-on no longer imports the Gemini module —
and `main.py`, `models.py`, the request shape and the app's whole flow were
untouched. The app-side changes that did happen were about the model's *limits*
(one garment, no shoes), not its identity.

**The remaining gap is footwear and accessories.** No open try-on model handles
them, so a complete head-to-toe look is not something this can render today. The
app is explicit about it rather than quietly dropping the pieces — the picker
only offers what can be worn. If you want to close it, that is a separate model
and a separate dataset, not a change here.

**Tuning, if you want it.** The weights, the shortlist size and the tolerance
are constants at the top of `rules.py`, chosen by reasoning and then checked
against the seed wardrobe rather than fitted to data. If you ever collect real
preferences — even a handful of "liked this outfit" taps — those constants are
what you would fit. That is a genuine extension, not a repair.

**Learned compatibility.** A Polyvore-style model that learns which garments go
together from image features is the ambitious version. It needs a labelled
dataset and is a substantially bigger project than the scoring approach, which
reuses the colour maths already here and can be explained in a viva without
hand-waving.

**The app's offline fallback is worse than this, and admits it.**
`COLOR_PAIRINGS` no longer exists here — the scorer does not need a lookup
table — but `data/mockWardrobe.ts` still has its copy, and `buildLocalOutfit()`
in the store still runs the old sampling when this service cannot be reached.
That was harmless while both sides ran identical rules; it is not any more. So
`suggestOutfit()` returns `{ items, styledOffline }` and the Today screen shows
a "Styled offline" note when the look did not come from here. If you are
testing a change and expecting to see it, that note is the quickest way to tell
the request never arrived.

The match checker does the same and then some: with this service unreachable it
shows the verdict but **no percentage**, because the offline number is a hash
of the item's id rather than a measurement. If you are watching for a `/match`
request and the sheet shows a score, it reached you.
