"""Render a list of images into one video by piping raw frames to ffmpeg."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator, Literal

import numpy as np
from PIL import Image, ImageColor, ImageFilter

from .config import settings
from .decoders import is_video, load_frames, probe_video

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
    video_audio: bool = False  # keep the sound of video clips
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


def _encode_cmd(opts: RenderOptions, out: Path) -> list[str]:
    """ffmpeg reading raw RGB frames from stdin and writing a silent video."""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{opts.width}x{opts.height}", "-r", str(opts.fps), "-i", "-",
    ]
    if opts.format == "mp4":
        cmd += [
            "-c:v", "libx264", "-preset", "veryfast", "-crf", str(QUALITY_CRF[opts.quality]),
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        ]
    elif opts.format == "webm":
        cmd += [
            "-c:v", "libvpx-vp9", "-crf", str(VP9_CRF[opts.quality]), "-b:v", "0",
            "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-pix_fmt", "yuv420p",
        ]
    else:  # gif
        cmd += ["-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"]
    cmd.append(str(out))
    return cmd


def _video_filter(opts: RenderOptions) -> str:
    """ffmpeg filter that resamples a clip to the output fps and applies the fit mode."""
    W, H = opts.width, opts.height
    fit_in = f"scale={W}:{H}:force_original_aspect_ratio=decrease"
    fill = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    if opts.fit == "cover":
        chain = fill
    elif opts.fit == "contain":
        bg = "0x" + "".join(f"{c:02x}" for c in ImageColor.getrgb(opts.background)[:3])
        chain = f"{fit_in},pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={bg}"
    else:  # blur
        sigma = max(2, max(W, H) // 60)
        chain = (
            f"split[a][b];[a]{fill},gblur=sigma={sigma},"
            f"colorchannelmixer=rr=0.75:gg=0.75:bb=0.75[bg];"
            f"[b]{fit_in}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )
    return f"fps={opts.fps},{chain},setsar=1,format=rgb24"


def _video_frames(path: Path, opts: RenderOptions) -> Iterator[np.ndarray]:
    """Yield composed RGB frames of a video clip at the output fps."""
    proc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-an", "-sn",
         "-vf", _video_filter(opts), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdout is not None
    size = opts.width * opts.height * 3
    try:
        while True:
            data = proc.stdout.read(size)
            if len(data) < size:
                break
            yield np.frombuffer(data, dtype=np.uint8).reshape(opts.height, opts.width, 3)
    finally:
        proc.stdout.close()
        err = proc.stderr.read().decode(errors="ignore") if proc.stderr else ""
        if proc.wait() != 0 and err:
            raise RuntimeError(err.strip().splitlines()[-1])


def _mux_audio(
    video: Path, out: Path, opts: RenderOptions, total: float,
    clips: list[tuple[Path, float, float]], music: Path | None,
) -> None:
    """Add clip sound (at the right offsets) and background music to a silent video."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video)]
    filters, labels = [], []
    for k, (clip, start, dur) in enumerate(clips):
        cmd += ["-i", str(clip)]
        filters.append(
            f"[{k + 1}:a:0]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,"
            f"aresample=48000,adelay={int(start * 1000)}:all=1[c{k}]"
        )
        labels.append(f"[c{k}]")
    if music:
        cmd += ["-i", str(music)]
        # Quieter music when clips have their own sound; fade out at the end.
        volume = 0.5 if clips else 1.0
        filters.append(
            f"[{len(clips) + 1}:a:0]aresample=48000,volume={volume},atrim=0:{total:.3f},"
            f"afade=t=out:st={max(0.0, total - 1.5):.3f}:d=1.5[m]"
        )
        labels.append("[m]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,"
                   f"apad,atrim=0:{total:.3f}[aout]")
    acodec = ["-c:a", "aac", "-b:a", "192k"] if opts.format == "mp4" else ["-c:a", "libopus", "-b:a", "128k"]
    cmd += [
        "-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", *acodec, "-t", f"{total:.3f}",
    ]
    if opts.format == "mp4":
        cmd += ["-movflags", "+faststart"]
    cmd.append(str(out))
    proc = subprocess.run(cmd, capture_output=True, timeout=1800)
    if proc.returncode != 0:
        raise RuntimeError(f"audio mix failed: {proc.stderr.decode(errors='ignore').strip()[-500:]}")


