from typing import Annotated

from fastapi import Depends, Request

from pivot_api.settings import Settings, get_settings
from pivot_api.store.redis_store import SessionStore


def get_store(request: Request) -> SessionStore:
    return request.app.state.store


StoreDep = Annotated[SessionStore, Depends(get_store)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
