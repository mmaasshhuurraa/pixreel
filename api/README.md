---
title: PixReel API
emoji: 🎞️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Convert images in any format into one video
---

# PixReel API

FastAPI service that turns images in almost any format into one MP4, WebM or GIF.
Interactive docs: `/docs`. Full description: [docs/API.md](https://github.com/mmaasshhuurraa/pixreel/blob/main/docs/API.md).

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 7860
```

Needs `ffmpeg` on PATH; `imagemagick` (EXR, HDR, XCF...) and `libcairo2` (SVG) are optional.

Or with Docker:

```bash
docker build -t pixreel-api . && docker run -p 7860:7860 pixreel-api
```

## Tests

```bash
pip install -r requirements-dev.txt && pytest -q
```

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PIXREEL_MAX_FILES` | 300 | images per job |
| `PIXREEL_MAX_FILE_MB` | 100 | size of one file |
| `PIXREEL_MAX_TOTAL_MB` | 1000 | size of all files in one job |
| `PIXREEL_MAX_QUEUE` | 20 | jobs waiting at once, then 503 |
| `PIXREEL_WORKERS` | 1 | jobs rendered in parallel |
| `PIXREEL_JOB_TTL` | 3600 | seconds a finished video is kept |
| `PIXREEL_API_KEYS` | empty | comma separated keys; if set, clients must send `X-API-Key` |
| `PIXREEL_CORS_ORIGINS` | `*` | comma separated allowed origins |
