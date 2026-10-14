"""Router for Emacs Org-Mode batch operations (export, babel, tangle, agenda, eval)."""

from typing import Annotated, Any

from emacs_jail.emacs import EmacsOrgManager
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant
from emacs_web.routers.deps import get_org_manager

router = APIRouter()


class OrgExportRequest(BaseModel):
    """Payload for headless Org document export."""

    org_file: str
    export_format: str = "html"
    output_file: str | None = None


class OrgBabelRequest(BaseModel):
    """Payload for Org-Babel code execution."""

    org_file: str
    output_file: str | None = None


class OrgTangleRequest(BaseModel):
    """Payload for Org source code tangling."""

    org_file: str


class OrgEvalRequest(BaseModel):
    """Payload for arbitrary Emacs Lisp expression evaluation."""

    expression: str


def clean_org_path(path: str | None) -> str | None:
    """Normalize file path by removing redundant workspace/ prefix.

    Args:
        path: File path relative to workspace or environment.

    Returns:
        str | None: Cleaned path relative to workspace directory.
    """
    if path is None:
        return None
    clean = path.strip().lstrip("/\\")
    if clean.startswith("workspace/"):
        return clean[len("workspace/") :]
    return clean


@router.post("/export")
def export_org_document(
    req: OrgExportRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    org_mgr: Annotated[EmacsOrgManager, Depends(get_org_manager)],
) -> dict[str, Any]:
    """Export an Org document to HTML, Markdown, LaTeX, or plain text.

    Args:
        req: Export request parameters.
        tenant: Authenticated tenant context.
        org_mgr: Emacs Org-mode manager.

    Returns:
        dict[str, Any]: Export result with output filename, time, and content.
    """
    cleaned_input = clean_org_path(req.org_file) or req.org_file
    cleaned_output = clean_org_path(req.output_file)
    res = org_mgr.export(
        uid=tenant.uid,
        org_file=cleaned_input,
        export_format=req.export_format,
        output_file=cleaned_output,
        return_content=True,
    )
    return {
        "status": "success" if res.success else "error",
        "uid": tenant.uid,
        "output_filename": res.output_filename,
        "execution_time_seconds": round(res.execution_time, 3),
        "content": res.content,
    }


@router.post("/babel")
def execute_org_babel(
    req: OrgBabelRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    org_mgr: Annotated[EmacsOrgManager, Depends(get_org_manager)],
) -> dict[str, Any]:
    """Execute code blocks inside an Org document with automated #+RESULTS:.

    Args:
        req: Babel execution request parameters.
        tenant: Authenticated tenant context.
        org_mgr: Emacs Org-mode manager.

    Returns:
        dict[str, Any]: Babel execution result with updated document content.
    """
    cleaned_input = clean_org_path(req.org_file) or req.org_file
    cleaned_output = clean_org_path(req.output_file)
    res = org_mgr.babel_execute(
        uid=tenant.uid,
        org_file=cleaned_input,
        output_file=cleaned_output,
    )
    return {
        "status": "success" if res.success else "error",
        "uid": tenant.uid,
        "target_file": res.target_file,
        "execution_time_seconds": round(res.execution_time, 3),
        "content": res.content,
    }


@router.post("/tangle")
def tangle_org_document(
    req: OrgTangleRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    org_mgr: Annotated[EmacsOrgManager, Depends(get_org_manager)],
) -> dict[str, Any]:
    """Extract code blocks from an Org document into runnable source files.

    Args:
        req: Tangle request parameters.
        tenant: Authenticated tenant context.
        org_mgr: Emacs Org-mode manager.

    Returns:
        dict[str, Any]: Tangled files and execution metrics.
    """
    cleaned_input = clean_org_path(req.org_file) or req.org_file
    res = org_mgr.babel_tangle(uid=tenant.uid, org_file=cleaned_input)
    return {
        "status": "success" if res.success else "error",
        "uid": tenant.uid,
        "tangled_files": res.tangled_files,
        "execution_time_seconds": round(res.execution_time, 3),
    }


@router.get("/agenda")
def get_org_agenda(
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    org_mgr: Annotated[EmacsOrgManager, Depends(get_org_manager)],
    files: Annotated[list[str] | None, Query()] = None,
) -> dict[str, Any]:
    """Extract structured tasks, TODO items, priorities, and deadlines.

    Args:
        tenant: Authenticated tenant context.
        org_mgr: Emacs Org-mode manager.
        files: Optional list of specific .org files to scan.

    Returns:
        dict[str, Any]: Structured agenda items and task count.
    """
    cleaned_files = (
        [clean_org_path(f) or f for f in files] if files is not None else None
    )
    items = org_mgr.get_agenda(uid=tenant.uid, files=cleaned_files)
    return {
        "status": "success",
        "uid": tenant.uid,
        "task_count": len(items),
        "items": items,
    }


@router.post("/eval")
def eval_elisp_expression(
    req: OrgEvalRequest,
    tenant: Annotated[AuthenticatedTenant, Depends(get_current_tenant)],
    org_mgr: Annotated[EmacsOrgManager, Depends(get_org_manager)],
) -> dict[str, Any]:
    """Evaluate arbitrary Emacs Lisp inside the tenant's Firejail sandbox.

    Args:
        req: Elisp evaluation payload.
        tenant: Authenticated tenant context.
        org_mgr: Emacs Org-mode manager.

    Returns:
        dict[str, Any]: S-expression evaluation output.
    """
    output = org_mgr.eval_elisp(uid=tenant.uid, elisp_expr=req.expression)
    return {
        "status": "success",
        "uid": tenant.uid,
        "output": output,
    }
