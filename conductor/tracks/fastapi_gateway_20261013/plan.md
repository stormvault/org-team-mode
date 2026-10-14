# Implementation Plan: FastAPI Web Gateway with Firebase Authentication & Antigravity Agent Orchestration

## Phase 1: Environment & Dependency Integration [checkpoint: e98089d]
- [x] Task: Configure project dependencies and package wiring [e98089d]
  - [x] Add `firejail` (emacs-jail) as a local editable dependency in `pyproject.toml`
  - [x] Configure `emacs_web` dependencies (`fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `firebase-admin`, `sse-starlette`)
  - [x] Implement `emacs_web.config.Settings` with `EMACS_AGENT_PERSISTENCE` (default `"EPHEMERAL"`), `EMACS_JAIL_STORAGE_DIR`, and `TEST_AUTH_OVERRIDE`
- [x] Task: Write tests for package configuration and imports [e98089d]
  - [x] Write unit test confirming clean import of `emacs_jail` components from `emacs_web`
  - [x] Verify test passes with `pytest`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [e98089d]

## Phase 2: Firebase Authentication & Tenant Context (TDD) [checkpoint: 9463d68]
- [x] Task: Write failing tests for authentication and UID validation (Red Phase) [9463d68]
  - [x] Write unit tests for `validate_tenant_uid` testing valid UUIDs/alphanumerics and asserting rejection of path traversal (`..`, `/`, `\0`)
  - [x] Write unit tests for `get_current_tenant` verifying Firebase token verification, expired/revoked error handling, and `TEST_AUTH_OVERRIDE` mock bypass
  - [x] Verify all tests fail as expected (Red Phase)
- [x] Task: Implement authentication models and dependency (Green Phase) [9463d68]
  - [x] Implement `AuthenticatedTenant` dataclass in `emacs_web.auth.models`
  - [x] Implement `validate_tenant_uid` sanitizer and `get_current_tenant` FastAPI security dependency in `emacs_web.auth.service`
  - [x] Implement optional Firebase Admin SDK initializer supporting emulator and credentials
  - [x] Verify all authentication tests pass (Green Phase)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [9463d68]

## Phase 3: REST API Endpoints for Environments & Org-Mode (TDD)
- [ ] Task: Write failing tests for REST API endpoints (Red Phase)
  - [ ] Write test cases for environment management (`/api/v1/env/init`, `/api/v1/env/status`)
  - [ ] Write test cases for workspace file operations (`/api/v1/files`, GET/PUT/DELETE)
  - [ ] Write test cases for Org-mode actions (`/api/v1/org/export`, `/api/v1/org/babel`, `/api/v1/org/tangle`, `/api/v1/org/agenda`, `/api/v1/org/eval`)
  - [ ] Verify all route tests fail as expected (Red Phase)
- [ ] Task: Implement FastAPI routers and application integration (Green Phase)
  - [ ] Create router `emacs_web.routers.env` wrapping `UserArchiveManager`
  - [ ] Create router `emacs_web.routers.files` managing workspace files within tenant `.zip`
  - [ ] Create router `emacs_web.routers.org` wrapping `EmacsOrgManager` operations
  - [ ] Assemble routers into `emacs_web.app:app` with error handlers and lifespan management
  - [ ] Verify all REST route tests pass (Green Phase)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Antigravity Agent Orchestration & Chat Endpoints (TDD)
- [ ] Task: Write failing tests for agent orchestrator and chat endpoints (Red Phase)
  - [ ] Write unit tests for `TenantAgentFactory` asserting deny-by-default safety policy configuration and tenant UID validation
  - [ ] Write unit tests for ephemeral vs long-running persistence modes based on `EMACS_AGENT_PERSISTENCE`
  - [ ] Write integration test for `POST /api/v1/agent/chat` (JSON) and `GET /api/v1/agent/chat/stream` (SSE)
  - [ ] Verify agent tests fail as expected (Red Phase)
- [ ] Task: Implement agent orchestrator and endpoints (Green Phase)
  - [ ] Implement `TenantAgentFactory` in `emacs_web.agent.factory` configuring `LocalAgentConfig`, isolated `app_data_dir`, and policy rules
  - [ ] Implement agent chat router `emacs_web.routers.agent` with JSON response handler and SSE streaming generator
  - [ ] Verify agent tests pass (Green Phase)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: End-to-End Integration, Quality & Coverage Verification
- [ ] Task: Multi-tenant end-to-end integration test
  - [ ] Write comprehensive multi-tenant test verifying concurrent isolated requests across two distinct virtual UIDs
  - [ ] Verify zero cross-tenant contamination in archives and runtime environments
- [ ] Task: Quality assurance and test coverage verification
  - [ ] Run full test suite with coverage report: target >80% coverage for new `emacs_web` code
  - [ ] Run code formatting and linting: `ruff check` and `ruff format`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
