import secrets

_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"


def nanoid(size: int = 10) -> str:
    """URL-safe random id (nanoid alphabet)."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(size))


def token() -> str:
    return secrets.token_urlsafe(24)
