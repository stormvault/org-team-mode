# Track: High-Usability Web Speech API Voice Self-Documentation & Keyboard Enrollment UX Architecture (>=77% Satisfaction)

## Track Overview
This track delivers the complete architectural and UX model for wrapping the HabitFlow Org / Norang GTD plain-text web application with the **Web Speech API** (`SpeechRecognition` and `SpeechSynthesis`). It enables mobile and desktop users to query shortcuts via voice, learn keyboard shortcuts progressively, and access documentation without disrupting their active workflow or losing cursor/scroll state.

## Core Documents
- **[Specification](./spec.md)**: Product and UX requirements, System Usability Scale (SUS >= 77%) benchmarks, Web Speech lifecycle, and acceptance criteria.
- **[Plan](./plan.md)**: Phased implementation roadmap covering documentation, non-disruptive floating HUD engine, key chord validation, and unit tests.
- **[Metadata](./metadata.json)**: Track status, timestamps, and classification.
- **[Architectural & UX Specification Document](../../../pivot/docs/VOICE_SELF_DOCUMENTATION_UX.md)**: Full-length reference manual covering usability metrics, speech state machines, zero-disruption HUD design, and Norang GTD operational mappings.

## Key Deliverables
1. Comprehensive UX & Architecture document: `pivot/docs/VOICE_SELF_DOCUMENTATION_UX.md`.
2. Enhanced `SelfDocumentationService`: Non-disruptive floating HUD signals, auto-dismiss timers, Try-Key chord validation, and speech synthesis barge-in cancellation.
3. Floating Head-Up Display (HUD) overlay (`#voice-hud-overlay`) in `app.html` & `app.ts` anchored to top-right.
4. Top navigation microphone button (`#btn-voice-assistant`) triggering non-blocking floating voice HUD.
5. Automated test suites in `self-documentation.service.spec.ts` and `app.spec.ts`.
