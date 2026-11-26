from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    public_base_url: str | None = None
    tunnel_metrics_url: str = "http://tunnel:2000/quicktunnel"
    redis_url: str = "redis://redis:6379/0"
    max_upload_mb: int = 50
    session_ttl_seconds: int = 1800
    storage_backend: str = "local"
    storage_dir: str = "data/models"


@lru_cache
def get_settings() -> Settings:
    return Settings()
