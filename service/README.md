# Recommendation service

The Python half of the project. Two endpoints: `/recommend` still runs the same
placeholder rules the app has locally — that was on purpose, to get the
round-trip working before the logic — and `/match` is the first one doing real
work, scoring a garment against the user's seasonal palette in CIE Lab.

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
  "includeAccessories": true
}
```

The response is a JSON array of the items that make up the outfit — a subset of
what was sent in, in wearing order: top, bottom, shoes, then optionally
outerwear and an accessory.

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

From this folder, with the dev dependencies installed. 66 tests, well under a
second — there is no reason not to run them before pushing.

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
main.py               FastAPI app, CORS, the three endpoints
models.py             request/response shapes; camelCase aliases for the RN client
rules.py              placeholder styling logic, ported from the app's store
color.py              Lab conversion, CIEDE2000, and the palette scoring — real, not a placeholder
conftest.py           puts this folder on the import path for the suite
tests/test_color.py   the colour maths, against published reference data
tests/test_match.py   the /match endpoint, over the real request shapes
requirements.txt      pinned to major versions
requirements-dev.txt  pytest and httpx2, needed only to run the suite
```

`color.py` needs nothing beyond the standard library. The maths is a few dozen
lines and adding numpy to a service this size would cost more than it saves.

## Where the real work goes

`rules.py#build_outfit` is the function to replace — still `random.choice`
inside a category with a colour-pairing lookup. Everything else, the endpoint,
the shapes, the app's call site, stays as it is when the model lands.

⚠️ `COLOR_PAIRINGS` in `rules.py` is a hand-copy of `colorPairings` in
`data/mockWardrobe.ts`, and the app still falls back to its own copy on a
timeout. Once a real model lands here, a 4-second timeout will quietly produce
*different* recommendations rather than merely slower ones. Decide then whether
the fallback should show a message instead of silently styling worse. `/match`
sidesteps this by taking the palette in the request instead of duplicating it.

Still in the app and not yet here:

- **Photo analysis.** `addItem` in `app/add-item.tsx` has a marked hook where
  OpenCV colour extraction and YOLO categorisation should run on an uploaded
  photo. That will need an endpoint that accepts an image — multipart, not the
  JSON shape the other two use.
