# Plan: Interactive Emacs-like Self-Documentation Manual, Keyboard-Driven Workflows & Web Speech API

## Phase 1: Self-Documentation & Web Speech API Service
- [x] Task 1.1: Design and implement `SelfDocumentationService` (`pivot/src/app/services/self-documentation.service.ts`)
  - [x] Subtask 1.1.1: Define shortcut models, workflow topic models, and Norang GTD documentation database.
  - [x] Subtask 1.1.2: Implement `describe-bindings`, `describe-key`, and reverse `where-is` operation search logic.
  - [x] Subtask 1.1.3: Integrate Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` & `SpeechSynthesis`) with error handling, live transcription, and spoken audio response generation.
- [x] Task 1.2: Write comprehensive unit tests for `SelfDocumentationService` (`pivot/src/app/services/self-documentation.service.spec.ts`)
  - [x] Subtask 1.2.1: Test key resolution (`describe-key`) and operation query matching (`where-is`).
  - [x] Subtask 1.2.2: Test voice query processing ("which keyboard shortcut should be used to clock in").
  - [x] Subtask 1.2.3: Test graceful fallback when Web Speech API is absent or throws errors.

## Phase 2: Keyboard Shortcut System & UI Entrypoints
- [x] Task 2.1: Update `KeyboardShortcutsService` (`pivot/src/app/services/keyboard-shortcuts.service.ts`)
  - [x] Subtask 2.1.1: Register `?`, `F1`, and browser-safe `Alt + Shift + /` / `Alt + Shift + ?` as manual triggers.
  - [x] Subtask 2.1.2: Add keyboard-driven navigation (`j`, `k`, `1`-`4`, `d`, `v`, `/`, `Enter`, `Escape`/`q`) when manual modal is active.
- [x] Task 2.2: Update `OrgEngineService` (`pivot/src/app/services/org-engine.service.ts`)
  - [x] Subtask 2.2.1: Add computed signals for `doneTasks`, `holdTasks`, and `inboxTasks` to fulfill high-density actionable and historical data requirements.

## Phase 3: High-Density UI & Interactive Manual Overlay
- [x] Task 3.1: Build prominent top nav header buttons in `app.html`
  - [x] Subtask 3.1.1: Add prominent Question Mark (`?`) button with shortcut badge.
  - [x] Subtask 3.1.2: Add prominent Microphone (`🎤`) button with listening pulse indicator.
- [x] Task 3.2: Build interactive Emacs manual overlay (`app.html` & `app.ts`)
  - [x] Subtask 3.2.1: Implement Emacs Info-style buffer with 4 tabs: Keybindings, Norang Workflows, Describe Key, and Web Speech Voice Assistant.
  - [x] Subtask 3.2.2: Implement real-time search filter and direct action execution buttons.
  - [x] Subtask 3.2.3: Implement voice query UI with speech recognition controls and voice synthesis response cards.
- [x] Task 3.3: Expand Norang Agenda with high-density actionable & historical data
  - [x] Subtask 3.3.1: Add On Hold / Blocked Tasks block (`HOLD`).
  - [x] Subtask 3.3.2: Add Historically Actionable / Completed Tasks block (`DONE` & `CANCELLED`).
  - [x] Subtask 3.3.3: Add Refile Inbox block (`refile.org`).

## Phase 4: Integration Verification & Regression Testing
- [x] Task 4.1: Update and expand `app.spec.ts` with tests for manual overlay, keyboard navigation, question mark button, microphone button, voice assistant, and high-density agenda blocks.
- [x] Task 4.2: Execute `npm test -- --watch=false` and verify all tests pass cleanly.
- [x] Task 4.3: Execute `npx ng build` and verify bundle builds with zero errors.
