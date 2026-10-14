"""Tests for TenantAgentFactory, Antigravity agent orchestration, and chat endpoints."""

from collections.abc import AsyncGenerator
from pathlib import Path
from unittest import mock

import pytest
from httpx import ASGITransport, AsyncClient

from emacs_web.agent.factory import TenantAgentFactory
from emacs_web.app import app
from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.config import Settings, get_settings


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    """Fixture providing isolated storage settings for agent tests."""
    storage_dir = tmp_path / "data" / "users"
    storage_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        test_auth_override=True,
        emacs_jail_storage_dir=storage_dir,
        emacs_agent_persistence="EPHEMERAL",
    )


def test_tenant_agent_factory_config(test_settings: Settings) -> None:
    """Verify TenantAgentFactory generates LocalAgentConfig with deny-by-default and tenant predicate."""
    factory = TenantAgentFactory(test_settings)
    tenant = AuthenticatedTenant(uid="tenant_safe_01")
    config = factory.create_config(tenant)

    assert config.app_data_dir is not None
    assert "tenant_safe_01" in config.app_data_dir
    assert config.tools is not None
    assert len(config.tools) > 0

    # Inspect policies
    assert config.policies is not None
    assert len(config.policies) >= 2

    # Check deny-by-default and allow policy predicate
    deny_policy = config.policies[0]
    allow_policy = config.policies[1]
    assert deny_policy.tool == "*"
    assert str(deny_policy.decision).endswith("DENY")

    assert allow_policy.tool == "emacs_*"
    assert str(allow_policy.decision).endswith("APPROVE")
    assert allow_policy.when is not None

    # Test policy predicate enforcement
    assert allow_policy.when({"uid": "tenant_safe_01"}) is True
    assert allow_policy.when({"uid": "other_tenant"}) is False


def test_tenant_agent_factory_invalid_uid(test_settings: Settings) -> None:
    """Verify TenantAgentFactory rejects invalid or traversal tenant UIDs."""
    factory = TenantAgentFactory(test_settings)
    bad_tenant = AuthenticatedTenant(uid="../traversal_user")
    with pytest.raises(ValueError):
        factory.create_config(bad_tenant)


def test_tenant_agent_factory_persistence_modes(tmp_path: Path) -> None:
    """Verify ephemeral mode creates distinct agents while longrunning reuses resident instances."""
    storage_dir = tmp_path / "data" / "users"
    storage_dir.mkdir(parents=True, exist_ok=True)

    # 1. Ephemeral Mode
    ephemeral_settings = Settings(
        emacs_jail_storage_dir=storage_dir,
        emacs_agent_persistence="EPHEMERAL",
    )
    e_factory = TenantAgentFactory(ephemeral_settings)
    tenant_a = AuthenticatedTenant(uid="tenant_a")
    agent_e1 = e_factory.get_agent(tenant_a)
    agent_e2 = e_factory.get_agent(tenant_a)
    assert agent_e1 is not agent_e2

    # 2. Long-Running Mode
    longrunning_settings = Settings(
        emacs_jail_storage_dir=storage_dir,
        emacs_agent_persistence="LONGRUNNING",
    )
    lr_factory = TenantAgentFactory(longrunning_settings)
    agent_lr1 = lr_factory.get_agent(tenant_a)
    agent_lr2 = lr_factory.get_agent(tenant_a)
    assert agent_lr1 is agent_lr2

    # Different tenant gets different resident agent
    tenant_b = AuthenticatedTenant(uid="tenant_b")
    agent_lr_b = lr_factory.get_agent(tenant_b)
    assert agent_lr_b is not agent_lr1


