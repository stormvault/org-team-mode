"""Router for Antigravity AI agent chat and SSE streaming interactions."""

from collections.abc import AsyncGenerator
from functools import lru_cache
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from emacs_web.agent.factory import TenantAgentFactory
from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant
from emacs_web.config import Settings, get_settings

router = APIRouter()


@lru_cache
def _get_factory_singleton(storage_dir: str, persistence: str) -> TenantAgentFactory:
    """Cache factory instance per storage directory and persistence setting."""
    settings = Settings(
        emacs_jail_storage_dir=storage_dir,
        emacs_agent_persistence=persistence,
    )
    return TenantAgentFactory(settings)


def get_agent_factory(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TenantAgentFactory:
    """Dependency provider returning a TenantAgentFactory instance.

    Args:
        settings: Application settings.

    Returns:
        TenantAgentFactory: Configured agent factory.
    """
    return _get_factory_singleton(
        str(settings.emacs_jail_storage_dir),
        settings.emacs_agent_persistence,
    )


class AgentChatRequest(BaseModel):
    """Payload for submitting an agent turn message."""

    prompt: str


@router.post("/chat")
async def chat_with_agent(
    req: AgentChatRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    factory: Annotated[TenantAgentFactory, Depends(get_agent_factory)],
) -> dict[str, Any]:
    """Execute an Antigravity agent turn and return complete response text.

    Args:
        req: Chat request payload containing prompt.
        tenant: Authenticated tenant context.
        factory: Tenant agent factory.

    Returns:
        dict[str, Any]: Response status, UID, and agent message.
    """
    response = await factory.execute_turn(tenant, req.prompt)
    return {
        "status": "success",
        "uid": tenant.uid,
        "response": response,
    }


@router.get("/chat/stream")
async def stream_chat_with_agent(
    prompt: Annotated[str, Query(description="Prompt message for agent")],
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    factory: Annotated[TenantAgentFactory, Depends(get_agent_factory)],
) -> EventSourceResponse:
    """Stream real-time agent thoughts and tokens via Server-Sent Events (SSE).

    Args:
        prompt: User message prompt.
        tenant: Authenticated tenant context.
        factory: Tenant agent factory.

    Returns:
        EventSourceResponse: SSE streaming response.
    """

    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        async for event in factory.stream_turn(tenant, prompt):
            yield event

    return EventSourceResponse(event_generator())
