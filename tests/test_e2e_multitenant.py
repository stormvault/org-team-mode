"""End-to-end multi-tenant concurrency and isolation integration test."""

import asyncio
import zipfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from emacs_web.app import app
from emacs_web.config import Settings, get_settings


@pytest.fixture
def e2e_settings(tmp_path: Path) -> Settings:
    """Fixture providing isolated storage settings for E2E multi-tenant testing."""
    storage_dir = tmp_path / "e2e_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        test_auth_override=True,
        emacs_jail_storage_dir=storage_dir,
    )


@pytest.mark.asyncio
async def test_multitenant_concurrent_isolation(e2e_settings: Settings) -> None:
    """Verify zero cross-tenant contamination during concurrent multi-tenant execution."""
    app.dependency_overrides[get_settings] = lambda: e2e_settings
    transport = ASGITransport(app=app)

    async with (
        AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={
                "Authorization": "Bearer mock:tenant_alice_e2e:alice@corp.org:Alice"
            },
        ) as alice_client,
        AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"Authorization": "Bearer mock:tenant_bob_e2e:bob@corp.org:Bob"},
        ) as bob_client,
    ):
        # 1. Concurrently initialize starter environments
        res_alice_init, res_bob_init = await asyncio.gather(
            alice_client.post("/api/v1/env/init"),
            bob_client.post("/api/v1/env/init"),
        )
        assert res_alice_init.status_code == 200
        assert res_bob_init.status_code == 200
        assert res_alice_init.json()["uid"] == "tenant_alice_e2e"
        assert res_bob_init.json()["uid"] == "tenant_bob_e2e"

        # 2. Concurrently write confidential documents into respective workspaces
        alice_secret = (
            "#+TITLE: Alice Private Project\n* SECRET\nAlice-Confidential-Token-12345\n"
        )
        bob_secret = (
            "#+TITLE: Bob Private Project\n* SECRET\nBob-Confidential-Token-67890\n"
        )

        res_alice_put, res_bob_put = await asyncio.gather(
            alice_client.put(
                "/api/v1/files/workspace/alice_secret.org",
                json={"content": alice_secret},
            ),
            bob_client.put(
                "/api/v1/files/workspace/bob_secret.org",
                json={"content": bob_secret},
            ),
        )
        assert res_alice_put.status_code == 200
        assert res_bob_put.status_code == 200

        # 3. Concurrently execute batch operations (Elisp eval & Org export)
        res_alice_eval, res_bob_eval, res_alice_exp, res_bob_exp = await asyncio.gather(
            alice_client.post("/api/v1/org/eval", json={"expression": "(+ 111 222)"}),
            bob_client.post("/api/v1/org/eval", json={"expression": "(+ 333 444)"}),
            alice_client.post(
                "/api/v1/org/export",
                json={
                    "org_file": "workspace/alice_secret.org",
                    "export_format": "html",
                },
            ),
            bob_client.post(
                "/api/v1/org/export",
                json={"org_file": "workspace/bob_secret.org", "export_format": "html"},
            ),
        )

        assert res_alice_eval.status_code == 200
        assert "333" in res_alice_eval.json()["output"]

        assert res_bob_eval.status_code == 200
        assert "777" in res_bob_eval.json()["output"]

        assert res_alice_exp.status_code == 200
        assert "Alice-Confidential-Token-12345" in res_alice_exp.json()["content"]

        assert res_bob_exp.status_code == 200
        assert "Bob-Confidential-Token-67890" in res_bob_exp.json()["content"]

        # 4. Assert file isolation across list operations
        alice_files = (await alice_client.get("/api/v1/files")).json()["files"]
        bob_files = (await bob_client.get("/api/v1/files")).json()["files"]

        alice_filenames = [f["filename"] for f in alice_files]
        bob_filenames = [f["filename"] for f in bob_files]

        assert "workspace/alice_secret.org" in alice_filenames
        assert "workspace/bob_secret.org" not in alice_filenames

        assert "workspace/bob_secret.org" in bob_filenames
        assert "workspace/alice_secret.org" not in bob_filenames

        # 5. Assert direct cross-tenant file read fails with 404
        alice_cross_read = await alice_client.get(
            "/api/v1/files/workspace/bob_secret.org"
        )
        assert alice_cross_read.status_code == 404

        bob_cross_read = await bob_client.get(
            "/api/v1/files/workspace/alice_secret.org"
        )
        assert bob_cross_read.status_code == 404

        # 6. Assert in-sandbox filesystem probing confirms zero cross-contamination
        alice_probe = await alice_client.post(
            "/api/v1/org/eval",
            json={"expression": '(file-exists-p "bob_secret.org")'},
        )
        assert alice_probe.status_code == 200
        assert "nil" in alice_probe.json()["output"]

        bob_probe = await bob_client.post(
            "/api/v1/org/eval",
            json={"expression": '(file-exists-p "alice_secret.org")'},
        )
        assert bob_probe.status_code == 200
        assert "nil" in bob_probe.json()["output"]

        # 7. Physical disk archive inspection
        alice_zip_path = e2e_settings.emacs_jail_storage_dir / "tenant_alice_e2e.zip"
        bob_zip_path = e2e_settings.emacs_jail_storage_dir / "tenant_bob_e2e.zip"

        assert alice_zip_path.is_file()
        assert bob_zip_path.is_file()

        with zipfile.ZipFile(alice_zip_path, "r") as zf_alice:
            alice_members = zf_alice.namelist()
            assert "workspace/alice_secret.org" in alice_members
            assert "workspace/bob_secret.org" not in alice_members

        with zipfile.ZipFile(bob_zip_path, "r") as zf_bob:
            bob_members = zf_bob.namelist()
            assert "workspace/bob_secret.org" in bob_members
            assert "workspace/alice_secret.org" not in bob_members

    app.dependency_overrides.clear()
