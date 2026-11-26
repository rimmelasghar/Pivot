from dataclasses import dataclass
from typing import cast

from redis.asyncio import Redis

from pivot_api.ids import nanoid, token

# Presence keys are refreshed on every ping (5 s), so a crashed
# connection frees its slot within this many seconds.
PRESENCE_SECONDS = 20


def session_key(session_id: str) -> str:
    return f"session:{session_id}"


def presence_key(session_id: str, role: str) -> str:
    return f"session:{session_id}:{role}"


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

    async def claim_presence(
        self, session_id: str, role: str, conn_id: str, client_id: str = ""
    ) -> bool:
        """Mark a connection present.

        Only one phone may hold the slot, but the same phone (same `client_id`) may take it
        back, e.g. after a network drop the server has not noticed yet. A new desktop
        connection simply takes over the desktop slot.
        """
        key = presence_key(session_id, role)
        value = f"{client_id}:{conn_id}"
        if role != "phone":
            await self.redis.set(key, value, ex=PRESENCE_SECONDS)
            return True
        if await self.redis.set(key, value, nx=True, ex=PRESENCE_SECONDS):
            return True
        holder = await self.redis.get(key)
        if client_id and holder is not None and holder.split(":", 1)[0] == client_id:
            await self.redis.set(key, value, ex=PRESENCE_SECONDS)
            return True
        return False

    async def refresh_presence(
        self, session_id: str, role: str, conn_id: str, client_id: str = ""
    ) -> None:
        key = presence_key(session_id, role)
        value = f"{client_id}:{conn_id}"
        if role == "desktop":
            await self.redis.set(key, value, ex=PRESENCE_SECONDS)
        elif await self.redis.get(key) == value:
            await self.redis.expire(key, PRESENCE_SECONDS)

    async def release_presence(
        self, session_id: str, role: str, conn_id: str, client_id: str = ""
    ) -> None:
        key = presence_key(session_id, role)
        if await self.redis.get(key) == f"{client_id}:{conn_id}":
            await self.redis.delete(key)

    async def present(self, session_id: str, role: str) -> bool:
        return bool(await self.redis.exists(presence_key(session_id, role)))
