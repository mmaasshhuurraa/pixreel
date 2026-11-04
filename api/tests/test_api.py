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


@pytest.mark.parametrize("fmt,codec", [("webm", "vp9"), ("gif", "gif")])
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
