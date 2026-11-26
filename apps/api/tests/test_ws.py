import json
import struct

import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

GLB = b"glTF" + struct.pack("<II", 2, 12)


@pytest.fixture
def session(client: TestClient) -> dict[str, str]:
    data = client.post("/api/sessions").json()
    data["pairToken"] = data["pairUrl"].split("?t=")[1]
    return data


def connect(
    client: TestClient,
    session: dict[str, str],
    role: str,
    token: str | None = None,
    cid: str = "",
):
    if token is None:
        token = session["desktopToken"] if role == "desktop" else session["pairToken"]
    url = f"/ws/{session['sessionId']}?role={role}&token={token}&cid={cid}"
    return client.websocket_connect(url)


def recv(ws: WebSocketTestSession) -> dict:
    return json.loads(ws.receive_text())


def recv_until(ws: WebSocketTestSession, t: str) -> dict:
    for _ in range(10):
        msg = recv(ws)
        if msg["t"] == t:
            return msg
    raise AssertionError(f"no {t} message")


def test_desktop_alone_sees_no_peer(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "desktop") as desktop:
        assert recv(desktop) == {"t": "peer", "connected": False}


def test_pairing_and_motion_relay(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "desktop") as desktop:
        assert recv(desktop) == {"t": "peer", "connected": False}
        with connect(client, session, "phone") as phone:
            assert recv(phone) == {"t": "peer", "connected": True}
            assert recv(desktop) == {"t": "peer", "connected": True}

            q = {"t": "q", "q": [0.1, 0.2, 0.3, 0.9], "s": 1, "ts": 123}
            phone.send_text(json.dumps(q))
            assert recv(desktop) == q

            phone.send_text(json.dumps({"t": "recenter"}))
            assert recv(desktop) == {"t": "recenter"}
            phone.send_text(json.dumps({"t": "mode", "mode": "tilt"}))
            assert recv(desktop) == {"t": "mode", "mode": "tilt"}
        assert recv(desktop) == {"t": "peer", "connected": False}


def test_phone_sees_desktop_leave(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "phone") as phone:
        assert recv(phone) == {"t": "peer", "connected": False}
        with connect(client, session, "desktop") as desktop:
            recv(desktop)
            assert recv(phone) == {"t": "peer", "connected": True}
        assert recv(phone) == {"t": "peer", "connected": False}


def test_second_phone_gets_already_paired(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "phone") as phone:
        recv(phone)
        with connect(client, session, "phone") as second:
            assert recv(second)["code"] == "already_paired"
            with pytest.raises(WebSocketDisconnect) as exc:
                second.receive_text()
            assert exc.value.code == 4409
    # After the first phone leaves, a new one may pair.
    with connect(client, session, "phone") as again:
        assert recv(again)["t"] == "peer"


def test_ping_pong(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "phone") as phone:
        recv(phone)
        phone.send_text(json.dumps({"t": "ping", "ts": 42}))
        assert recv(phone) == {"t": "pong", "ts": 42.0}


def test_hello_returns_peer_state(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "phone") as phone:
        recv(phone)
        hello = {"t": "hello", "role": "phone", "client": {"ua": "test", "platform": "x"}}
        phone.send_text(json.dumps(hello))
        assert recv(phone) == {"t": "peer", "connected": False}


def test_phone_gets_model_name(client: TestClient, session: dict[str, str]) -> None:
    client.post(
        f"/api/sessions/{session['sessionId']}/model",
        files={"file": ("Duck.glb", GLB)},
        headers={"Authorization": f"Bearer {session['desktopToken']}"},
    )
    with connect(client, session, "phone") as phone:
        recv(phone)
        assert recv(phone) == {"t": "model", "name": "Duck.glb"}
        client.post(
            f"/api/sessions/{session['sessionId']}/model",
            files={"file": ("Fox.glb", GLB)},
            headers={"Authorization": f"Bearer {session['desktopToken']}"},
        )
        assert recv_until(phone, "model") == {"t": "model", "name": "Fox.glb"}


def test_malformed_and_wrong_direction_messages_are_dropped(
    client: TestClient, session: dict[str, str]
) -> None:
    with connect(client, session, "desktop") as desktop:
        recv(desktop)
        with connect(client, session, "phone") as phone:
            recv(phone)
            recv(desktop)
            phone.send_text("garbage")
            phone.send_text(json.dumps({"t": "q", "q": [1, 2], "s": 1, "ts": 1}))
            # Desktop may not send motion to the phone.
            desktop.send_text(json.dumps({"t": "q", "q": [0, 0, 0, 1], "s": 1, "ts": 1}))
            phone.send_text(json.dumps({"t": "recenter"}))
            assert recv(desktop) == {"t": "recenter"}
            phone.send_text(json.dumps({"t": "ping", "ts": 1}))
            assert recv(phone)["t"] == "pong"


@pytest.mark.parametrize(
    ("role", "token", "code", "close"),
    [
        ("desktop", "wrong", "bad_token", 4401),
        ("phone", "wrong", "bad_token", 4401),
        ("tablet", "x", "bad_role", 4401),
    ],
)
def test_rejects_bad_credentials(
    client: TestClient, session: dict[str, str], role: str, token: str, code: str, close: int
) -> None:
    with connect(client, session, role, token) as ws:
        assert recv(ws)["code"] == code
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == close


def test_desktop_token_does_not_work_for_phone(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "phone", session["desktopToken"]) as ws:
        assert recv(ws)["code"] == "bad_token"


def test_unknown_session(client: TestClient) -> None:
    with client.websocket_connect("/ws/missing?role=desktop&token=x") as ws:
        assert recv(ws)["code"] == "session_expired"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == 4404


def test_same_phone_reconnects_while_old_socket_lingers(
    client: TestClient, session: dict[str, str]
) -> None:
    with connect(client, session, "phone", cid="phone-a") as old:
        recv(old)
        with connect(client, session, "phone", cid="phone-a") as new:
            assert recv(new)["t"] == "peer"
            with connect(client, session, "phone", cid="phone-b") as other:
                assert recv(other)["code"] == "already_paired"
