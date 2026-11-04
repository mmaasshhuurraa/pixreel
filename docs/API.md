# PixReel API v1

Base URL: your Hugging Face Space, e.g. `https://<hf-user>-pixreel-api.hf.space`.
Interactive docs: `<base>/docs`. Machine-readable spec: [`openapi.json`](openapi.json)
(use it to generate clients for iOS, Android, desktop: `openapi-generator`, `swift-openapi-generator`, etc.).

If the server sets `PIXREEL_API_KEYS`, send the header `X-API-Key: <key>` with every `/v1` request.

## Flow

1. `POST /v1/jobs`: upload images and options (multipart/form-data). Returns `202` with a job.
2. `GET /v1/jobs/{id}`: poll every 1 to 2 s until `status` is `done` or `error`.
3. `GET /v1/jobs/{id}/result`: download the video.
4. `DELETE /v1/jobs/{id}`: optional cleanup (finished jobs are removed after 1 hour anyway).

For small jobs there is a one-shot shortcut: `POST /v1/convert` takes the same fields and returns the video directly.

## Fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `files` | file, repeated | (required) | images and video clips, in the order they should appear |
| `audio` | file | none | mp3, m4a, aac, wav, ogg, opus, flac; trimmed to the video and faded out |
| `sort` | `none` \| `name` | `none` | `name` sorts files by file name |
| `width`, `height` | 16 to 3840 | 1920 × 1080 | rounded down to even numbers |
| `fps` | 1 to 60 | 30 | |
| `duration` | seconds, > 0 to 60 | 2 | how long each still image is shown. For a timelapse use `1/fps` |
| `fit` | `contain` \| `cover` \| `blur` | `contain` | letterbox, crop to fill, or letterbox over a blurred copy |
| `background` | CSS color | `#000000` | bars color for `contain` |
| `transition` | `none` \| `crossfade` | `none` | |
| `transition_duration` | 0 to 5 s | 0.5 | adds this much time between images |
| `format` | `mp4` \| `webm` \| `gif` | `mp4` | H.264 / VP9 / GIF |
| `quality` | `low` \| `medium` \| `high` | `medium` | |
| `animate` | bool | true | play frames of animated GIF / WebP / APNG with their own timing |
| `video_audio` | bool | false | keep the sound of video clips (placed where each clip plays; music, if any, is mixed in at half volume) |

Video clips (mp4, mov, webm, mkv, avi, wmv, flv, 3gp, mpg, ts, mts, ogv…) play at full length,
resampled to `fps` and fitted with the same `fit` mode as images.

Output length = sum of: `duration` per still image, own timing for animations, full length for clips,
plus `transition_duration` between neighbours. Each part is rounded to whole frames at `fps`.
Limit: `PIXREEL_MAX_SECONDS` (default 1800 s).

## Job object

```json
{
  "id": "4f1c…",
  "status": "done",            // queued | processing | done | error
  "progress": 1.0,             // 0..1
  "message": "done",
  "files": 12,
  "format": "mp4",
  "created_at": 1767225600.1,
  "finished_at": 1767225612.4,
  "expires_at": 1767229212.4,
  "result": {
    "url": "/v1/jobs/4f1c…/result",
    "frames": 721,
    "seconds": 24.033,
    "size_bytes": 3481234,
    "skipped": []              // files that could not be decoded, with the reason
  },
  "error": "…"                 // only when status is error
}
```

## Errors

| Code | When |
|---|---|
| 400 | no files, too many files |
| 401 | missing or wrong `X-API-Key` |
| 404 | job not found or expired |
| 409 | result requested before the job is done |
| 413 | file or upload too large |
| 415 | unsupported file extension |
| 422 | invalid option value |
| 503 | queue is full, retry later |

Error body: `{"detail": "message"}`.

## Other endpoints

- `GET /health`: `{"status": "ok", "version": "0.1.0", "queue": 0}`
- `GET /v1/formats`: supported input and output formats and server limits.

## Examples

```bash
curl -F files=@a.jpg -F files=@b.heic -F files=@c.cr2 \
     -F duration=3 -F transition=crossfade -F fit=blur \
     -o video.mp4 https://<base>/v1/convert
```

```js
const form = new FormData();
for (const f of files) form.append("files", f);
form.append("format", "webm");
const job = await (await fetch(`${base}/v1/jobs`, { method: "POST", body: form })).json();
```
