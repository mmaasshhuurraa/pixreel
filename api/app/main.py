"""PixReel HTTP API: upload images, get one video back."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import __version__
from .config import settings
from .decoders import SUPPORTED_EXTS, supported_formats
from .jobs import MEDIA_TYPES, Job, store
from .render import RenderOptions

AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm"}

app = FastAPI(
    title="PixReel API",
    version=__version__,
    description="Convert images in almost any format (JPEG, PNG, WebP, HEIC, AVIF, JXL, "
    "RAW, PSD, TIFF, SVG, PDF, GIF...) into a single MP4, WebM or GIF video.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def check_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    if settings.api_keys and x_api_key not in settings.api_keys:
        raise HTTPException(401, "invalid or missing X-API-Key")


def _safe_name(name: str, index: int) -> str:
    stem = re.sub(r"[^\w.-]+", "_", Path(name).name)[-80:] or "file"
    return f"{index:04d}_{stem}"


async def _save(upload: UploadFile, dest: Path, limit: int) -> int:
    size = 0
    with dest.open("wb") as f:
        while chunk := await upload.read(1 << 20):
            size += len(chunk)
            if size > limit:
                raise HTTPException(413, f"{upload.filename}: file is larger than {settings.max_file_mb} MB")
            f.write(chunk)
    return size


async def _create_job(files: list[UploadFile], audio: UploadFile | None, opts: RenderOptions, sort: str) -> Job:
    if not files:
        raise HTTPException(400, "no files uploaded")
    if len(files) > settings.max_files:
        raise HTTPException(400, f"too many files (max {settings.max_files})")
    if store.queued_count() >= settings.max_queue:
        raise HTTPException(503, "server is busy, try again later")
    try:
        opts.validate()
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    if sort == "name":
        files = sorted(files, key=lambda f: (f.filename or "").lower())

    job_id, d = store.new_dir()
    try:
        inputs: list[Path] = []
        total = 0
        limit = settings.max_file_mb << 20
        for i, up in enumerate(files):
            ext = Path(up.filename or "").suffix.lower()
            if ext not in SUPPORTED_EXTS:
                raise HTTPException(415, f"{up.filename}: unsupported format")
            dest = d / "in" / _safe_name(up.filename or f"file{ext}", i)
            total += await _save(up, dest, limit)
            if total > settings.max_total_mb << 20:
                raise HTTPException(413, f"upload is larger than {settings.max_total_mb} MB")
            inputs.append(dest)
        audio_path = None
        if audio and audio.filename:
            ext = Path(audio.filename).suffix.lower()
            if ext not in AUDIO_EXTS:
                raise HTTPException(415, f"{audio.filename}: unsupported audio format")
            audio_path = d / f"audio{ext}"
            await _save(audio, audio_path, limit)
    except BaseException:
        shutil.rmtree(d, ignore_errors=True)
        raise
    return store.submit(Job(id=job_id, dir=d, inputs=inputs, options=opts, audio=audio_path))


def options_form(
    width: Annotated[int, Form(ge=16, le=3840)] = 1920,
    height: Annotated[int, Form(ge=16, le=3840)] = 1080,
    fps: Annotated[int, Form(ge=1, le=60)] = 30,
    duration: Annotated[float, Form(gt=0, le=60, description="Seconds per still image")] = 2.0,
    fit: Annotated[Literal["contain", "cover", "blur"], Form()] = "contain",
    background: Annotated[str, Form(description="CSS color, e.g. #000000")] = "#000000",
    transition: Annotated[Literal["none", "crossfade"], Form()] = "none",
    transition_duration: Annotated[float, Form(ge=0, le=5)] = 0.5,
    format: Annotated[Literal["mp4", "webm", "gif"], Form()] = "mp4",
    quality: Annotated[Literal["low", "medium", "high"], Form()] = "medium",
    animate: Annotated[bool, Form(description="Play frames of animated GIF/WebP/APNG")] = True,
) -> RenderOptions:
    return RenderOptions(
        width=width, height=height, fps=fps, duration=duration, fit=fit,
        background=background, transition=transition,
        transition_duration=transition_duration, format=format,
        quality=quality, animate=animate,
    )


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": "PixReel API", "version": __version__, "docs": "/docs", "openapi": "/openapi.json"}


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "version": __version__, "queue": store.queued_count()}


@app.get("/v1/formats", tags=["meta"])
def formats() -> dict:
    return {
        "input": supported_formats(),
        "audio": sorted(e.lstrip(".") for e in AUDIO_EXTS),
        "output": list(MEDIA_TYPES),
        "limits": {
            "max_files": settings.max_files,
            "max_file_mb": settings.max_file_mb,
            "max_total_mb": settings.max_total_mb,
        },
    }


@app.post("/v1/jobs", status_code=202, tags=["jobs"], dependencies=[Depends(check_key)])
async def create_job(
    files: Annotated[list[UploadFile], File(description="Images, in the order they should appear")],
    opts: Annotated[RenderOptions, Depends(options_form)],
    audio: Annotated[UploadFile | None, File(description="Optional background music")] = None,
    sort: Annotated[Literal["none", "name"], Form()] = "none",
) -> dict:
    """Start a conversion. Poll `GET /v1/jobs/{id}` until status is `done`."""
    job = await _create_job(files, audio, opts, sort)
    return job.public()


@app.get("/v1/jobs/{job_id}", tags=["jobs"], dependencies=[Depends(check_key)])
def get_job(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job.public()


@app.get("/v1/jobs/{job_id}/result", tags=["jobs"], dependencies=[Depends(check_key)])
def get_result(job_id: str) -> FileResponse:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if job.status != "done":
        raise HTTPException(409, f"job is {job.status}")
    fmt = job.options.format
    return FileResponse(job.output, media_type=MEDIA_TYPES[fmt], filename=f"pixreel.{fmt}")


@app.delete("/v1/jobs/{job_id}", status_code=204, tags=["jobs"], dependencies=[Depends(check_key)])
def delete_job(job_id: str) -> None:
    if not store.delete(job_id):
        raise HTTPException(404, "job not found")


@app.post("/v1/convert", tags=["jobs"], dependencies=[Depends(check_key)], response_class=FileResponse)
async def convert(
    files: Annotated[list[UploadFile], File()],
    opts: Annotated[RenderOptions, Depends(options_form)],
    audio: Annotated[UploadFile | None, File()] = None,
    sort: Annotated[Literal["none", "name"], Form()] = "none",
) -> FileResponse:
    """Synchronous shortcut: upload and wait for the video in one request (small jobs)."""
    import asyncio

    job = await _create_job(files, audio, opts, sort)
    while job.status in ("queued", "processing"):
        await asyncio.sleep(0.3)
    if job.status != "done":
        raise HTTPException(422, job.error or "conversion failed")
    fmt = job.options.format
    return FileResponse(job.output, media_type=MEDIA_TYPES[fmt], filename=f"pixreel.{fmt}")
