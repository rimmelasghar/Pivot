"""WebSocket hub: authenticates a desktop or phone and relays phone motion to the desktop."""

import asyncio
import contextlib
import logging
import secrets
import time
from typing import cast

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from redis.asyncio.client import PubSub

from pivot_api.store.redis_store import Session, SessionStore, channel
from pivot_api.ws import bus
from pivot_api.ws.messages import (
    CLOSE_ALREADY_PAIRED,
    CLOSE_BAD_TOKEN,
    CLOSE_SESSION_EXPIRED,
    PHONE_TO_DESKTOP,
    Error,
    ErrorCode,
    Hello,
    ModelName,
    Peer,
    Ping,
    Pong,
    encode,
    parse_client_message,
)

log = logging.getLogger(__name__)
router = APIRouter()

OTHER: dict[str, bus.Target] = {"desktop": "phone", "phone": "desktop"}


class Connection:
    def __init__(self, ws: WebSocket, store: SessionStore, session: Session, role: str) -> None:
        self.ws = ws
        self.store = store
        self.redis: Redis = store.redis
        self.session = session
        self.role = role
        self.id = secrets.token_hex(8)

    @property
    def sid(self) -> str:
        return self.session.id

    async def send(self, payload: str) -> None:
        await self.ws.send_text(payload)

    async def send_peer_state(self) -> None:
        other = OTHER[self.role]
        present = await self.store.present(self.sid, other)
        await self.send(encode(Peer(connected=present)))
        if self.role == "phone":
            session = await self.store.get(self.sid)
            if session and session.model_name:
                await self.send(encode(ModelName(name=session.model_name)))

    async def handle(self, raw: str) -> None:
        msg = parse_client_message(raw)
        if msg is None:
            return  # malformed: dropped
        if isinstance(msg, PHONE_TO_DESKTOP):
            if self.role == "phone":
                await bus.publish_raw(self.redis, self.sid, "desktop", raw)
        elif isinstance(msg, Ping):
            await self.send(encode(Pong(t="pong", ts=msg.ts)))
            await self.store.refresh_presence(self.sid, self.role, self.id)
            await self.store.touch(self.sid)
        elif isinstance(msg, Hello):
            await self.send_peer_state()
        # Pong from a client needs no action.

    async def read_loop(self) -> None:
        while True:
            raw = await self.ws.receive_text()
            await self.handle(raw)

    async def relay_loop(self, pubsub: PubSub) -> None:
        try:
            async for item in pubsub.listen():
                if item.get("type") != "message":
                    continue
                payload = bus.unpack(cast(str, item["data"]), self.role)
                if payload is not None:
                    await self.send(payload)
        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe()
                await pubsub.aclose()


async def reject(ws: WebSocket, code: ErrorCode, message: str, close_code: int) -> None:
    await ws.send_text(encode(Error(code=code, message=message)))
    await ws.close(code=close_code)


@router.websocket("/ws/{session_id}")
async def websocket(ws: WebSocket, session_id: str, role: str = "", token: str = "") -> None:
    await ws.accept()
    store: SessionStore = ws.app.state.store
    session = await store.get(session_id)
    if session is None:
        msg = "This session has expired."
        return await reject(ws, "session_expired", msg, CLOSE_SESSION_EXPIRED)
    if role not in OTHER:
        return await reject(ws, "bad_role", "role must be desktop or phone.", CLOSE_BAD_TOKEN)
    expected = session.desktop_token if role == "desktop" else session.pair_token
    if not secrets.compare_digest(token, expected):
        return await reject(ws, "bad_token", "This link is not valid.", CLOSE_BAD_TOKEN)

    conn = Connection(ws, store, session, role)
    if not await store.claim_presence(session_id, role, conn.id):
        return await reject(
            ws, "already_paired", "Another phone is already connected.", CLOSE_ALREADY_PAIRED
        )

    started = time.monotonic()
    log.info("ws open session=%s role=%s conn=%s", session_id, role, conn.id)
    # Subscribe before announcing ourselves so no relayed message is missed.
    pubsub = store.redis.pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(channel(session_id))
    relay = asyncio.create_task(conn.relay_loop(pubsub))
    try:
        await store.touch(session_id)
        await bus.publish(store.redis, session_id, OTHER[role], Peer(connected=True))
        await conn.send_peer_state()
        await conn.read_loop()
    except WebSocketDisconnect:
        pass
    finally:
        relay.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await relay
        await store.release_presence(session_id, role, conn.id)
        if not await store.present(session_id, role):
            await bus.publish(store.redis, session_id, OTHER[role], Peer(connected=False))
        log.info("ws close conn=%s after %.1fs", conn.id, time.monotonic() - started)
