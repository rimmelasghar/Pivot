"""Redis pub/sub fan-out between the connections of one session.

Each published item is `<target>|<json>`, where target is `desktop`, `phone` or `both`.
Every api worker subscribes for the connections it holds, so the api can scale past
one process.
"""

from typing import Literal

from redis.asyncio import Redis

from pivot_api.store.redis_store import channel
from pivot_api.ws.messages import Msg, encode

Target = Literal["desktop", "phone", "both"]


async def publish_raw(redis: Redis, session_id: str, target: Target, payload: str) -> None:
    await redis.publish(channel(session_id), f"{target}|{payload}")


async def publish(redis: Redis, session_id: str, target: Target, msg: Msg) -> None:
    await publish_raw(redis, session_id, target, encode(msg))


def unpack(item: str, role: str) -> str | None:
    """Return the payload if this role is a recipient, else None."""
    target, sep, payload = item.partition("|")
    if not sep or (target != "both" and target != role):
        return None
    return payload
