"""Render a list of images into one video by piping raw frames to ffmpeg."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

import numpy as np
from PIL import Image, ImageColor, ImageFilter

from .decoders import load_frames

Fit = Literal["contain", "cover", "blur"]
Transition = Literal["none", "crossfade"]
OutFormat = Literal["mp4", "webm", "gif"]

QUALITY_CRF = {"low": 30, "medium": 25, "high": 20}
VP9_CRF = {"low": 40, "medium": 34, "high": 28}


@dataclass
class RenderOptions:
    width: int = 1920
    height: int = 1080
    fps: int = 30
    duration: float = 2.0  # seconds per still image
    fit: Fit = "contain"
    background: str = "#000000"
    transition: Transition = "none"
    transition_duration: float = 0.5
    format: OutFormat = "mp4"
    quality: Literal["low", "medium", "high"] = "medium"
    animate: bool = True  # play animated GIF/WebP/APNG frames
    max_side: int = 4096

    def validate(self) -> None:
        if not (16 <= self.width <= 3840 and 16 <= self.height <= 3840):
            raise ValueError("width/height must be between 16 and 3840")
        if not (1 <= self.fps <= 60):
            raise ValueError("fps must be between 1 and 60")
        if not (0 < self.duration <= 60):
            raise ValueError("duration must be between 0 and 60 seconds")
        if not (0 <= self.transition_duration <= 5):
            raise ValueError("transition_duration must be between 0 and 5 seconds")
        if self.fit not in ("contain", "cover", "blur"):
            raise ValueError("fit must be contain, cover or blur")
        if self.transition not in ("none", "crossfade"):
            raise ValueError("transition must be none or crossfade")
        if self.format not in ("mp4", "webm", "gif"):
            raise ValueError("format must be mp4, webm or gif")
        if self.quality not in QUALITY_CRF:
            raise ValueError("quality must be low, medium or high")
        ImageColor.getrgb(self.background)
        # Most codecs need even dimensions.
        self.width -= self.width % 2
        self.height -= self.height % 2


def compose(im: Image.Image, opts: RenderOptions) -> np.ndarray:
    """Place an image on a width x height canvas according to the fit mode."""
    W, H = opts.width, opts.height
    bg = ImageColor.getrgb(opts.background)[:3]
    canvas = Image.new("RGB", (W, H), bg)

    if opts.fit == "cover":
        scale = max(W / im.width, H / im.height)
    else:
        scale = min(W / im.width, H / im.height)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))

    if opts.fit == "blur":
        cs = max(W / im.width, H / im.height)
        small = im.convert("RGB").resize((max(1, round(im.width * cs / 8)), max(1, round(im.height * cs / 8))))
        small = small.filter(ImageFilter.GaussianBlur(6))
        back = small.resize((max(W, round(im.width * cs)), max(H, round(im.height * cs))), Image.BILINEAR)
        canvas.paste(back, ((W - back.width) // 2, (H - back.height) // 2))
        # Darken the blurred background a little so the photo stands out.
        canvas = Image.blend(canvas, Image.new("RGB", (W, H), (0, 0, 0)), 0.25)

    fg = im.resize((nw, nh), Image.LANCZOS)
    pos = ((W - nw) // 2, (H - nh) // 2)
    if fg.mode == "RGBA":
        canvas.paste(fg, pos, fg)
    else:
        canvas.paste(fg, pos)
    return np.asarray(canvas, dtype=np.uint8)


def _ffmpeg_cmd(opts: RenderOptions, out: Path, audio: Path | None, total_seconds: float) -> list[str]:
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{opts.width}x{opts.height}", "-r", str(opts.fps), "-i", "-",
    ]
    if audio and opts.format != "gif":
        cmd += ["-i", str(audio)]

    if opts.format == "mp4":
        cmd += [
            "-c:v", "libx264", "-preset", "veryfast", "-crf", str(QUALITY_CRF[opts.quality]),
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        ]
        if audio:
            cmd += ["-c:a", "aac", "-b:a", "192k"]
    elif opts.format == "webm":
        cmd += [
            "-c:v", "libvpx-vp9", "-crf", str(VP9_CRF[opts.quality]), "-b:v", "0",
            "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-pix_fmt", "yuv420p",
        ]
        if audio:
            cmd += ["-c:a", "libopus", "-b:a", "128k"]
    else:  # gif
        cmd += ["-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"]

    if audio and opts.format != "gif":
        # Trim audio to the video and fade it out at the end.
        fade_start = max(0.0, total_seconds - 1.5)
        cmd += ["-map", "0:v", "-map", "1:a", "-af", f"afade=t=out:st={fade_start:.3f}:d=1.5", "-shortest"]
    cmd.append(str(out))
    return cmd


def render_video(
    paths: list[Path],
    out: Path,
    opts: RenderOptions,
    audio: Path | None = None,
    on_progress: Callable[[float, str], None] | None = None,
) -> dict:
    """Decode every image, compose frames and encode them into `out`."""
    opts.validate()
    hold = max(1, round(opts.duration * opts.fps))
    trans = round(opts.transition_duration * opts.fps) if opts.transition == "crossfade" else 0
    # Rough length estimate, only used for the audio fade.
    est_seconds = (len(paths) * hold + max(0, len(paths) - 1) * trans) / opts.fps

    proc = subprocess.Popen(
        _ffmpeg_cmd(opts, out, audio, est_seconds),
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None
    frames_written = 0
    skipped: list[str] = []
    prev: np.ndarray | None = None

    def write(frame: np.ndarray, count: int = 1) -> None:
        nonlocal frames_written
        data = frame.tobytes()
        for _ in range(count):
            proc.stdin.write(data)
        frames_written += count

    try:
        for i, path in enumerate(paths):
            if on_progress:
                on_progress(i / len(paths), f"{path.name}")
            try:
                frames = load_frames(path, animate=opts.animate, max_side=opts.max_side)
                first = True
                for im, duration_ms in frames:
                    frame = compose(im, opts)
                    if first and prev is not None and trans:
                        for k in range(1, trans + 1):
                            a = k / (trans + 1)
                            write((prev * (1 - a) + frame * a).astype(np.uint8))
                    first = False
                    count = max(1, round(duration_ms / 1000 * opts.fps)) if duration_ms else hold
                    write(frame, count)
                    prev = frame
            except Exception as e:  # noqa: BLE001
                skipped.append(f"{path.name}: {e}")
        proc.stdin.close()
    except BrokenPipeError:
        pass
    err = proc.stderr.read().decode(errors="ignore") if proc.stderr else ""
    code = proc.wait()

    if frames_written == 0:
        out.unlink(missing_ok=True)
        raise RuntimeError("no image could be decoded: " + "; ".join(skipped))
    if code != 0:
        raise RuntimeError(f"ffmpeg failed: {err.strip()[-500:]}")
    if on_progress:
        on_progress(1.0, "done")
    return {
        "frames": frames_written,
        "seconds": round(frames_written / opts.fps, 3),
        "skipped": skipped,
        "size_bytes": out.stat().st_size,
    }
