"""Are the API keys in service/.env actually going to work?

Answers that without running a model and without spending anything -- and
without ever printing a key, or any fragment of one, so it is safe to run with
someone watching your screen and safe to paste the output into a chat.

    python tools/check_keys.py

Worth having because a bad key and a missing key and a locked account all reach
the app as the same 503, and "not set up yet" is not enough to tell you which of
the three you have. The endpoints below distinguish them for free.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

SERVICE = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE / ".env")


def report(label: str, ok: bool, detail: str) -> bool:
    print(f"  {'OK  ' if ok else 'X   '}{label:<16} {detail}")
    return ok


def check_gemini() -> bool:
    """Presence only. Every real call costs quota, and the free tier is small
    enough that a setup check could eat into a demo."""
    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if not key:
        return report("GEMINI_API_KEY", False, "not set -- /analyse will return 503")
    return report("GEMINI_API_KEY", True, f"present ({len(key)} chars, not verified -- costs quota)")


def check_fal() -> bool:
    """A real authentication check, and free.

    Asking for a short-lived token exercises the credential without queueing any
    work, so it distinguishes the three failure modes that otherwise arrive as
    one indistinguishable 503.
    """
    key = (os.environ.get("FAL_KEY") or "").strip()

    if not key:
        return report("FAL_KEY", False, "not set -- /try-on will return 503")

    raw = os.environ.get("FAL_KEY", "")
    if raw != raw.strip():
        report("FAL_KEY", False, "has leading or trailing whitespace -- strip it")
    if key.count(":") != 1:
        report("FAL_KEY", False, f"expected <uuid>:<hex>, found {key.count(':')} colons")

    try:
        import httpx

        response = httpx.post(
            "https://rest.alpha.fal.ai/tokens/",
            headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
            json={"allowed_apps": ["fal-ai/cat-vton"], "token_expiration": 60},
            timeout=30,
        )
    except Exception as err:  # noqa: BLE001
        return report("FAL_KEY", False, f"could not reach fal: {type(err).__name__}")

    if response.status_code in (200, 201):
        return report("FAL_KEY", True, f"{len(key)} chars, authenticated, balance ok")

    # fal puts the real reason in the body, and it matters: a rejected key and a
    # locked account need opposite fixes. Never assume one -- see _raise_for in
    # tryon.py, which learned this the expensive way.
    detail = response.text[:160].strip()
    if response.status_code == 401:
        return report("FAL_KEY", False, f"401 -- fal does not recognise this key. {detail}")
    if response.status_code == 403:
        return report("FAL_KEY", False, f"403 -- key valid, account blocked. {detail}")
    return report("FAL_KEY", False, f"HTTP {response.status_code}. {detail}")


def main() -> int:
    print(f"\nReading {SERVICE / '.env'}\n")
    results = [check_gemini(), check_fal()]
    print()
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
