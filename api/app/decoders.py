"""Turn any supported image file into a sequence of PIL frames.

Each decoder yields (image, duration_ms) pairs. duration_ms is set only for
animated formats (GIF, APNG, animated WebP/AVIF); for still images and
multi-page documents it is None and the job's per-image duration is used.
"""

from __future__ import annotations

import io
import json
import shutil
import subprocess
from pathlib import Path
from typing import Iterator

import numpy as np
from PIL import Image, ImageOps, ImageSequence

# Optional plugins: register whatever is installed.
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover
    pass

try:
    import pillow_jxl  # noqa: F401  (registers JPEG XL on import)
except ImportError:  # pragma: no cover
    pass

Image.MAX_IMAGE_PIXELS = 200_000_000

Frame = tuple[Image.Image, "int | None"]

RAW_EXTS = {
    ".cr2", ".cr3", ".crw", ".nef", ".nrw", ".arw", ".srf", ".sr2", ".dng",
    ".orf", ".raf", ".rw2", ".pef", ".srw", ".x3f", ".3fr", ".erf", ".kdc",
    ".mrw", ".mos", ".iiq", ".rwl",
}
SVG_EXTS = {".svg", ".svgz"}
PDF_EXTS = {".pdf"}
PILLOW_EXTS = {
    ".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".apng", ".webp", ".gif",
    ".bmp", ".dib", ".tif", ".tiff", ".ico", ".icns", ".cur", ".tga", ".icb",
    ".vda", ".vst", ".psd", ".pcx", ".ppm", ".pgm", ".pbm", ".pnm", ".pfm",
    ".sgi", ".rgb", ".rgba", ".bw", ".dds", ".jp2", ".j2k", ".jpf", ".jpx",
    ".j2c", ".heic", ".heif", ".hif", ".avif", ".jxl", ".qoi", ".xbm",
    ".im", ".msp", ".ras", ".sun", ".fits", ".fit", ".blp", ".ftc", ".eps",
}
MAGICK_EXTS = {
    ".exr", ".hdr", ".xcf", ".miff", ".dpx", ".cin", ".pict", ".pct", ".wbmp",
    ".xpm", ".jng", ".mng", ".otb", ".pcd", ".art", ".fax", ".viff", ".palm",
}

VIDEO_EXTS = {
    ".mp4", ".m4v", ".mov", ".qt", ".webm", ".mkv", ".avi", ".wmv", ".asf",
    ".flv", ".3gp", ".3g2", ".mpg", ".mpeg", ".m2v", ".ts", ".mts", ".m2ts",
    ".ogv", ".vob", ".mxf", ".dv",
}

IMAGE_EXTS = RAW_EXTS | SVG_EXTS | PDF_EXTS | PILLOW_EXTS | MAGICK_EXTS
SUPPORTED_EXTS = IMAGE_EXTS | VIDEO_EXTS


class DecodeError(Exception):
    pass


def supported_formats() -> dict[str, list[str]]:
    strip = lambda s: sorted(e.lstrip(".") for e in s)  # noqa: E731
    return {
        "raster": strip(PILLOW_EXTS),
        "raw": strip(RAW_EXTS),
        "vector": strip(SVG_EXTS),
        "document": strip(PDF_EXTS),
        "other": strip(MAGICK_EXTS),
        "video": strip(VIDEO_EXTS),
    }


def is_video(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_EXTS


def probe_video(path: Path) -> dict:
    """Duration in seconds and whether the file has a video and an audio stream."""
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
         "-of", "json", str(path)],
        capture_output=True, timeout=60,
    )
    if proc.returncode != 0:
        raise DecodeError(f"{path.name}: cannot read video")
    data = json.loads(proc.stdout or b"{}")
    types = {s.get("codec_type") for s in data.get("streams", [])}
    try:
        duration = float(data.get("format", {}).get("duration", 0))
    except (TypeError, ValueError):
        duration = 0.0
    return {"duration": duration, "has_video": "video" in types, "has_audio": "audio" in types}


