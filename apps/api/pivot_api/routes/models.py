import secrets
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from pivot_api.deps import StoreDep
from pivot_api.schemas import CamelModel
from pivot_api.store.files import LocalFileStore, UploadError
from pivot_api.ws import bus
from pivot_api.ws.messages import ModelName

router = APIRouter(tags=["models"])

MEDIA_TYPES = {".glb": "model/gltf-binary", ".gltf": "model/gltf+json"}


class ModelUploaded(CamelModel):
    model_url: str
    model_name: str


def bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


@router.post("/api/sessions/{session_id}/model", response_model=ModelUploaded)
async def upload_model(
    session_id: str,
    file: UploadFile,
    request: Request,
    store: StoreDep,
    authorization: Annotated[str | None, Header()] = None,
) -> ModelUploaded | JSONResponse:
    session = await store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session_expired")
    token = bearer(authorization)
    if token is None or not secrets.compare_digest(token, session.desktop_token):
        raise HTTPException(status_code=403, detail="bad_token")

    files: LocalFileStore = request.app.state.files
    try:
        path, name = await files.save(session_id, file)
    except UploadError as exc:
        return JSONResponse({"detail": exc.code, "message": exc.message}, status_code=exc.status)

    # Version query defeats browser caching when a new model replaces the old one.
    url = f"/api/files/{session_id}/{path.name}?v={secrets.token_hex(4)}"
    await store.set_model(session_id, url, name)
    await bus.publish(store.redis, session_id, "phone", ModelName(name=name))
    return ModelUploaded(model_url=url, model_name=name)


@router.get("/api/files/{session_id}/{filename}")
async def get_file(session_id: str, filename: str, request: Request) -> FileResponse:
    files: LocalFileStore = request.app.state.files
    path = files.find(session_id, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="not_found")
    return FileResponse(
        path,
        media_type=MEDIA_TYPES[path.suffix],
        headers={"Cache-Control": "private, max-age=3600"},
    )
