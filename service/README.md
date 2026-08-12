# Recommendation service

The Python half of the project. One endpoint today, running the same placeholder
rules the app already has locally — that is on purpose. Get the round-trip
working first, then replace the logic.

## Setup

Needs Python 3.10 or newer. From this folder:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS or Linux the activate line is `source .venv/bin/activate`.

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
main.py           FastAPI app, CORS, the two endpoints
models.py         request/response shapes; camelCase aliases for the RN client
rules.py          placeholder styling logic, ported from the app's store
requirements.txt  pinned to major versions
```

## Where the real work goes

`rules.py#build_outfit` is the function to replace. Everything else — the
endpoint, the shapes, the app's call site — stays as it is when the model lands.

The other two integration points are still in the app and not yet here:

- **Colour matching.** `matchItemToProfile()` in the store scores a garment
  against the user's seasonal palette using a hardcoded list. It should become a
  second endpoint on this service.
- **Photo analysis.** `addItem` in `app/add-item.tsx` has a marked hook where
  OpenCV colour extraction and YOLO categorisation should run on an uploaded
  photo. That will need an endpoint that accepts an image.
