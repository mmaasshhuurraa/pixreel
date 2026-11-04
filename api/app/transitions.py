"""Transition effects between two composed RGB frames (numpy, H x W x 3, uint8)."""

from __future__ import annotations

import random
from functools import lru_cache

import numpy as np
from PIL import Image

TRANSITIONS = (
    "crossfade", "fadeblack", "fadewhite",
    "slideleft", "slideright", "slideup", "slidedown",
    "wipeleft", "wiperight", "wipeup", "wipedown",
    "zoom", "circle",
)


def smooth(p: float) -> float:
    return p * p * (3 - 2 * p)


@lru_cache(maxsize=4)
def _radius_grid(h: int, w: int) -> np.ndarray:
    y, x = np.ogrid[:h, :w]
    return np.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2)


def blend(name: str, a: np.ndarray, b: np.ndarray, p: float) -> np.ndarray:
    """Frame at progress p (0..1) of the transition from a to b."""
    h, w = a.shape[:2]
    if name == "crossfade":
        return (a * (1 - p) + b * p).astype(np.uint8)
    if name in ("fadeblack", "fadewhite"):
        c = 0 if name == "fadeblack" else 255
        src, q = (a, 1 - 2 * p) if p < 0.5 else (b, 2 * p - 1)
        return (src * q + c * (1 - q)).astype(np.uint8)

    e = smooth(p)
    out = a.copy()
    if name in ("slideleft", "slideright"):
        off = round(w * e)
        if name == "slideleft":  # new image comes in from the right
            out[:, : w - off] = a[:, off:]
            out[:, w - off :] = b[:, :off]
        else:
            out[:, off:] = a[:, : w - off]
            out[:, :off] = b[:, w - off :]
        return out
    if name in ("slideup", "slidedown"):
        off = round(h * e)
        if name == "slideup":  # new image comes in from the bottom
            out[: h - off] = a[off:]
            out[h - off :] = b[:off]
        else:
            out[off:] = a[: h - off]
            out[:off] = b[h - off :]
        return out
    if name == "wipeleft":
        off = round(w * e)
        out[:, w - off :] = b[:, w - off :]
        return out
    if name == "wiperight":
        off = round(w * e)
        out[:, :off] = b[:, :off]
        return out
    if name == "wipeup":
        off = round(h * e)
        out[h - off :] = b[h - off :]
        return out
    if name == "wipedown":
        off = round(h * e)
        out[:off] = b[:off]
        return out
    if name == "circle":
        mask = _radius_grid(h, w) <= e * np.hypot(w, h) / 2
        out[mask] = b[mask]
        return out
    if name == "zoom":
        # New image grows from the centre while fading in.
        s = 0.5 + 0.5 * e
        sw, sh = max(1, round(w * s)), max(1, round(h * s))
        small = np.asarray(Image.fromarray(b).resize((sw, sh), Image.BILINEAR))
        x, y = (w - sw) // 2, (h - sh) // 2
        region = out[y : y + sh, x : x + sw]
        out[y : y + sh, x : x + sw] = (region * (1 - p) + small * p).astype(np.uint8)
        return out
    raise ValueError(f"unknown transition {name}")


def picker(name: str, seed: int = 0):
    """Returns a function giving the effect for the n-th transition ('random' picks one each time)."""
    if name != "random":
        return lambda: name
    rng = random.Random(seed)
    return lambda: rng.choice(TRANSITIONS)
