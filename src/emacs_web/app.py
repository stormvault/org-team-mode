"""FastAPI application factory and assembly for emacs-web gateway."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import uvicorn
from emacs_jail.exceptions import (
    FileNotFoundInEnvironmentError,
    InvalidUserIdError,
    LockTimeoutError,
    OrgModeError,
    SandboxExecutionError,
    ZipSlipSecurityError,
)
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from emacs_web.auth.service import init_firebase
from emacs_web.config import get_settings
from emacs_web.routers.agent import router as agent_router
from emacs_web.routers.env import router as env_router
from emacs_web.routers.files import router as files_router
from emacs_web.routers.org import router as org_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for application startup and shutdown.

    Args:
        _app: FastAPI application instance.

    Yields:
        None
    """
    settings = get_settings()
    if not settings.test_auth_override:
        init_firebase(settings)
    yield


app = FastAPI(
    title="emacs-web",
    description="FastAPI Web Gateway for Multi-Tenant Firejail Emacs & Agent Orchestration",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(FileNotFoundInEnvironmentError)
async def handle_file_not_found(
    _request: Request, exc: FileNotFoundInEnvironmentError
) -> JSONResponse:
    """Handle FileNotFoundInEnvironmentError with 404 response."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )


@app.exception_handler(ZipSlipSecurityError)
async def handle_zip_slip(_request: Request, exc: ZipSlipSecurityError) -> JSONResponse:
    """Handle ZipSlipSecurityError with 400 response."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(InvalidUserIdError)
async def handle_invalid_uid(
    _request: Request, exc: InvalidUserIdError
) -> JSONResponse:
    """Handle InvalidUserIdError with 400 response."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(LockTimeoutError)
async def handle_lock_timeout(_request: Request, exc: LockTimeoutError) -> JSONResponse:
    """Handle LockTimeoutError with 423 Locked response."""
    return JSONResponse(
        status_code=status.HTTP_423_LOCKED,
        content={"detail": str(exc)},
    )


@app.exception_handler(OrgModeError)
async def handle_org_error(_request: Request, exc: OrgModeError) -> JSONResponse:
    """Handle OrgModeError with 500 response."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
    )


@app.exception_handler(SandboxExecutionError)
async def handle_sandbox_error(
    _request: Request, exc: SandboxExecutionError
) -> JSONResponse:
    """Handle SandboxExecutionError with 500 response."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint for service readiness probes."""
    return {"status": "ok"}


app.include_router(agent_router, prefix="/api/v1/agent", tags=["agent"])
app.include_router(env_router, prefix="/api/v1/env", tags=["environment"])
app.include_router(files_router, prefix="/api/v1/files", tags=["files"])
app.include_router(org_router, prefix="/api/v1/org", tags=["org"])


def main() -> None:
    """CLI entrypoint for emacs-web server."""
    uvicorn.run("emacs_web.app:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
