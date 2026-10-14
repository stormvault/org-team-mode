"""Agent orchestration factory using Google Antigravity SDK."""

from collections.abc import AsyncGenerator

from emacs_jail.agent_tools import ANTIGRAVITY_TOOLS
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.hooks import policy

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
        policies = [
            policy.deny_all(),
            policy.allow(
                "emacs_*",
                when=lambda args: args.get("uid") == tenant_uid,
            ),
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
        """Stream an agent turn yielding thoughts, tokens, and done events.

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
                async for thought in resp.thoughts:
                    yield {"event": "thought", "data": str(thought)}
                async for token in resp:
                    yield {"event": "token", "data": str(token)}
                yield {"event": "done", "data": "[DONE]"}
            return

        agent = self.get_agent(tenant)
        if not agent.is_started:
            await agent.__aenter__()
        resp = await agent.chat(prompt)
        async for thought in resp.thoughts:
            yield {"event": "thought", "data": str(thought)}
        async for token in resp:
            yield {"event": "token", "data": str(token)}
        yield {"event": "done", "data": "[DONE]"}
