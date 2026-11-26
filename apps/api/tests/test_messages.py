import json

import pytest

from pivot_api.ws.messages import (
    Error,
    Hello,
    ModelName,
    Peer,
    Ping,
    Pong,
    Quat,
    Recenter,
    SetMode,
    encode,
    parse_client_message,
)

VALID = [
    ({"t": "hello", "role": "phone", "client": {"ua": "Mozilla", "platform": "iPhone"}}, Hello),
    ({"t": "q", "q": [0, 0, 0, 1], "s": 12, "ts": 1700000000000}, Quat),
    ({"t": "recenter"}, Recenter),
    ({"t": "mode", "mode": "tilt"}, SetMode),
    ({"t": "ping", "ts": 1}, Ping),
    ({"t": "pong", "ts": 1}, Pong),
]

INVALID = [
    "not json",
    "42",
    "null",
    json.dumps({"t": "nope"}),
    json.dumps({"t": "hello", "role": "tablet", "client": {"ua": "", "platform": ""}}),
    json.dumps({"t": "hello", "role": "phone"}),
    json.dumps({"t": "q", "q": [0, 0, 1], "s": 1, "ts": 1}),
    json.dumps({"t": "q", "q": [0, 0, 0, "x"], "s": 1, "ts": 1}),
    json.dumps({"t": "q", "q": [0, 0, 0, "1"], "s": 1, "ts": 1}),
    json.dumps({"t": "q", "q": [0, 0, 0, 1], "s": "1", "ts": 1}),
    '{"t": "q", "q": [0, 0, 0, Infinity], "s": 1, "ts": 1}',
    json.dumps({"t": "q", "q": [0, 0, 0, 1], "s": -1, "ts": 1}),
    json.dumps({"t": "q", "q": [0, 0, 0, 1], "s": 1, "ts": 1, "extra": True}),
    json.dumps({"t": "mode", "mode": "spin"}),
    json.dumps({"t": "ping"}),
    # Server-only types are not accepted from clients.
    json.dumps({"t": "peer", "connected": True}),
    json.dumps({"t": "model", "name": "x"}),
    json.dumps({"t": "error", "code": "already_paired", "message": "x"}),
]


@pytest.mark.parametrize(("data", "cls"), VALID)
def test_accepts_client_messages(data: dict, cls: type) -> None:
    msg = parse_client_message(json.dumps(data))
    assert isinstance(msg, cls)
    assert json.loads(encode(msg)) == data | ({"q": data["q"]} if "q" in data else {})


@pytest.mark.parametrize("raw", INVALID)
def test_rejects_malformed(raw: str) -> None:
    assert parse_client_message(raw) is None


def test_server_messages_encode_to_protocol_shape() -> None:
    assert json.loads(encode(Peer(connected=True))) == {"t": "peer", "connected": True}
    assert json.loads(encode(ModelName(name="Duck.glb"))) == {"t": "model", "name": "Duck.glb"}
    assert json.loads(encode(Error(code="already_paired", message="m"))) == {
        "t": "error",
        "code": "already_paired",
        "message": "m",
    }
