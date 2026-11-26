import httpx
import pytest
from fastapi.testclient import TestClient

from pivot_api.routes import public_url
from pivot_api.settings import Settings, get_settings


def mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_discovers_quick_tunnel_hostname() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://tunnel:2000/quicktunnel"
        return httpx.Response(200, json={"hostname": "abc-def.trycloudflare.com"})

    url = await public_url.discover(Settings(), mock_client(handler))
    assert url == "https://abc-def.trycloudflare.com"


async def test_env_override_wins() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("tunnel must not be queried")

    settings = Settings(public_base_url="https://pivot.example.com/")
    assert await public_url.discover(settings, mock_client(handler)) == "https://pivot.example.com"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"hostname": ""}),
        httpx.Response(200, text="not json"),
        httpx.Response(500),
    ],
)
async def test_not_ready(response: httpx.Response) -> None:
    assert await public_url.discover(Settings(), mock_client(lambda r: response)) is None


async def test_unreachable_tunnel() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    assert await public_url.discover(Settings(), mock_client(handler)) is None


def test_endpoint_uses_env_override(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://pivot.example.com")
    get_settings.cache_clear()
    response = client.get("/api/public-url")
    assert response.status_code == 200
    assert response.json() == {"url": "https://pivot.example.com"}


def test_endpoint_503_until_tunnel_ready(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def none(settings: Settings) -> None:
        return None

    monkeypatch.setattr(public_url, "discover", none)
    response = client.get("/api/public-url")
    assert response.status_code == 503
    assert response.json()["detail"] == "tunnel_not_ready"
