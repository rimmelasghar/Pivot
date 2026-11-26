import time
from collections.abc import Callable

MAX_MESSAGE_BYTES = 1024
MAX_MESSAGES_PER_SECOND = 120


class RateLimiter:
    """Token bucket: allows bursts up to `rate` and `rate` messages per second on average."""

    def __init__(
        self, rate: float = MAX_MESSAGES_PER_SECOND, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.rate = rate
        self.tokens = rate
        self.clock = clock
        self.updated = clock()
        self.dropped = 0

    def allow(self) -> bool:
        now = self.clock()
        self.tokens = min(self.rate, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        self.dropped += 1
        return False


def too_large(raw: str) -> bool:
    # A str of at most MAX/4 chars cannot exceed MAX bytes in UTF-8: skip encoding then.
    return len(raw) > MAX_MESSAGE_BYTES // 4 and len(raw.encode()) > MAX_MESSAGE_BYTES
