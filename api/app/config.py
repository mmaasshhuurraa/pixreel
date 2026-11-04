import os
from dataclasses import dataclass, field


def _list(name: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, "").split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    max_files: int = int(os.getenv("PIXREEL_MAX_FILES", "300"))
    max_file_mb: int = int(os.getenv("PIXREEL_MAX_FILE_MB", "100"))
    max_total_mb: int = int(os.getenv("PIXREEL_MAX_TOTAL_MB", "1000"))
    max_queue: int = int(os.getenv("PIXREEL_MAX_QUEUE", "20"))
    workers: int = int(os.getenv("PIXREEL_WORKERS", "1"))
    job_ttl: int = int(os.getenv("PIXREEL_JOB_TTL", "3600"))  # seconds
    # Empty list = API is open. Otherwise clients must send X-API-Key.
    api_keys: list[str] = field(default_factory=lambda: _list("PIXREEL_API_KEYS"))
    cors_origins: list[str] = field(default_factory=lambda: _list("PIXREEL_CORS_ORIGINS") or ["*"])


settings = Settings()
