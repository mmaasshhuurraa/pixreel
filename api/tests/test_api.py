import io
import json
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.decoders import load_frames
from app.main import app

client = TestClient(app)


def _gradient(w=320, h=200, mode="RGB"):
    x = np.linspace(0, 255, w, dtype=np.uint8)
    arr = np.stack([np.tile(x, (h, 1)), np.tile(x[::-1], (h, 1)), np.full((h, w), 128, np.uint8)], -1)
    im = Image.fromarray(arr)
    return im.convert(mode) if mode != "RGB" else im


@pytest.fixture(scope="session")
def samples(tmp_path_factory) -> dict[str, Path]:
    d = tmp_path_factory.mktemp("samples")
    out: dict[str, Path] = {}

    def save(name, im, **kw):
        p = d / name
        im.save(p, **kw)
        out[name] = p

    save("photo.jpg", _gradient(), quality=90)
    save("alpha.png", _gradient(mode="RGBA"))
    save("photo.webp", _gradient())
    save("photo.bmp", _gradient())
    save("photo.tga", _gradient())
    save("icon.ico", _gradient(64, 64))
    save("photo.avif", _gradient())
    save("photo.heic", _gradient())
    save("photo.jxl", _gradient())
    save("photo16.tiff", Image.fromarray((np.arange(200 * 320).reshape(200, 320) % 65535).astype(np.uint16)))
    frames = [_gradient().rotate(a) for a in (0, 90, 180)]
    save("anim.gif", frames[0], save_all=True, append_images=frames[1:], duration=200, loop=0)

    svg = d / "logo.svg"
    svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="tomato"/></svg>')
    out["logo.svg"] = svg

    pdf = d / "doc.pdf"
    _gradient().save(pdf, save_all=True, append_images=[_gradient().rotate(180)])
    out["doc.pdf"] = pdf

    if shutil.which("convert"):
        psd = d / "layers.psd"
        subprocess.run(["convert", str(out["photo.jpg"]), str(psd)], check=True)
        out["layers.psd"] = psd
    return out


def test_formats():
    r = client.get("/v1/formats")
    assert r.status_code == 200
    data = r.json()
    assert "heic" in data["input"]["raster"]
    assert "cr2" in data["input"]["raw"]


@pytest.mark.parametrize(
    "name,frames",
    [("photo.jpg", 1), ("alpha.png", 1), ("photo.webp", 1), ("photo.bmp", 1), ("photo.tga", 1),
     ("icon.ico", 1), ("photo.avif", 1), ("photo.heic", 1), ("photo.jxl", 1), ("photo16.tiff", 1),
     ("anim.gif", 3), ("logo.svg", 1), ("doc.pdf", 2), ("layers.psd", 1)],
)
def test_decoders(samples, name, frames):
    if name not in samples:
        pytest.skip("tool not installed")
    result = list(load_frames(samples[name]))
    assert len(result) == frames
    for im, _ in result:
        assert im.mode in ("RGB", "RGBA")
        assert im.width > 0


def _probe(data: bytes, suffix: str, tmp_path: Path) -> dict:
    p = tmp_path / f"out{suffix}"
    p.write_bytes(data)
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)],
        capture_output=True, check=True,
    )
    return json.loads(r.stdout)


def test_job_flow_all_formats(samples, tmp_path):
    files = [("files", (n, p.read_bytes())) for n, p in samples.items()]
    r = client.post("/v1/jobs", files=files, data={
        "width": "640", "height": "360", "fps": "10", "duration": "0.5",
        "fit": "blur", "transition": "crossfade", "transition_duration": "0.2",
    })
    assert r.status_code == 202, r.text
    job_id = r.json()["id"]
    for _ in range(300):
        job = client.get(f"/v1/jobs/{job_id}").json()
        if job["status"] not in ("queued", "processing"):
            break
        time.sleep(0.1)
    assert job["status"] == "done", job
    assert job["result"]["skipped"] == []

    video = client.get(f"/v1/jobs/{job_id}/result")
    assert video.headers["content-type"] == "video/mp4"
    info = _probe(video.content, ".mp4", tmp_path)
    stream = info["streams"][0]
    assert stream["codec_name"] == "h264"
    assert (stream["width"], stream["height"]) == (640, 360)
    assert float(info["format"]["duration"]) > 5

    assert client.delete(f"/v1/jobs/{job_id}").status_code == 204
    assert client.get(f"/v1/jobs/{job_id}").status_code == 404


@pytest.mark.parametrize("fmt,codec", [("webm", "vp9"), ("gif", "gif"), ("mov", "h264"), ("mkv", "h264"),
                                       ("avi", "mpeg4"), ("wmv", "wmv2")])
def test_convert_sync(samples, tmp_path, fmt, codec):
    files = [("files", (n, samples[n].read_bytes())) for n in ("photo.jpg", "alpha.png")]
    r = client.post("/v1/convert", files=files, data={"width": "320", "height": "240", "fps": "5", "duration": "0.4", "format": fmt})
    assert r.status_code == 200, r.text
    assert _probe(r.content, f".{fmt}", tmp_path)["streams"][0]["codec_name"] == codec


def test_audio(samples, tmp_path):
    wav = tmp_path / "a.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=d=10", str(wav)], check=True)
    files = [("files", ("photo.jpg", samples["photo.jpg"].read_bytes())), ("audio", ("a.wav", wav.read_bytes()))]
    r = client.post("/v1/convert", files=files, data={"width": "320", "height": "240", "duration": "2"})
    assert r.status_code == 200, r.text
    info = _probe(r.content, ".mp4", tmp_path)
    assert {s["codec_type"] for s in info["streams"]} == {"video", "audio"}
    assert float(info["format"]["duration"]) < 3