def render_video(
    paths: list[Path],
    out: Path,
    opts: RenderOptions,
    audio: Path | None = None,
    on_progress: Callable[[float, str], None] | None = None,
) -> dict:
    """Decode every image and clip, compose frames and encode them into `out`."""
    opts.validate()
    hold = max(1, round(opts.duration * opts.fps))
    trans = round(opts.transition_duration * opts.fps) if opts.transition == "crossfade" else 0
    max_frames = settings.max_seconds * opts.fps

    silent = out.with_name(f"silent{out.suffix}")
    proc = subprocess.Popen(_encode_cmd(opts, silent), stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdin is not None
    frames_written = 0
    skipped: list[str] = []
    clip_audio: list[tuple[Path, float, float]] = []  # (file, start s, length s)
    prev: np.ndarray | None = None

    def write(frame: np.ndarray, count: int = 1) -> None:
        nonlocal frames_written
        if frames_written + count > max_frames:
            raise OverflowError(f"video would be longer than {settings.max_seconds} s")
        data = frame.tobytes()
        for _ in range(count):
            proc.stdin.write(data)
        frames_written += count

    def frames_of(path: Path) -> Iterator[tuple[np.ndarray, int]]:
        """(frame, how many output frames it lasts)"""
        if is_video(path):
            for frame in _video_frames(path, opts):
                yield frame, 1
            return
        for im, duration_ms in load_frames(path, animate=opts.animate, max_side=opts.max_side):
            count = max(1, round(duration_ms / 1000 * opts.fps)) if duration_ms else hold
            yield compose(im, opts), count

    try:
        for i, path in enumerate(paths):
            if on_progress:
                on_progress(i / len(paths), path.name)
            start: int | None = None
            try:
                for frame, count in frames_of(path):
                    if start is None:
                        if prev is not None and trans:
                            for k in range(1, trans + 1):
                                a = k / (trans + 1)
                                write((prev * (1 - a) + frame * a).astype(np.uint8))
                        start = frames_written
                    write(frame, count)
                    prev = frame
            except OverflowError:
                raise
            except Exception as e:  # noqa: BLE001
                skipped.append(f"{path.name}: {e}")
            if start is not None and is_video(path) and opts.video_audio and opts.format != "gif":
                try:
                    if probe_video(path)["has_audio"]:
                        clip_audio.append((path, start / opts.fps, (frames_written - start) / opts.fps))
                except Exception:  # noqa: BLE001
                    pass
        proc.stdin.close()
    except BrokenPipeError:
        pass
    except OverflowError:
        proc.kill()
        proc.wait()
        silent.unlink(missing_ok=True)
        raise
    err = proc.stderr.read().decode(errors="ignore") if proc.stderr else ""
    code = proc.wait()

    if frames_written == 0:
        silent.unlink(missing_ok=True)
        raise RuntimeError("no file could be decoded: " + "; ".join(skipped))
    if code != 0:
        raise RuntimeError(f"ffmpeg failed: {err.strip()[-500:]}")

    total = frames_written / opts.fps
    music = audio if opts.format != "gif" else None
    if music or clip_audio:
        if on_progress:
            on_progress(0.99, "audio")
        try:
            _mux_audio(silent, out, opts, total, clip_audio, music)
        finally:
            silent.unlink(missing_ok=True)
    else:
        silent.replace(out)

    if on_progress:
        on_progress(1.0, "done")
    return {
        "frames": frames_written,
        "seconds": round(total, 3),
        "skipped": skipped,
        "size_bytes": out.stat().st_size,
    }
