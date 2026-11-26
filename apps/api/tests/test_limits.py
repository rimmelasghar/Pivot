import json
import time

from fastapi.testclient import TestClient

from pivot_api.ws.limits import MAX_MESSAGE_BYTES, RateLimiter, too_large
from tests.test_ws import connect, recv


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_rate_limiter_allows_120_per_second() -> None:
    clock = Clock()
    limiter = RateLimiter(120, clock)
    allowed = sum(limiter.allow() for _ in range(200))
    assert allowed == 120
    assert limiter.dropped == 80

    # Steady 120/s keeps flowing; 240/s gets half through.
    allowed = 0
    for _ in range(240):
        clock.now += 1 / 240
        allowed += limiter.allow()
    assert 115 <= allowed <= 125


def test_rate_limiter_refills() -> None:
    clock = Clock()
    limiter = RateLimiter(120, clock)
    for _ in range(120):
        limiter.allow()
    assert not limiter.allow()
    clock.now += 0.5
    assert sum(limiter.allow() for _ in range(100)) == 60


def test_too_large() -> None:
    assert not too_large("x" * MAX_MESSAGE_BYTES)
    assert too_large("x" * (MAX_MESSAGE_BYTES + 1))
    # Multi-byte characters count in bytes.
    assert too_large("é" * 600)
    assert not too_large("é" * 200)


def test_oversized_message_is_dropped(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "desktop") as desktop:
        recv(desktop)
        with connect(client, session, "phone") as phone:
            recv(phone)
            recv(desktop)
            padded = '{"t": "recenter"' + " " * 1100 + "}"
            phone.send_text(padded)
            phone.send_text(json.dumps({"t": "mode", "mode": "tilt"}))
            assert recv(desktop) == {"t": "mode", "mode": "tilt"}


def test_flood_is_rate_limited(client: TestClient, session: dict[str, str]) -> None:
    with connect(client, session, "desktop") as desktop:
        recv(desktop)
        with connect(client, session, "phone") as phone:
            recv(phone)
            recv(desktop)
            for i in range(300):
                phone.send_text(json.dumps({"t": "q", "q": [0, 0, 0, 1], "s": i, "ts": 0}))
            # Let the bucket refill so the marker message gets through; it arrives after
            # every relayed q because the hub handles one connection's messages in order.
            time.sleep(1.1)
            phone.send_text(json.dumps({"t": "mode", "mode": "full"}))
            received = 0
            while True:
                msg = recv(desktop)
                if msg["t"] == "mode":
                    break
                received += 1
            # The 120-message burst, plus a few refilled while the flood was sent.
            assert 120 <= received < 160
