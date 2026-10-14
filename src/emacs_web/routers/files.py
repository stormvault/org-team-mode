"""Router for workspace file operations inside tenant archives."""

from typing import Annotated, Any

from emacs_jail.archive import UserArchiveManager
from emacs_jail.exceptions import FileNotFoundInEnvironmentError
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant
from emacs_web.routers.deps import get_archive_manager

router = APIRouter()


class FilePutRequest(BaseModel):
    """Payload for uploading or updating a workspace file."""

    content: str


def validate_workspace_filepath(filepath: str) -> str:
    """Validate and sanitize a workspace filepath against path traversal.

    Args:
        filepath: Candidate relative filepath in workspace archive.

    Returns:
        str: Cleaned relative path.

    Raises:
        HTTPException: 400 Bad Request if filepath is empty, contains null bytes,
            or contains path traversal indicators (e.g. '..').
    """
    if not filepath or not filepath.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filepath must not be empty",
        )

    clean = filepath.strip().lstrip("/\\")
    if not clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filepath must not be empty",
        )

    if "\0" in clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filepath contains illegal null byte",
        )

    parts = clean.replace("\\", "/").split("/")
    if any(part in ("..", ".") for part in parts):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path traversal indicator detected in filepath: {filepath}",
        )

    return clean


@router.get("")
@router.get("/")
def list_workspace_files(
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
) -> dict[str, Any]:
    """List all files in the tenant's persistent workspace archive.

    Args:
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.

    Returns:
        dict[str, Any]: List of files with sizes and modification times.
    """
    files = archive_mgr.list_files(tenant.uid)
    return {
        "status": "success",
        "uid": tenant.uid,
        "files": files,
        "total_files": len(files),
    }


@router.get("/{filepath:path}")
def get_workspace_file(
    filepath: str,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
) -> dict[str, Any]:
    """Retrieve text contents of a workspace file from tenant archive.

    Args:
        filepath: Relative workspace file path.
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.

    Returns:
        dict[str, Any]: File content and size.

    Raises:
        HTTPException: 400 on traversal, 404 if file does not exist.
    """
    clean_path = validate_workspace_filepath(filepath)
    try:
        data = archive_mgr.read_file(tenant.uid, clean_path)
    except FileNotFoundInEnvironmentError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{clean_path}' not found in tenant workspace",
        ) from err

    text = data.decode("utf-8", errors="replace")
    return {
        "status": "success",
        "uid": tenant.uid,
        "filepath": clean_path,
        "content": text,
        "size_bytes": len(data),
    }


@router.put("/{filepath:path}")
def put_workspace_file(
    filepath: str,
    req: FilePutRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
) -> dict[str, Any]:
    """Create or overwrite a file in the tenant's persistent workspace.

    Args:
        filepath: Relative workspace file path.
        req: Request body containing file content.
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.

    Returns:
        dict[str, Any]: File path and byte count written.

    Raises:
        HTTPException: 400 on invalid or traversal filepath.
    """
    clean_path = validate_workspace_filepath(filepath)
    archive_mgr.write_file(tenant.uid, clean_path, req.content)
    return {
        "status": "success",
        "uid": tenant.uid,
        "filepath": clean_path,
        "bytes_written": len(req.content.encode("utf-8")),
    }


@router.delete("/{filepath:path}")
def delete_workspace_file(
    filepath: str,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    archive_mgr: Annotated[UserArchiveManager, Depends(get_archive_manager)],
) -> dict[str, Any]:
    """Delete a file from the tenant's persistent workspace archive.

    Args:
        filepath: Relative workspace file path.
        tenant: Authenticated tenant context.
        archive_mgr: User archive manager.

    Returns:
        dict[str, Any]: Operation status and target file path.

    Raises:
        HTTPException: 400 on invalid or traversal filepath.
    """
    clean_path = validate_workspace_filepath(filepath)
    archive_mgr.delete_file(tenant.uid, clean_path)
    return {
        "status": "success",
        "uid": tenant.uid,
        "filepath": clean_path,
    }