@pytest.fixture
async def agent_client(test_settings: Settings) -> AsyncGenerator[AsyncClient, None]:
    """Client for testing agent routes with test_settings override."""
    app.dependency_overrides[get_settings] = lambda: test_settings
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer mock:agent_user_10:agent@test.com:AgentUser"},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_agent_chat_endpoint(agent_client: AsyncClient) -> None:
    """Verify POST /api/v1/agent/chat executes agent turn and returns JSON response."""
    with mock.patch(
        "emacs_web.agent.factory.TenantAgentFactory.execute_turn",
        return_value="Agent executed emacs export for you.",
    ):
        res = await agent_client.post(
            "/api/v1/agent/chat",
            json={"prompt": "Export my notes to HTML"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["uid"] == "agent_user_10"
        assert data["response"] == "Agent executed emacs export for you."


@pytest.mark.asyncio
async def test_agent_chat_stream_endpoint(agent_client: AsyncClient) -> None:
    """Verify GET /api/v1/agent/chat/stream returns Server-Sent Events (SSE)."""

    async def mock_events(
        _self: TenantAgentFactory, _tenant: AuthenticatedTenant, _prompt: str
    ):
        yield {"event": "thought", "data": "Thinking about notes..."}
        yield {"event": "token", "data": "Your notes "}
        yield {"event": "token", "data": "are ready."}
        yield {"event": "done", "data": "[DONE]"}

    with mock.patch(
        "emacs_web.agent.factory.TenantAgentFactory.stream_turn",
        mock_events,
    ):
        res = await agent_client.get(
            "/api/v1/agent/chat/stream",
            params={"prompt": "Stream my agenda"},
        )
        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]
        body = res.text
        assert "Thinking about notes..." in body
        assert "Your notes " in body
        assert "[DONE]" in body


@pytest.mark.asyncio
async def test_agent_chat_unauthorized() -> None:
    """Verify agent endpoints reject unauthenticated requests with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        res_post = await unauth.post("/api/v1/agent/chat", json={"prompt": "Hello"})
        assert res_post.status_code == 401

        res_stream = await unauth.get(
            "/api/v1/agent/chat/stream", params={"prompt": "Hello"}
        )
        assert res_stream.status_code == 401


class DummyResponse:
    """Mock ChatResponse with thoughts and tokens."""

    def __init__(self, text_val: str, tokens: list[str], thoughts: list[str]) -> None:
        self._text_val = text_val
        self._tokens = tokens
        self.thoughts = self._gen_thoughts(thoughts)

    async def text(self) -> str:
        return self._text_val

    async def _gen_thoughts(self, items: list[str]):
        for it in items:
            yield it

    def __aiter__(self):
        return self._gen_tokens()

    async def _gen_tokens(self):
        for t in self._tokens:
            yield t


@pytest.mark.asyncio
async def test_factory_execute_and_stream_ephemeral(tmp_path: Path) -> None:
    """Verify execute_turn and stream_turn in EPHEMERAL mode."""
    storage_dir = tmp_path / "data" / "users"
    storage_dir.mkdir(parents=True, exist_ok=True)
    settings = Settings(
        emacs_jail_storage_dir=storage_dir, emacs_agent_persistence="EPHEMERAL"
    )
    factory = TenantAgentFactory(settings)
    tenant = AuthenticatedTenant(uid="tenant_exec_e")

    mock_resp = DummyResponse(
        text_val="Ephemeral reply",
        tokens=["Ephemeral ", "reply"],
        thoughts=["Thinking"],
    )

    mock_agent = mock.AsyncMock()
    mock_agent.chat.return_value = mock_resp
    mock_agent.__aenter__.return_value = mock_agent

    with mock.patch("emacs_web.agent.factory.Agent", return_value=mock_agent):
        out = await factory.execute_turn(tenant, "Hello")
        assert out == "Ephemeral reply"

        events = []
        async for event in factory.stream_turn(tenant, "Hello stream"):
            events.append(event)
        assert any(e["event"] == "thought" and e["data"] == "Thinking" for e in events)
        assert any(e["event"] == "token" and e["data"] == "Ephemeral " for e in events)
        assert any(e["event"] == "done" and e["data"] == "[DONE]" for e in events)


@pytest.mark.asyncio
async def test_factory_execute_and_stream_longrunning(tmp_path: Path) -> None:
    """Verify execute_turn and stream_turn in LONGRUNNING mode."""
    storage_dir = tmp_path / "data" / "users"
    storage_dir.mkdir(parents=True, exist_ok=True)
    settings = Settings(
        emacs_jail_storage_dir=storage_dir, emacs_agent_persistence="LONGRUNNING"
    )
    factory = TenantAgentFactory(settings)
    tenant = AuthenticatedTenant(uid="tenant_exec_lr")

    mock_resp = DummyResponse(
        text_val="Longrunning reply",
        tokens=["Longrunning ", "reply"],
        thoughts=["Thinking long"],
    )

    mock_agent = mock.AsyncMock()
    mock_agent.is_started = False
    mock_agent.chat.return_value = mock_resp
    mock_agent.__aenter__.return_value = mock_agent

    with mock.patch("emacs_web.agent.factory.Agent", return_value=mock_agent):
        out = await factory.execute_turn(tenant, "Hello")
        assert out == "Longrunning reply"
        assert mock_agent.__aenter__.called

        # Second turn should not call __aenter__ if is_started is True
        mock_agent.is_started = True
        mock_agent.__aenter__.reset_mock()
        out2 = await factory.execute_turn(tenant, "Turn 2")
        assert out2 == "Longrunning reply"
        assert not mock_agent.__aenter__.called

        # Stream turn in longrunning
        mock_agent.is_started = False
        events = []
        async for event in factory.stream_turn(tenant, "Stream LR"):
            events.append(event)
        assert any(
            e["event"] == "thought" and e["data"] == "Thinking long" for e in events
        )
        assert any(
            e["event"] == "token" and e["data"] == "Longrunning " for e in events
        )
        assert any(e["event"] == "done" and e["data"] == "[DONE]" for e in events)
