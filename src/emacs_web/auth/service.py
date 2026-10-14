"""Authentication service and security dependencies for tenant authorization."""

import os
import re
from typing import Annotated, Any

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.config import Settings, get_settings

UID_REGEX = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]{0,127}$")
TRAVERSAL_INDICATORS = ("..", "/", "\\", "\0")

security_bearer = HTTPBearer(auto_error=False)


def validate_tenant_uid(uid: str) -> str:
    """Validate and sanitize a tenant virtual user ID.

    Ensures the UID adheres to strict alphanumeric/UUID specifications and
    explicitly rejects path traversal indicators.

    Args:
        uid: Candidate tenant user ID string.

    Returns:
        str: Validated tenant user ID.

    Raises:
        ValueError: If UID is empty, contains path traversal patterns, or
            violates format constraints.
    """
    if not uid:
        raise ValueError("Tenant UID must not be empty")

    for indicator in TRAVERSAL_INDICATORS:
        if indicator in uid:
            raise ValueError(
                f"Path traversal indicator '{indicator}' detected in UID: {uid}"
            )

    if not UID_REGEX.match(uid):
        raise ValueError(f"Tenant UID '{uid}' does not conform to allowed format regex")

    return uid


def init_firebase(settings: Settings | None = None) -> firebase_admin.App:
    """Initialize Firebase Admin SDK if not already initialized.

    Supports Firebase Auth Emulator via FIREBASE_AUTH_EMULATOR_HOST as well as
    service account credentials.

    Args:
        settings: Application settings instance.

    Returns:
        firebase_admin.App: The default Firebase application instance.
    """
    if firebase_admin._apps:
        return firebase_admin.get_app()

    current_settings = settings or get_settings()
    cred = None

    if current_settings.firebase_credentials_path and os.path.exists(
        current_settings.firebase_credentials_path
    ):
        cred = credentials.Certificate(current_settings.firebase_credentials_path)

    options: dict[str, Any] = {}
    if current_settings.firebase_project_id:
        options["projectId"] = current_settings.firebase_project_id

    if cred:
        return firebase_admin.initialize_app(cred, options=options)
    return firebase_admin.initialize_app(options=options)


def verify_firebase_token(token: str) -> dict[str, Any]:
    """Verify a Firebase JWT ID token and return decoded claims.

    Args:
        token: Raw JWT ID token string from Bearer header.

    Returns:
        dict[str, Any]: Decoded token payload and claims.

    Raises:
        auth.ExpiredIdTokenError: If the token has expired.
        auth.RevokedIdTokenError: If the token was revoked.
        auth.InvalidIdTokenError: If the token is invalid or forged.
    """
    init_firebase()
    return auth.verify_id_token(token)


async def get_current_tenant(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(security_bearer)
    ] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,  # type: ignore[assignment]
) -> AuthenticatedTenant:
    """FastAPI security dependency to extract and authenticate tenant context.

    Inspects Authorization Bearer header, validates token with Firebase Auth or
    processes test override token, sanitizes UID against traversal, and returns
    AuthenticatedTenant entity.

    Args:
        credentials: Optional HTTP Authorization credentials extracted by FastAPI.
        settings: Application settings.

    Returns:
        AuthenticatedTenant: Validated authenticated tenant instance.

    Raises:
        HTTPException: 401 Unauthorized for missing/invalid tokens; 400 Bad
            Request for malformed or path-traversal UIDs.
    """
    actual_settings = settings or get_settings()
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication scheme '{credentials.scheme}', expected Bearer",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty Bearer token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if actual_settings.test_auth_override:
        parts = token.split(":")
        if token.startswith(("mock:", "test:")):
            if len(parts) >= 4:
                raw_uid = parts[1]
                email = parts[2]
                display_name = ":".join(parts[3:])
            elif len(parts) == 3:
                raw_uid = parts[1]
                email = parts[2]
                display_name = None
            else:
                raw_uid = parts[1]
                email = None
                display_name = None
        else:
            raw_uid = token
            email = None
            display_name = None

        try:
            clean_uid = validate_tenant_uid(raw_uid)
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(err),
            ) from err

        return AuthenticatedTenant(
            uid=clean_uid,
            email=email,
            display_name=display_name,
            token_claims={"mock_override": True, "raw_token": token},
        )

    # Production mode: verify with Firebase Admin
    try:
        decoded = verify_firebase_token(token)
    except auth.ExpiredIdTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
    except auth.RevokedIdTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
    except (auth.InvalidIdTokenError, Exception) as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or forged Firebase ID token: {err}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    raw_uid = decoded.get("uid") or decoded.get("sub") or decoded.get("user_id")
    if not raw_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity claim (uid/sub)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        clean_uid = validate_tenant_uid(str(raw_uid))
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err

    return AuthenticatedTenant(
        uid=clean_uid,
        email=decoded.get("email"),
        display_name=decoded.get("name"),
        token_claims=decoded,
    )
