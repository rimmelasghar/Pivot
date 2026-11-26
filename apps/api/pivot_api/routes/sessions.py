from fastapi import APIRouter, HTTPException

from pivot_api.deps import StoreDep
from pivot_api.schemas import CamelModel

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreated(CamelModel):
    session_id: str
    desktop_token: str
    pair_url: str


class SessionState(CamelModel):
    session_id: str
    model_url: str | None
    model_name: str | None
    phone_connected: bool


@router.post("", response_model=SessionCreated, status_code=201)
async def create_session(store: StoreDep) -> SessionCreated:
    session = await store.create()
    return SessionCreated(
        session_id=session.id,
        desktop_token=session.desktop_token,
        pair_url=f"/c/{session.id}?t={session.pair_token}",
    )


@router.get("/{session_id}", response_model=SessionState)
async def get_session(session_id: str, store: StoreDep) -> SessionState:
    session = await store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session_expired")
    await store.touch(session_id)
    return SessionState(
        session_id=session.id,
        model_url=session.model_url,
        model_name=session.model_name,
        phone_connected=await store.phone_connected(session_id),
    )
