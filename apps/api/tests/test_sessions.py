import asyncio
import re

from fakeredis import FakeAsyncRedis
from fastapi.testclient import TestClient

from pivot_api.settings import get_settings
from pivot_api.store.redis_store import SessionStore


def test_create_session_returns_ids_and_tokens(client: TestClient) -> None:
    response = client.post("/api/sessions")
    assert response.status_code == 201
    body = response.json()
    assert re.fullmatch(r"[A-Za-z0-9_-]{10}", body["sessionId"])
    assert len(body["desktopToken"]) >= 24
    assert body["pairUrl"].startswith(f"/c/{body['sessionId']}?t=")
    assert body["desktopToken"] not in body["pairUrl"]


def test_get_session_state(client: TestClient) -> None:
    sid = client.post("/api/sessions").json()["sessionId"]
    body = client.get(f"/api/sessions/{sid}").json()
    assert body == {
        "sessionId": sid,
        "modelUrl": None,
        "modelName": None,
        "phoneConnected": False,
    }


def test_unknown_session_is_404(client: TestClient) -> None:
    response = client.get("/api/sessions/nope")
    assert response.status_code == 404
    assert response.json()["detail"] == "session_expired"


async def test_session_key_has_ttl(redis: FakeAsyncRedis) -> None:
    ttl_setting = get_settings().session_ttl_seconds
    store = SessionStore(redis, ttl=ttl_setting)
    session = await store.create()
    ttl = await redis.ttl(f"session:{session.id}")
    assert 0 < ttl <= ttl_setting


async def test_session_expires(redis: FakeAsyncRedis) -> None:
    store = SessionStore(redis, ttl=60)
    session = await store.create()
    await redis.pexpire(f"session:{session.id}", 5)
    await asyncio.sleep(0.05)
    assert await store.get(session.id) is None
    assert await store.touch(session.id) is False


async def test_touch_extends_ttl(redis: FakeAsyncRedis) -> None:
    store = SessionStore(redis, ttl=60)
    session = await store.create()
    await redis.expire(f"session:{session.id}", 5)
    assert await store.touch(session.id)
    assert await redis.ttl(f"session:{session.id}") > 5


async def test_single_phone_slot(redis: FakeAsyncRedis) -> None:
    store = SessionStore(redis, ttl=60)
    session = await store.create()
    assert await store.claim_presence(session.id, "phone", "a")
    assert not await store.claim_presence(session.id, "phone", "b")
    await store.release_presence(session.id, "phone", "b")  # not the holder: no effect
    assert await store.present(session.id, "phone")
    await store.release_presence(session.id, "phone", "a")
    assert not await store.present(session.id, "phone")
    assert await store.claim_presence(session.id, "phone", "b")


async def test_new_desktop_takes_over(redis: FakeAsyncRedis) -> None:
    store = SessionStore(redis, ttl=60)
    session = await store.create()
    assert await store.claim_presence(session.id, "desktop", "a")
    assert await store.claim_presence(session.id, "desktop", "b")
    await store.release_presence(session.id, "desktop", "a")
    assert await store.present(session.id, "desktop")
