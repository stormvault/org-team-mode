"""Tests for Firebase authentication, tenant models, and UID validation."""

from unittest import mock

import pytest
from fastapi import HTTPException, status

from emacs_web.auth.models import AuthenticatedTenant
from emacs_web.auth.service import get_current_tenant, validate_tenant_uid
from emacs_web.config import Settings


class MockCredentials:
    """Mock for HTTPAuthorizationCredentials."""

    def __init__(self, scheme: str, credentials: str) -> None:
        self.scheme = scheme
        self.credentials = credentials


def test_validate_tenant_uid_valid() -> None:
    """Verify valid tenant UIDs pass validation."""
    assert validate_tenant_uid("c3db6c4b-bcfd-43b5-a23d-892d6761e35d") == (
        "c3db6c4b-bcfd-43b5-a23d-892d6761e35d"
    )
    assert validate_tenant_uid("tenant_101") == "tenant_101"
    assert validate_tenant_uid("user-alice.org") == "user-alice.org"
    assert validate_tenant_uid("a") == "a"


@pytest.mark.parametrize(
    "invalid_uid",
    [
        "",
        "..",
        "../etc/passwd",
        "user/name",
        "user\\name",
        "user\0null",
        ".hidden",
        "-starts-with-dash-ok-but-empty-not",
        "a" * 129,
        "bad@character",
        "space in uid",
    ],
)
def test_validate_tenant_uid_invalid(invalid_uid: str) -> None:
    """Verify path traversal indicators and malformed UIDs raise ValueError."""
    if invalid_uid == "-starts-with-dash-ok-but-empty-not":
        # starts with dash is fine per regex ^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]{0,127}$
        assert validate_tenant_uid(invalid_uid) == invalid_uid
        return
    with pytest.raises(ValueError):
        validate_tenant_uid(invalid_uid)


@pytest.mark.asyncio
async def test_get_current_tenant_missing_token() -> None:
    """Verify missing credentials raise 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant(credentials=None, settings=settings)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_non_bearer_scheme() -> None:
    """Verify non-Bearer schemes raise 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Basic", credentials="dGVzdDpwYXNz")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant(credentials=cred, settings=settings)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_test_override_success() -> None:
    """Verify TEST_AUTH_OVERRIDE parses mock tokens into AuthenticatedTenant."""
    settings = Settings(test_auth_override=True)
    cred = MockCredentials(
        scheme="Bearer", credentials="mock:tenant_42:alice@example.com:Alice"
    )
    tenant = await get_current_tenant(credentials=cred, settings=settings)
    assert isinstance(tenant, AuthenticatedTenant)
    assert tenant.uid == "tenant_42"
    assert tenant.email == "alice@example.com"
    assert tenant.display_name == "Alice"


@pytest.mark.asyncio
async def test_get_current_tenant_test_override_simple_token() -> None:
    """Verify TEST_AUTH_OVERRIDE parses simple mock token."""
    settings = Settings(test_auth_override=True)
    cred = MockCredentials(scheme="Bearer", credentials="mock-test-user")
    tenant = await get_current_tenant(credentials=cred, settings=settings)
    assert tenant.uid == "mock-test-user"


@pytest.mark.asyncio
async def test_get_current_tenant_test_override_traversal_rejected() -> None:
    """Verify path traversal in mock token raises 400 Bad Request."""
    settings = Settings(test_auth_override=True)
    cred = MockCredentials(scheme="Bearer", credentials="mock:../etc/passwd")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant(credentials=cred, settings=settings)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_get_current_tenant_firebase_valid() -> None:
    """Verify valid Firebase token returns AuthenticatedTenant."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="valid-jwt-token")

    mock_decoded = {
        "uid": "firebase_user_99",
        "email": "user@example.com",
        "name": "Firebase User",
        "aud": "project-id",
    }
    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        return_value=mock_decoded,
    ):
        tenant = await get_current_tenant(credentials=cred, settings=settings)
        assert tenant.uid == "firebase_user_99"
        assert tenant.email == "user@example.com"
        assert tenant.display_name == "Firebase User"
        assert tenant.token_claims["aud"] == "project-id"


@pytest.mark.asyncio
async def test_get_current_tenant_firebase_malformed_uid() -> None:
    """Verify Firebase token with path traversal in UID raises 400 Bad Request."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="jwt-traversal-uid")

    mock_decoded = {
        "uid": "../../traversal_user",
        "email": "bad@example.com",
    }
    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        return_value=mock_decoded,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(credentials=cred, settings=settings)
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_get_current_tenant_firebase_expired_token() -> None:
    """Verify expired Firebase token raises 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="expired-token")

    from firebase_admin import auth

    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        side_effect=auth.ExpiredIdTokenError("Token expired", None),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(credentials=cred, settings=settings)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_empty_token() -> None:
    """Verify empty bearer credentials string raises 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="   ")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant(credentials=cred, settings=settings)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_firebase_revoked_token() -> None:
    """Verify revoked Firebase token raises 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="revoked-token")

    from firebase_admin import auth

    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        side_effect=auth.RevokedIdTokenError("Token revoked"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(credentials=cred, settings=settings)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_firebase_invalid_generic_error() -> None:
    """Verify invalid Firebase token raises 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="garbage-token")

    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        side_effect=RuntimeError("Decryption failure"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(credentials=cred, settings=settings)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_missing_uid_claim() -> None:
    """Verify Firebase token without uid/sub raises 401 Unauthorized."""
    settings = Settings(test_auth_override=False)
    cred = MockCredentials(scheme="Bearer", credentials="valid-token-no-uid")

    with mock.patch(
        "emacs_web.auth.service.verify_firebase_token",
        return_value={"email": "anonymous@test.com"},
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(credentials=cred, settings=settings)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_test_override_three_parts() -> None:
    """Verify TEST_AUTH_OVERRIDE parses 3-part mock tokens."""
    settings = Settings(test_auth_override=True)
    cred = MockCredentials(
        scheme="Bearer", credentials="mock:tenant_99:user@domain.com"
    )
    tenant = await get_current_tenant(credentials=cred, settings=settings)
    assert tenant.uid == "tenant_99"
    assert tenant.email == "user@domain.com"
    assert tenant.display_name is None


def test_init_firebase_branches(tmp_path: mock.MagicMock) -> None:
    """Verify init_firebase branches including existing apps and credentials."""
    import firebase_admin

    from emacs_web.auth.service import init_firebase

    # When app already exists
    with mock.patch.object(firebase_admin, "_apps", {"[DEFAULT]": mock.MagicMock()}):
        app = init_firebase()
        assert app is not None

    # When app does not exist and custom settings provided
    cred_file = tmp_path / "creds.json"
    cred_file.write_text('{"type": "service_account"}')

    custom_settings = Settings(
        firebase_credentials_path=str(cred_file),
        firebase_project_id="test-proj",
    )
    with (
        mock.patch.object(firebase_admin, "_apps", {}),
        mock.patch("firebase_admin.credentials.Certificate") as mock_cert,
        mock.patch("firebase_admin.initialize_app") as mock_init,
    ):
        init_firebase(custom_settings)
        mock_cert.assert_called_once_with(str(cred_file))
        mock_init.assert_called_once()
