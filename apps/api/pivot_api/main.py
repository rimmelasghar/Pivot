import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis

from pivot_api.routes import models, sessions
from pivot_api.settings import get_settings
from pivot_api.store.files import LocalFileStore
from pivot_api.store.redis_store import SessionStore


def create_app(redis: Redis | None = None) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = redis or Redis.from_url(settings.redis_url, decode_responses=True)
        app.state.redis = client
        app.state.store = SessionStore(client, settings.session_ttl_seconds)
        app.state.files = LocalFileStore(settings.storage_dir, settings.max_upload_mb * 1024 * 1024)
        cleanup = asyncio.create_task(app.state.files.cleanup_loop(app.state.store))
        try:
            yield
        finally:
            cleanup.cancel()
            if redis is None:
                await client.aclose()

    app = FastAPI(
        title="Pivot API",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(sessions.router)
    app.include_router(models.router)
    return app


app = create_app()
