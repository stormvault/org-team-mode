"""Router for tenant environment lifecycle and status management."""

from typing import Annotated, Any

from emacs_jail.archive import UserArchiveManager
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant
from emacs_web.routers.deps import get_archive_manager

router = APIRouter()


class EnvInitRequest(BaseModel):
    """Optional payload for initializing a tenant environment."""

    description: str | None = None


@router.post("/init")
def init_environment(
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
    req: EnvInitRequest | None = None,
) -> dict[str, Any]:
    """Initialize a persistent, isolated sandbox environment for the tenant.

    Args:
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.
        req: Optional initialization payload.

    Returns:
        dict[str, Any]: Environment initialization status and file counts.
    """
    archive_path = archive_mgr.create_initial_archive(tenant.uid)
    metadata = archive_mgr.get_metadata(tenant.uid)
    files = archive_mgr.list_files(tenant.uid)
    return {
        "status": "success",
        "uid": tenant.uid,
        "archive_path": str(archive_path),
        "metadata": metadata,
        "file_count": len(files),
    }


@router.get("/status")
def get_environment_status(
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
) -> dict[str, Any]:
    """Retrieve environment status, archive metadata, and storage metrics.

    Args:
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.

    Returns:
        dict[str, Any]: Environment metadata and file count.
    """
    metadata = archive_mgr.get_metadata(tenant.uid)
    files = archive_mgr.list_files(tenant.uid)
    return {
        "status": "success",
        "uid": tenant.uid,
        "metadata": metadata,
        "file_count": len(files),
    }