def load_frames(path: Path, animate: bool = True, max_side: int = 4096) -> Iterator[Frame]:
    """Yield frames from an image file, trying the best decoder first."""
    ext = path.suffix.lower()
    try:
        if ext in RAW_EXTS:
            yield from _raw(path)
            return
        if ext in SVG_EXTS:
            yield from _svg(path, max_side)
            return
        if ext in PDF_EXTS:
            yield from _pdf(path, max_side)
            return
        if ext not in MAGICK_EXTS:
            try:
                frames = list(_pillow(path, animate))
            except Exception:
                frames = []
            if frames:
                yield from frames
                return
        yield from _magick(path)
    except DecodeError:
        raise
    except Exception as e:  # noqa: BLE001
        raise DecodeError(f"{path.name}: {e}") from e


def _pillow(path: Path, animate: bool) -> Iterator[Frame]:
    with Image.open(path) as im:
        n = getattr(im, "n_frames", 1)
        if n <= 1:
            yield _normalize(ImageOps.exif_transpose(im)), None
            return
        fmt = (im.format or "").upper()
        is_animation = fmt in {"GIF", "PNG", "WEBP", "AVIF", "JXL", "HEIF", "MPO", "FLI"}
        if fmt == "PSD":
            # Frame 0 of a PSD is the merged composite; the rest are layers.
            im.seek(0)
            yield _normalize(im), None
            return
        if fmt == "MPO":
            # MPO (stereo/multi-picture JPEG): the first picture is the main one.
            yield _normalize(ImageOps.exif_transpose(im)), None
            return
        if is_animation and not animate:
            yield _normalize(im), None
            return
        for frame in ImageSequence.Iterator(im):
            duration = frame.info.get("duration") if is_animation else None
            if is_animation:
                duration = int(duration) if duration else 100
            yield _normalize(frame), duration


def _raw(path: Path) -> Iterator[Frame]:
    import rawpy

    with rawpy.imread(str(path)) as raw:
        try:
            rgb = raw.postprocess(use_camera_wb=True, output_bps=8)
        except Exception:
            # Fall back to the embedded JPEG preview.
            thumb = raw.extract_thumb()
            if thumb.format == rawpy.ThumbFormat.JPEG:
                yield _normalize(Image.open(io.BytesIO(thumb.data))), None
                return
            rgb = thumb.data
    yield Image.fromarray(rgb).convert("RGB"), None


def _svg(path: Path, max_side: int) -> Iterator[Frame]:
    import cairosvg

    png = cairosvg.svg2png(url=str(path), output_width=min(max_side, 2048))
    yield _normalize(Image.open(io.BytesIO(png))), None


def _pdf(path: Path, max_side: int) -> Iterator[Frame]:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(path))
    try:
        for page in pdf:
            w, h = page.get_size()
            scale = min(max_side, 2048) / max(w, h)
            bitmap = page.render(scale=scale)
            yield bitmap.to_pil().convert("RGB"), None
    finally:
        pdf.close()


def _magick_bin() -> list[str] | None:
    if shutil.which("magick"):
        return ["magick"]
    if shutil.which("convert"):
        return ["convert"]
    return None


def _magick(path: Path) -> Iterator[Frame]:
    cmd = _magick_bin()
    if not cmd:
        raise DecodeError(f"{path.name}: unsupported format")
    proc = subprocess.run(
        [*cmd, f"{path}[0]", "-auto-orient", "-colorspace", "sRGB", "-depth", "8", "png:-"],
        capture_output=True,
        timeout=120,
    )
    if proc.returncode != 0 or not proc.stdout:
        msg = proc.stderr.decode(errors="ignore").strip().splitlines()
        raise DecodeError(f"{path.name}: {msg[-1] if msg else 'cannot decode'}")
    yield _normalize(Image.open(io.BytesIO(proc.stdout))), None


def _normalize(im: Image.Image) -> Image.Image:
    """Convert any Pillow mode to RGB or RGBA (8 bit)."""
    im.load()
    mode = im.mode
    if mode in ("RGB", "RGBA"):
        return im.copy()
    if mode in ("I;16", "I;16B", "I;16L", "I;16N", "I", "F"):
        arr = np.asarray(im, dtype=np.float64)
        lo, hi = float(arr.min()), float(arr.max())
        arr = (arr - lo) / (hi - lo) * 255 if hi > lo else np.zeros_like(arr)
        return Image.fromarray(arr.astype(np.uint8)).convert("RGB")
    if mode in ("P", "PA", "LA", "La", "RGBa") or "transparency" in im.info:
        return im.convert("RGBA")
    return im.convert("RGB")
