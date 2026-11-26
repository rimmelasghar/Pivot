from collections.abc import Iterator
from pathlib import Path

import pytest
from fakeredis import FakeAsyncRedis
from fastapi.testclient import TestClient

from pivot_api.main import create_app
from pivot_api.settings import get_settings


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "models"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def redis() -> FakeAsyncRedis:
    return FakeAsyncRedis(decode_responses=True)


@pytest.fixture
def client(redis: FakeAsyncRedis) -> Iterator[TestClient]:
    with TestClient(create_app(redis=redis)) as c:
        yield c


@pytest.fixture
def session(client: TestClient) -> dict[str, str]:
    data = client.post("/api/sessions").json()
    data["pairToken"] = data["pairUrl"].split("?t=")[1]
    return data
