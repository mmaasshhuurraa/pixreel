"""Lay out background music tracks on the video timeline.

Mirrors web/src/engine/playlist.ts, so the web app can show the same lengths.
"""

from __future__ import annotations

from dataclasses import dataclass

MUSIC_TRANSITIONS = ("none", "crossfade", "gap")


@dataclass
class Placed:
    index: int  # which track
    start: float  # seconds on the video timeline
    length: float  # seconds of the track that play
    fade_in: float = 0.0
    fade_out: float = 0.0

    @property
    def end(self) -> float:
        return self.start + self.length


def plan(durations: list[float], mode: str = "none", seconds: float = 0.0,
         loop: bool = False, until: float | None = None) -> list[Placed]:
    """Place tracks one after another.

    mode: "none" back to back, "crossfade" overlap by `seconds`, "gap" silence of `seconds`.
    loop: start the list again until `until` is covered.
    """
    n = len(durations)
    if n == 0 or all(d <= 0 for d in durations):
        return []
    out: list[Placed] = []
    i = 0
    while True:
        if i >= n and not (loop and until is not None):
            break
        idx = i % n
        i += 1
        length = durations[idx]
        if length <= 0:
            continue
        start, fade_in = 0.0, 0.0
        if out:
            prev = out[-1]
            if mode == "crossfade":
                x = max(0.0, min(seconds, prev.length / 2, length / 2))
                prev.fade_out = x
                fade_in = x
                start = prev.end - x
            elif mode == "gap":
                start = prev.end + seconds
            else:
                start = prev.end
        out.append(Placed(idx, start, length, fade_in))
        if until is not None and out[-1].end >= until:
            break
    return out


def total_length(durations: list[float], mode: str = "none", seconds: float = 0.0) -> float:
    placed = plan(durations, mode, seconds)
    return placed[-1].end if placed else 0.0
