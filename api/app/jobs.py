"""In-memory job queue. Good enough for a single free-tier container."""

from __future__ import annotations

import shutil
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from .config import settings
from .render import RenderOptions, render_video

MEDIA_TYPES = {
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "avi": "video/x-msvideo",
    "wmv": "video/x-ms-wmv",
    "gif": "image/gif",
}


@dataclass
class Job:
    id: str
    dir: Path
    inputs: list[Path]
    options: RenderOptions
    audio: list[Path] = field(default_factory=list)  # background music, in order
    status: str = "queued"  # queued | processing | done | error
    progress: float = 0.0
    message: str = ""
    error: str | None = None
    result: dict | None = None
    created_at: float = field(default_factory=time.time)
    finished_at: float | None = None

    @property
    def output(self) -> Path:
        return self.dir / f"pixreel.{self.options.format}"

    def public(self) -> dict:
        data = {
            "id": self.id,
            "status": self.status,
            "progress": round(self.progress, 3),
            "message": self.message,
            "files": len(self.inputs),
            "format": self.options.format,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "expires_at": (self.finished_at or self.created_at) + settings.job_ttl,
        }
        if self.error:
            data["error"] = self.error
        if self.result:
            data["result"] = {**self.result, "url": f"/v1/jobs/{self.id}/result"}
        return data


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=settings.workers)
        self.root = Path(tempfile.gettempdir()) / "pixreel"
        self.root.mkdir(parents=True, exist_ok=True)
        threading.Thread(target=self._janitor, daemon=True).start()

    def new_dir(self) -> tuple[str, Path]:
        job_id = uuid.uuid4().hex
        d = self.root / job_id
        (d / "in").mkdir(parents=True)
        return job_id, d

    def submit(self, job: Job) -> Job:
        with self._lock:
            self._jobs[job.id] = job
        self._pool.submit(self._run, job)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def delete(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job:
            shutil.rmtree(job.dir, ignore_errors=True)
        return job is not None

    def queued_count(self) -> int:
        with self._lock:
            return sum(1 for j in self._jobs.values() if j.status in ("queued", "processing"))

    def _run(self, job: Job) -> None:
        job.status = "processing"

        def progress(p: float, msg: str) -> None:
            job.progress = p
            job.message = msg

        try:
            job.result = render_video(job.inputs, job.output, job.options, job.audio, progress)
            job.status = "done"
            job.progress = 1.0
            job.message = "done"
            # Inputs are no longer needed.
            shutil.rmtree(job.dir / "in", ignore_errors=True)
        except Exception as e:  # noqa: BLE001
            job.status = "error"
            job.error = str(e)
        finally:
            job.finished_at = time.time()

    def _janitor(self) -> None:
        while True:
            time.sleep(60)
            now = time.time()
            with self._lock:
                expired = [
                    j.id for j in self._jobs.values()
                    if j.finished_at and now - j.finished_at > settings.job_ttl
                ]
            for job_id in expired:
                self.delete(job_id)


store = JobStore()
