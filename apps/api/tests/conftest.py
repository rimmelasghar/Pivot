from collections.abc import Iterator

import pytest
from fakeredis import FakeAsyncRedis
from fastapi.testclient import TestClient

from pivot_api.main import create_app


@pytest.fixture
def redis() -> FakeAsyncRedis:
    return FakeAsyncRedis(decode_responses=True)


@pytest.fixture
def client(redis: FakeAsyncRedis) -> Iterator[TestClient]:
    with TestClient(create_app(redis=redis)) as c:
        yield c
