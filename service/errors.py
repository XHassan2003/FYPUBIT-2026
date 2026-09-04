"""The service's shared error vocabulary.

Three kinds of failure, and telling them apart is the whole point: each maps to
a different status code in `main.py`, and each asks the user to do something
different.

    VisionUnavailable   503   a setup problem — a key is missing
    VisionRateLimited   429   nothing is wrong; wait and repeat the same request
    VisionFailed        502   the model was reached and did not produce a result

The names date from `vision.py`, which was the first thing here to call a
model. They belong to the whole service now: `/try-on` raises the same three
from an entirely different provider, and `main.py` neither knows nor cares
which model produced them. That indifference is what let the try-on model be
swapped out without touching an endpoint. `vision.py` re-exports all three, so
`from vision import VisionFailed` still works.
"""


class VisionUnavailable(RuntimeError):
    """No API key configured. A setup problem, not a runtime failure."""


class VisionFailed(RuntimeError):
    """The model was reached but did not return something usable."""


class VisionRateLimited(RuntimeError):
    """Out of quota, or asking too fast.

    Worth its own type because it is neither a bug nor a broken photo: the
    request was fine and the same request will work later. Telling someone to
    "try a different photo" when the real answer is "wait a minute" sends them
    off fixing something that was never wrong.
    """


def status_of(err: Exception) -> int | None:
    """Read the HTTP status out of a provider's exception, by duck typing.

    Deliberately not `isinstance`. Two providers, three exception hierarchies
    between them, and no common base class:

    - Gemini's Interactions API raises from `google.genai._gaos.lib.compat_errors`,
      whose exceptions do *not* inherit from the `google.genai.errors.APIError`
      you would reasonably import — there are two unrelated classes of that
      name, so `isinstance` against the public one is simply `False`. That
      mismatch is what once made a quota error reach the app as "could not read
      it" instead of "wait a moment".
    - The two Gemini hierarchies also disagree on where the status lives: the
      newer exposes `status_code`, the older `code`.
    - fal raises `FalClientHTTPError`, which carries `status_code` and shares
      no ancestor with either.

    Reading whichever attribute is present covers all four and keeps us out of
    anyone's private modules. A provider that carries no status at all returns
    None, and the caller falls through to its generic message.
    """
    status = getattr(err, "status_code", None) or getattr(err, "code", None)
    return status if isinstance(status, int) else None


__all__ = ["VisionUnavailable", "VisionFailed", "VisionRateLimited", "status_of"]
