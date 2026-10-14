"""Data models for authentication and tenant context."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AuthenticatedTenant:
    """Authenticated tenant entity injected into request endpoints.

    Attributes:
        uid: Sanitized tenant user ID (virtual non-system UID).
        email: Tenant email address, if provided in token.
        display_name: Tenant human-readable name, if provided in token.
        token_claims: Full decoded JWT claims dictionary.
    """

    uid: str
    email: str | None = None
    display_name: str | None = None
    token_claims: dict[str, Any] = field(default_factory=dict)
