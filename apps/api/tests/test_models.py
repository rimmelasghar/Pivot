import struct
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pivot_api.settings import get_settings
from pivot_api.store.files import LocalFileStore, display_name

GLB = b"glTF" + struct.pack("<II", 2, 12)
GLTF = b'{"asset": {"version": "2.0"}}'


@pytest.fixture
def session(client: TestClient) -> dict[str, str]:
    return client.post("/api/sessions").json()


def upload(client: TestClient, session: dict[str, str], name: str, data: bytes, token=None):
    return client.post(
        f"/api/sessions/{session['sessionId']}/model",
        files={"file": (name, data, "application/octet-stream")},
        headers={"Authorization": f"Bearer {token or session['desktopToken']}"},
    )


def test_upload_glb_and_serve(client: TestClient, session: dict[str, str]) -> None:
    response = upload(client, session, "Duck.glb", GLB)
    assert response.status_code == 200
    body = response.json()
    assert body["modelName"] == "Duck.glb"
    assert body["modelUrl"].startswith(f"/api/files/{session['sessionId']}/model.glb?v=")

    served = client.get(body["modelUrl"])
    assert served.status_code == 200
    assert served.content == GLB
    assert served.headers["content-type"] == "model/gltf-binary"

    state = client.get(f"/api/sessions/{session['sessionId']}").json()
    assert state["modelUrl"] == body["modelUrl"]
    assert state["modelName"] == "Duck.glb"


def test_upload_gltf(client: TestClient, session: dict[str, str]) -> None:
    response = upload(client, session, "scene.gltf", GLTF)
    assert response.status_code == 200
    assert "/model.gltf?v=" in response.json()["modelUrl"]


def test_replacing_model_removes_old_file(client: TestClient, session: dict[str, str]) -> None:
    upload(client, session, "a.gltf", GLTF)
    upload(client, session, "b.glb", GLB)
    sid = session["sessionId"]
    assert client.get(f"/api/files/{sid}/model.gltf").status_code == 404
    assert client.get(f"/api/files/{sid}/model.glb").status_code == 200


@pytest.mark.parametrize("name", ["model.obj", "model.fbx", "notes.txt", "noext"])
def test_rejects_other_types(client: TestClient, session: dict[str, str], name: str) -> None:
    response = upload(client, session, name, GLB)
    assert response.status_code == 415
    assert response.json()["detail"] == "unsupported_type"


def test_rejects_wrong_content(client: TestClient, session: dict[str, str]) -> None:
    assert upload(client, session, "x.glb", b"nope").json()["detail"] == "invalid_model"
    assert upload(client, session, "x.gltf", b"{not json").json()["detail"] == "invalid_model"
    assert upload(client, session, "x.glb", b"").json()["detail"] == "invalid_model"


def test_rejects_too_large(
    client: TestClient, session: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(client.app.state.files, "max_bytes", 16)
    response = upload(client, session, "big.glb", GLB + b"\0" * 32)
    assert response.status_code == 413
    assert response.json()["detail"] == "too_large"


def test_default_limit_matches_setting(client: TestClient) -> None:
    assert client.app.state.files.max_bytes == get_settings().max_upload_mb * 1024 * 1024


def test_requires_desktop_token(client: TestClient, session: dict[str, str]) -> None:
    assert upload(client, session, "a.glb", GLB, token="wrong").status_code == 403


def test_unknown_session(client: TestClient) -> None:
    fake = {"sessionId": "missing123", "desktopToken": "x"}
    assert upload(client, fake, "a.glb", GLB).status_code == 404


def test_file_paths_are_not_traversable(client: TestClient, session: dict[str, str]) -> None:
    upload(client, session, "a.glb", GLB)
    sid = session["sessionId"]
    for bad in ["..%2Fsettings.py", "settings.py", "model.py"]:
        assert client.get(f"/api/files/{sid}/{bad}").status_code == 404
    assert client.get("/api/files/..%2F..%2Fetc/passwd").status_code == 404


def test_display_name_strips_paths() -> None:
    assert display_name("../../evil.glb") == "evil.glb"
    assert display_name(r"C:\Users\me\car.glb") == "car.glb"
    assert display_name("") == "model"


async def test_cleanup_removes_expired_sessions(client: TestClient, tmp_path: Path) -> None:
    store = client.app.state.store
    files = LocalFileStore(tmp_path, 1024)
    live = await store.create()
    (tmp_path / live.id).mkdir()
    (tmp_path / "expired123").mkdir()
    assert await files.cleanup_expired(store) == 1
    assert (tmp_path / live.id).exists()
    assert not (tmp_path / "expired123").exists()