def test_rejects_unknown_format():
    r = client.post("/v1/jobs", files=[("files", ("notes.txt", b"hello"))])
    assert r.status_code == 415


def test_skips_broken_file(samples):
    files = [("files", ("photo.jpg", samples["photo.jpg"].read_bytes())), ("files", ("broken.png", b"not a png"))]
    r = client.post("/v1/convert", files=files, data={"width": "160", "height": "120", "duration": "0.2"})
    assert r.status_code == 200


@pytest.fixture(scope="session")
def clips(tmp_path_factory) -> dict[str, Path]:
    d = tmp_path_factory.mktemp("clips")
    with_sound = d / "clip.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=d=1.5:s=320x240:r=25",
                    "-f", "lavfi", "-i", "sine=d=1.5", "-shortest", "-pix_fmt", "yuv420p", str(with_sound)], check=True)
    portrait = d / "portrait.mov"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=d=1:s=180x320:r=30",
                    "-pix_fmt", "yuv420p", str(portrait)], check=True)
    return {"clip.mp4": with_sound, "portrait.mov": portrait}


@pytest.mark.parametrize("fit", ["contain", "cover", "blur"])
def test_images_and_videos(samples, clips, tmp_path, fit):
    files = [
        ("files", ("photo.jpg", samples["photo.jpg"].read_bytes())),
        ("files", ("clip.mp4", clips["clip.mp4"].read_bytes())),
        ("files", ("portrait.mov", clips["portrait.mov"].read_bytes())),
    ]
    r = client.post("/v1/convert", files=files, data={
        "width": "320", "height": "180", "fps": "10", "duration": "1", "fit": fit,
        "transition": "crossfade", "transition_duration": "0.5",
    })
    assert r.status_code == 200, r.text
    info = _probe(r.content, ".mp4", tmp_path)
    # 1 s photo + 1.5 s clip + 1 s clip + 2 transitions of 0.5 s = 4.5 s
    assert abs(float(info["format"]["duration"]) - 4.5) < 0.15
    # Clip sound is off by default.
    assert {s["codec_type"] for s in info["streams"]} == {"video"}


def test_video_audio_on(samples, clips, tmp_path):
    files = [
        ("files", ("photo.jpg", samples["photo.jpg"].read_bytes())),
        ("files", ("clip.mp4", clips["clip.mp4"].read_bytes())),
    ]
    r = client.post("/v1/convert", files=files, data={
        "width": "320", "height": "180", "fps": "10", "duration": "1", "video_audio": "true",
    })
    assert r.status_code == 200, r.text
    info = _probe(r.content, ".mp4", tmp_path)
    assert {s["codec_type"] for s in info["streams"]} == {"video", "audio"}
    assert abs(float(info["format"]["duration"]) - 2.5) < 0.15


def test_video_audio_with_music_webm(clips, tmp_path):
    wav = tmp_path / "m.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=f=220:d=10", str(wav)], check=True)
    files = [("files", ("clip.mp4", clips["clip.mp4"].read_bytes())), ("audio", ("m.wav", wav.read_bytes()))]
    r = client.post("/v1/convert", files=files, data={
        "width": "320", "height": "180", "fps": "10", "format": "webm", "video_audio": "true",
    })
    assert r.status_code == 200, r.text
    info = _probe(r.content, ".webm", tmp_path)
    assert {s["codec_name"] for s in info["streams"]} == {"vp9", "opus"}


@pytest.mark.parametrize("effect", ["crossfade", "fadeblack", "fadewhite", "slideleft", "slideright", "slideup",
                                    "slidedown", "wipeleft", "wiperight", "wipeup", "wipedown", "zoom", "circle", "random"])
def test_transitions(samples, tmp_path, effect):
    files = [("files", (n, samples[n].read_bytes())) for n in ("photo.jpg", "alpha.png", "photo.webp")]
    r = client.post("/v1/convert", files=files, data={
        "width": "160", "height": "90", "fps": "10", "duration": "0.5",
        "transition": effect, "transition_duration": "0.5",
    })
    assert r.status_code == 200, r.text
    # 3 × 0.5 s + 2 transitions × 0.5 s
    assert abs(float(_probe(r.content, ".mp4", tmp_path)["format"]["duration"]) - 2.5) < 0.15


def test_unknown_transition():
    r = client.post("/v1/jobs", files=[("files", ("a.jpg", b"x"))], data={"transition": "spin"})
    assert r.status_code == 422


def test_blend_endpoints():
    import numpy as np
    from app.transitions import TRANSITIONS, blend
    a = np.zeros((40, 60, 3), np.uint8)
    b = np.full((40, 60, 3), 200, np.uint8)
    for name in TRANSITIONS:
        assert blend(name, a, b, 0.0001).mean() < 20, name
        assert blend(name, a, b, 0.9999).mean() > 180, name


@pytest.mark.parametrize("fmt,acodec", [("avi", "mp3"), ("wmv", "wmav2"), ("mov", "aac"), ("mkv", "aac")])
def test_audio_in_other_containers(samples, tmp_path, fmt, acodec):
    wav = tmp_path / "a.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=d=5", str(wav)], check=True)
    files = [("files", ("photo.jpg", samples["photo.jpg"].read_bytes())), ("audio", ("a.wav", wav.read_bytes()))]
    r = client.post("/v1/convert", files=files, data={"width": "320", "height": "240", "duration": "1", "format": fmt})
    assert r.status_code == 200, r.text
    assert acodec in {s["codec_name"] for s in _probe(r.content, f".{fmt}", tmp_path)["streams"]}
