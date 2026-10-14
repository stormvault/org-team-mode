"""Agent orchestration factory using Google Antigravity SDK."""

import json
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from emacs_jail.agent_tools import ANTIGRAVITY_TOOLS, _default_config
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.hooks import policy
from google.antigravity.types import Text, Thought, ToolCall, ToolResult

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import validate_tenant_uid
from emacs_web.config import Settings, get_settings


class TenantAgentFactory:
    """Factory for configuring and orchestrating tenant-isolated Antigravity agents."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize TenantAgentFactory with settings and resident agent cache.

        Args:
            settings: Optional application settings.
        """
        self.settings = settings or get_settings()
        self._resident_agents: dict[str, Agent] = {}
        # Ensure underlying agent tools use the same storage directory as Settings
        _default_config.storage_dir = Path(self.settings.emacs_jail_storage_dir)

    def create_config(self, tenant: AuthenticatedTenant) -> LocalAgentConfig:
        """Create LocalAgentConfig with deny-by-default policies and isolated storage.

        Args:
            tenant: Authenticated tenant context.

        Returns:
            LocalAgentConfig: Configured agent connection options.

        Raises:
            ValueError: If tenant UID is invalid or contains path traversal.
        """
        clean_uid = validate_tenant_uid(tenant.uid)
        app_data_dir = (
            self.settings.emacs_jail_storage_dir.parent / "agent_brain" / clean_uid
        )
        app_data_dir.mkdir(parents=True, exist_ok=True)

        tenant_uid = clean_uid

        def _tenant_predicate(args: Any) -> bool:
            if isinstance(args, dict):
                return args.get("uid") == tenant_uid
            if hasattr(args, "uid"):
                return args.uid == tenant_uid
            return False

        # Build policy list: deny-by-default first, then allow emacs_* wildcard rule
        # per spec, plus individual allow rules for ANTIGRAVITY_TOOLS so in-process
        # policy evaluation accurately approves tenant-scoped calls.
        policies = [
            policy.deny_all(),
            policy.allow(
                "emacs_*",
                when=_tenant_predicate,
            ),
            *[
                policy.allow(
                    getattr(t, "__name__", str(t)),
                    when=_tenant_predicate,
                )
                for t in ANTIGRAVITY_TOOLS
            ],
        ]

        return LocalAgentConfig(
            system_instructions=(
                f"You are an AI assistant managing isolated Emacs Org-Mode "
                f"environments for tenant '{clean_uid}'."
            ),
            tools=ANTIGRAVITY_TOOLS,
            policies=policies,
            app_data_dir=str(app_data_dir),
        )

    def get_agent(self, tenant: AuthenticatedTenant) -> Agent:
        """Retrieve an Agent instance according to configured persistence mode.

        In EPHEMERAL mode, creates a fresh agent. In LONGRUNNING mode, returns
        or initializes a cached resident agent worker.

        Args:
            tenant: Authenticated tenant context.

        Returns:
            Agent: Configured Antigravity Agent instance.
        """
        clean_uid = validate_tenant_uid(tenant.uid)
        if self.settings.emacs_agent_persistence == "LONGRUNNING":
            if clean_uid not in self._resident_agents:
                cfg = self.create_config(tenant)
                self._resident_agents[clean_uid] = Agent(cfg)
            return self._resident_agents[clean_uid]

        cfg = self.create_config(tenant)
        return Agent(cfg)

    async def execute_turn(self, tenant: AuthenticatedTenant, prompt: str) -> str:
        """Execute a synchronous turn for the tenant and return response text.

        Args:
            tenant: Authenticated tenant context.
            prompt: User message prompt.

        Returns:
            str: Agent response content.
        """
        if self.settings.emacs_agent_persistence == "EPHEMERAL":
            agent = self.get_agent(tenant)
            async with agent:
                resp = await agent.chat(prompt)
                return await resp.text()

        agent = self.get_agent(tenant)
        if not agent.is_started:
            await agent.__aenter__()
        resp = await agent.chat(prompt)
        return await resp.text()

    async def stream_turn(
        self, tenant: AuthenticatedTenant, prompt: str
    ) -> AsyncGenerator[dict[str, str], None]:
        """Stream an agent turn yielding thoughts, tokens, tool calls, and done events.

        Args:
            tenant: Authenticated tenant context.
            prompt: User message prompt.

        Yields:
            dict[str, str]: Event payloads with 'event' and 'data' fields.
        """
        if self.settings.emacs_agent_persistence == "EPHEMERAL":
            agent = self.get_agent(tenant)
            async with agent:
                resp = await agent.chat(prompt)
                async for event in self._process_stream_response(resp):
                    yield event
            return

        agent = self.get_agent(tenant)
        if not agent.is_started:
            await agent.__aenter__()
        resp = await agent.chat(prompt)
        async for event in self._process_stream_response(resp):
            yield event

    async def _process_stream_response(
        self, resp: Any
    ) -> AsyncGenerator[dict[str, str], None]:
        """Process ChatResponse into SSE event dictionaries."""
        if hasattr(resp, "chunks"):
            async for chunk in resp.chunks:
                if isinstance(chunk, Thought):
                    yield {"event": "thought", "data": str(chunk.text)}
                elif isinstance(chunk, Text):
                    yield {"event": "token", "data": str(chunk.text)}
                elif isinstance(chunk, ToolCall):
                    payload = {"name": str(chunk.name), "args": chunk.args}
                    if chunk.id:
                        payload["id"] = chunk.id
                    yield {"event": "tool_call", "data": json.dumps(payload)}
                elif isinstance(chunk, ToolResult):
                    payload = {"name": str(chunk.name), "result": chunk.result}
                    if chunk.id:
                        payload["id"] = chunk.id
                    if chunk.error:
                        payload["error"] = chunk.error
                    yield {"event": "tool_result", "data": json.dumps(payload)}
                elif hasattr(chunk, "text"):
                    yield {"event": "token", "data": str(chunk.text)}
        else:
            if hasattr(resp, "thoughts"):
                async for thought in resp.thoughts:
                    yield {"event": "thought", "data": str(thought)}
            if hasattr(resp, "tool_calls"):
                async for tc in resp.tool_calls:
                    tc_payload: dict[str, Any] = {
                        "name": str(tc.name),
                        "args": tc.args,
                    }
                    if getattr(tc, "id", None):
                        tc_payload["id"] = tc.id
                    yield {"event": "tool_call", "data": json.dumps(tc_payload)}
            async for token in resp:
                yield {"event": "token", "data": str(token)}
        yield {"event": "done", "data": "[DONE]"}
