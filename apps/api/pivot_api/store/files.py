import asyncio
import json
import logging
import re
import shutil
from pathlib import Path

from fastapi import UploadFile

from pivot_api.store.redis_store import SessionStore

log = logging.getLogger(__name__)

ALLOWED_SUFFIXES = {".glb", ".gltf"}
CHUNK = 1024 * 1024
_SESSION_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class UploadError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def display_name(filename: str) -> str:
    """Strip any path and control characters; keep it short."""
    name = Path(filename.replace("\\", "/")).name
    name = re.sub(r"[^\w.\- ()]", "_", name).strip() or "model"
    return name[:80]


def model_path(root: Path, session_id: str, suffix: str) -> Path:
    if not _SESSION_ID.match(session_id) or suffix not in ALLOWED_SUFFIXES:
        raise UploadError("bad_request", "Invalid path")
    return root / session_id / f"model{suffix}"


def _check_content(suffix: str, head: bytes) -> None:
    if suffix == ".glb" and head[:4] != b"glTF":
        raise UploadError("invalid_model", "Not a binary glTF (GLB) file")
    if suffix == ".gltf":
        try:
            data = json.loads(head)
        except (ValueError, UnicodeDecodeError) as exc:
            raise UploadError("invalid_model", "Not a valid glTF JSON file") from exc
        if not isinstance(data, dict) or "asset" not in data:
            raise UploadError("invalid_model", "glTF JSON has no 'asset' field")


class LocalFileStore:
    def __init__(self, root: str | Path, max_bytes: int) -> None:
        self.root = Path(root)
        self.max_bytes = max_bytes

    async def save(self, session_id: str, upload: UploadFile) -> tuple[Path, str]:
        """Validate and store an upload. Returns (path, display name)."""
        name = display_name(upload.filename or "model")
        suffix = Path(name).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise UploadError("unsupported_type", "Only .glb and .gltf files are supported", 415)

        dest = model_path(self.root, session_id, suffix)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".part")
        size = 0
        try:
            with tmp.open("wb") as out:
                while chunk := await upload.read(CHUNK):
                    size += len(chunk)
                    if size > self.max_bytes:
                        mb = self.max_bytes // (1024 * 1024)
                        raise UploadError("too_large", f"File is larger than {mb} MB", 413)
                    out.write(chunk)
            if size == 0:
                raise UploadError("invalid_model", "File is empty")
            # GLB: magic in the first 4 bytes. glTF JSON: parse the whole file.
            head = tmp.read_bytes() if suffix == ".gltf" else tmp.open("rb").read(4)
            _check_content(suffix, head)
            for old in dest.parent.glob("model.*"):
                if old != tmp:
                    old.unlink()
            tmp.replace(dest)
        finally:
            tmp.unlink(missing_ok=True)
        return dest, name

    def find(self, session_id: str, filename: str) -> Path | None:
        suffix = Path(filename).suffix.lower()
        if filename != f"model{suffix}":
            return None
        try:
            path = model_path(self.root, session_id, suffix)
        except UploadError:
            return None
        return path if path.is_file() else None

    async def cleanup_expired(self, store: SessionStore) -> int:
        """Delete model folders whose session no longer exists."""
        if not self.root.is_dir():
            return 0
        removed = 0
        for folder in self.root.iterdir():
            if folder.is_dir() and await store.get(folder.name) is None:
                shutil.rmtree(folder, ignore_errors=True)
                removed += 1
        return removed

    async def cleanup_loop(self, store: SessionStore, interval: float = 60) -> None:
        while True:
            try:
                await self.cleanup_expired(store)
            except Exception:
                log.exception("model cleanup failed")
            await asyncio.sleep(interval)
