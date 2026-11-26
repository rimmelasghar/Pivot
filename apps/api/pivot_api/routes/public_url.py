import httpx
from fastapi import APIRouter, HTTPException

from pivot_api.deps import SettingsDep
from pivot_api.settings import Settings

router = APIRouter(tags=["public-url"])


async def discover(settings: Settings, client: httpx.AsyncClient | None = None) -> str | None:
    """PUBLIC_BASE_URL wins; otherwise ask cloudflared's metrics server for the quick tunnel."""
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    own = client is None
    client = client or httpx.AsyncClient(timeout=2.0)
    try:
        response = await client.get(settings.tunnel_metrics_url)
        response.raise_for_status()
        hostname = response.json().get("hostname")
    except (httpx.HTTPError, ValueError, AttributeError):
        return None
    finally:
        if own:
            await client.aclose()
    return f"https://{hostname}" if hostname else None


@router.get("/api/public-url")
async def public_url(settings: SettingsDep) -> dict[str, str]:
    url = await discover(settings)
    if url is None:
        # The desktop retries every second while the tunnel starts.
        raise HTTPException(status_code=503, detail="tunnel_not_ready")
    return {"url": url}
