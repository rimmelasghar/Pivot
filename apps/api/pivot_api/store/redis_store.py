from dataclasses import dataclass
from typing import cast

from redis.asyncio import Redis

from pivot_api.ids import nanoid, token

# The phone slot lock is refreshed on every ping (5 s), so a crashed
# connection frees the slot within this many seconds.
PHONE_LOCK_SECONDS = 20


def session_key(session_id: str) -> str:
    return f"session:{session_id}"


def phone_lock_key(session_id: str) -> str:
    return f"session:{session_id}:phone"


def channel(session_id: str) -> str:
    return f"session:{session_id}"


@dataclass(frozen=True)
class Session:
    id: str
    desktop_token: str
    pair_token: str
    model_url: str | None = None
    model_name: str | None = None


class SessionStore:
    """Sessions are Redis hashes that expire after `ttl` seconds of inactivity."""

    def __init__(self, redis: Redis, ttl: int) -> None:
        self.redis = redis
        self.ttl = ttl

    async def create(self) -> Session:
        session = Session(id=nanoid(), desktop_token=token(), pair_token=token())
        key = session_key(session.id)
        await self.redis.hset(
            key,
            mapping={"desktop_token": session.desktop_token, "pair_token": session.pair_token},
        )
        await self.redis.expire(key, self.ttl)
        return session

    async def get(self, session_id: str) -> Session | None:
        data = cast(dict[str, str], await self.redis.hgetall(session_key(session_id)))
        if not data:
            return None
        return Session(
            id=session_id,
            desktop_token=data["desktop_token"],
            pair_token=data["pair_token"],
            model_url=data.get("model_url"),
            model_name=data.get("model_name"),
        )

    async def touch(self, session_id: str) -> bool:
        """Extend the inactivity TTL. Returns False if the session is gone."""
        return bool(await self.redis.expire(session_key(session_id), self.ttl))

    async def set_model(self, session_id: str, url: str, name: str) -> None:
        await self.redis.hset(
            session_key(session_id), mapping={"model_url": url, "model_name": name}
        )
        await self.touch(session_id)

    async def claim_phone(self, session_id: str, conn_id: str) -> bool:
        """Take the single phone slot. Fails while another phone holds it."""
        return bool(
            await self.redis.set(
                phone_lock_key(session_id), conn_id, nx=True, ex=PHONE_LOCK_SECONDS
            )
        )

    async def refresh_phone(self, session_id: str, conn_id: str) -> None:
        key = phone_lock_key(session_id)
        if await self.redis.get(key) == conn_id:
            await self.redis.expire(key, PHONE_LOCK_SECONDS)

    async def release_phone(self, session_id: str, conn_id: str) -> None:
        key = phone_lock_key(session_id)
        if await self.redis.get(key) == conn_id:
            await self.redis.delete(key)

    async def phone_connected(self, session_id: str) -> bool:
        return bool(await self.redis.exists(phone_lock_key(session_id)))
