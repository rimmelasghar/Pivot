"""WebSocket protocol. Mirrors packages/protocol/src/index.ts; see packages/protocol/protocol.md."""

import math
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError, field_validator

Role = Literal["desktop", "phone"]
Mode = Literal["full", "tilt"]
ErrorCode = Literal[
    "session_expired",
    "already_paired",
    "bad_token",
    "bad_role",
    "invalid_message",
    "rate_limited",
]

CLOSE_BAD_TOKEN = 4401
CLOSE_SESSION_EXPIRED = 4404
CLOSE_ALREADY_PAIRED = 4409


class Msg(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class ClientInfo(Msg):
    ua: str = Field(max_length=512)
    platform: str = Field(max_length=64)


class Hello(Msg):
    t: Literal["hello"]
    role: Role
    client: ClientInfo


class Peer(Msg):
    t: Literal["peer"] = "peer"
    connected: bool


class Quat(Msg):
    t: Literal["q"]
    q: tuple[float, float, float, float]
    s: int = Field(ge=0)
    ts: float

    @field_validator("q")
    @classmethod
    def _finite(cls, v: tuple[float, ...]) -> tuple[float, ...]:
        if not all(math.isfinite(c) for c in v):
            raise ValueError("quaternion components must be finite")
        return v


class Recenter(Msg):
    t: Literal["recenter"]


class SetMode(Msg):
    t: Literal["mode"]
    mode: Mode


class ModelName(Msg):
    t: Literal["model"] = "model"
    name: str


class Ping(Msg):
    t: Literal["ping"]
    ts: float


class Pong(Msg):
    t: Literal["pong"]
    ts: float


class Error(Msg):
    t: Literal["error"] = "error"
    code: ErrorCode
    message: str


AnyClientMessage = Hello | Quat | Recenter | SetMode | Ping | Pong
ClientMessage = Annotated[AnyClientMessage, Field(discriminator="t")]
PHONE_TO_DESKTOP = (Quat, Recenter, SetMode)

_client_adapter: TypeAdapter[ClientMessage] = TypeAdapter(ClientMessage)


def parse_client_message(raw: str | bytes) -> AnyClientMessage | None:
    """Validate a client message. Returns None for anything malformed."""
    try:
        return _client_adapter.validate_json(raw)
    except ValidationError:
        return None


def encode(msg: Msg) -> str:
    return msg.model_dump_json()
