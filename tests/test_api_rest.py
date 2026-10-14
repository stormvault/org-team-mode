"""Integration tests for FastAPI REST API endpoints."""

from pathlib import Path
from unittest import mock

import pytest
from httpx import ASGITransport, AsyncClient

from emacs_web.app import app
from emacs_web.config import Settings, get_settings


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    """Fixture providing isolated storage settings for REST tests."""
    storage_dir = tmp_path / "rest_users"
    storage_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        test_auth_override=True,
        emacs_jail_storage_dir=storage_dir,
    )


@pytest.fixture
async def client(test_settings: Settings) -> AsyncClient:
    """Async test client with dependency overrides and mock auth token."""
    app.dependency_overrides[get_settings] = lambda: test_settings
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer mock:rest_user_01:rest@test.com:RestUser"},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_env_init_and_status(client: AsyncClient) -> None:
    """Verify POST /api/v1/env/init and GET /api/v1/env/status endpoints."""
    # Test initialization
    res_init = await client.post(
        "/api/v1/env/init", json={"description": "Test environment"}
    )
    assert res_init.status_code == 200
    data_init = res_init.json()
    assert data_init["status"] == "success"
    assert data_init["uid"] == "rest_user_01"
    assert data_init["file_count"] > 0

    # Test status
    res_status = await client.get("/api/v1/env/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert data_status["status"] == "success"
    assert data_status["uid"] == "rest_user_01"
    assert "archive_size_bytes" in data_status["metadata"]


@pytest.mark.asyncio
async def test_env_unauthorized() -> None:
    """Verify request without Authorization header returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as unauth_client:
        res = await unauth_client.get("/api/v1/env/status")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_files_crud_operations(client: AsyncClient) -> None:
    """Verify file operations: list, put, get, and delete."""
    # Initialize env first
    await client.post("/api/v1/env/init")

    # List files
    res_list = await client.get("/api/v1/files")
    assert res_list.status_code == 200
    files = res_list.json()["files"]
    assert any(f["filename"] == "workspace/notes.org" for f in files)

    # Put a new file
    file_path = "workspace/test_doc.org"
    doc_content = "#+TITLE: Custom Doc\n* TODO Test Task\n"
    res_put = await client.put(
        f"/api/v1/files/{file_path}",
        json={"content": doc_content},
    )
    assert res_put.status_code == 200
    assert res_put.json()["bytes_written"] == len(doc_content.encode("utf-8"))

    # Get the file
    res_get = await client.get(f"/api/v1/files/{file_path}")
    assert res_get.status_code == 200
    assert res_get.json()["content"] == doc_content

    # Delete the file
    res_del = await client.delete(f"/api/v1/files/{file_path}")
    assert res_del.status_code == 200

    # Get should now return 404
    res_get_after = await client.get(f"/api/v1/files/{file_path}")
    assert res_get_after.status_code == 404


@pytest.mark.asyncio
async def test_org_operations(client: AsyncClient) -> None:
    """Verify Org-mode export, babel, tangle, agenda, and eval endpoints."""
    await client.post("/api/v1/env/init")

    # 1. Org Agenda
    res_agenda = await client.get("/api/v1/org/agenda")
    assert res_agenda.status_code == 200
    data_agenda = res_agenda.json()
    assert data_agenda["status"] == "success"
    assert data_agenda["task_count"] >= 1

    # 2. Org Eval
    res_eval = await client.post("/api/v1/org/eval", json={"expression": "(+ 40 2)"})
    assert res_eval.status_code == 200
    data_eval = res_eval.json()
    assert data_eval["status"] == "success"
    assert "42" in data_eval["output"]

    # 3. Org Export
    res_export = await client.post(
        "/api/v1/org/export",
        json={"org_file": "workspace/notes.org", "export_format": "html"},
    )
    assert res_export.status_code == 200
    data_export = res_export.json()
    assert data_export["status"] == "success"
    assert (
        "<html" in data_export["content"] or "<!DOCTYPE html" in data_export["content"]
    )

    # 4. Org Babel
    res_babel = await client.post(
        "/api/v1/org/babel",
        json={"org_file": "workspace/notes.org"},
    )
    assert res_babel.status_code == 200
    data_babel = res_babel.json()
    assert data_babel["status"] == "success"
    assert "#+RESULTS:" in data_babel["content"]

    # 5. Org Tangle
    tangle_org = (
        "#+TITLE: Tangled Test\n"
        "#+begin_src python :tangle script.py\n"
        "print('Tangled python!')\n"
        "#+end_src\n"
    )
    await client.put("/api/v1/files/workspace/tangle.org", json={"content": tangle_org})
    res_tangle = await client.post(
        "/api/v1/org/tangle",
        json={"org_file": "workspace/tangle.org"},
    )
    assert res_tangle.status_code == 200
    data_tangle = res_tangle.json()
    assert data_tangle["status"] == "success"
    assert any("script.py" in f for f in data_tangle["tangled_files"])


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient) -> None:
    """Verify GET /health returns 200 ok."""
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_app_exception_handlers(client: AsyncClient) -> None:
    """Verify custom exception handlers translate emacs_jail errors into correct HTTP codes."""
    from emacs_jail.exceptions import (
        InvalidUserIdError,
        LockTimeoutError,
        OrgModeError,
        SandboxExecutionError,
        ZipSlipSecurityError,
    )

    # 1. LockTimeoutError -> 423
    with mock.patch(
        "emacs_web.routers.env.UserArchiveManager.get_metadata",
        side_effect=LockTimeoutError("Busy"),
    ):
        res = await client.get("/api/v1/env/status")
        assert res.status_code == 423
        assert "Busy" in res.json()["detail"]

    # 2. ZipSlipSecurityError -> 400
    with mock.patch(
        "emacs_web.routers.files.UserArchiveManager.read_file",
        side_effect=ZipSlipSecurityError("Slip"),
    ):
        res = await client.get("/api/v1/files/workspace/evil.org")
        assert res.status_code == 400
        assert "Slip" in res.json()["detail"]

    # 3. InvalidUserIdError -> 400
    with mock.patch(
        "emacs_web.routers.env.UserArchiveManager.get_metadata",
        side_effect=InvalidUserIdError("Bad ID"),
    ):
        res = await client.get("/api/v1/env/status")
        assert res.status_code == 400
        assert "Bad ID" in res.json()["detail"]

    # 4. OrgModeError -> 500
    with mock.patch(
        "emacs_web.routers.org.EmacsOrgManager.eval_elisp",
        side_effect=OrgModeError("Org failure"),
    ):
        res = await client.post("/api/v1/org/eval", json={"expression": "nil"})
        assert res.status_code == 500
        assert "Org failure" in res.json()["detail"]

    # 5. SandboxExecutionError -> 500
    with mock.patch(
        "emacs_web.routers.org.EmacsOrgManager.eval_elisp",
        side_effect=SandboxExecutionError("Sandbox fail"),
    ):
        res = await client.post("/api/v1/org/eval", json={"expression": "nil"})
        assert res.status_code == 500
        assert "Sandbox fail" in res.json()["detail"]
