"""Authentication and tenant context management for emacs-web."""

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant, validate_tenant_uid

__all__ = [
    "AuthenticatedTenant",
    "get_current_tenant",
    "validate_tenant_uid",
]
