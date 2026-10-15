# Specification: High-Usability Web Speech API Voice Self-Documentation & Keyboard Enrollment UX Architecture

## 1. Overview & Business Objective
This specification defines the architectural and user experience (UX) model for wrapping the HabitFlow Org / Norang GTD plain-text web application with the **Web Speech API** (`SpeechRecognition` and `SpeechSynthesis`). The system provides hands-free, voice-driven access to the application's self-documentation system on mobile and desktop devices with a quantified usability satisfaction goal of **>= 77%** across both non-experienced and power users.

The core mission of the voice interface is **progressive keyboard enrollment**: rather than replacing keyboard shortcuts with slower voice commands, voice acts as an on-the-fly, non-disruptive reference assistant that answers *"Which keyboard shortcut should be used to <operation>?"*, teaches the user keyboard muscle memory, and allows instant execution without context switching or losing the user's active cursor or operational flow.

---

## 2. Quantitative UX Goals & Usability Benchmarks
To achieve >= 77% satisfaction on the System Usability Scale (SUS) across diverse user cohorts:

1. **Cohort A: Inexperienced Voice Users (< 3 prior voice interactions)**
   - **Target**: >= 77% SUS rating.
   - **Friction Reducers**:
     - Visual confidence feedback: Real-time interim transcription display within 100ms of speech.
     - Ambiguity tolerance: Phonetic and fuzzy semantic matching across synonyms (e.g. "punch in", "time track", "record work" -> `clock_in`).
     - Clear microphone permissions coaching and graceful non-blocking fallback if microphone hardware is unavailable.
     - One-touch sample query pills to eliminate "blank page" voice paralysis.

2. **Cohort B: Power Keyboard & Experienced Voice Users**
   - **Target**: >= 85% SUS rating.
   - **Friction Reducers**:
     - Non-disruptive Head-Up Display (HUD): Overlays an ephemeral floating pill at the top-right without covering the main editing canvas or stealing document focus.
     - Zero context loss: Cursor position, text selection, and scroll state in Org buffers are preserved.
     - Low latency: Local intent matching under 200ms; speech synthesis audio starts in < 350ms.
     - Instant barge-in: Typing any physical key chord immediately cancels speech synthesis and executes the command.

---

## 3. Functional Requirements

### 3.1 Prominent Top Navigation Microphone Button
- **Placement**: Fixed in the sticky top nav header alongside the interactive manual button (`?`).
- **Touch Target**: Sized to >= 44x44 CSS pixels complying with WCAG 2.2 touch target requirements on mobile devices.
- **State Machine & Visual Signals**:
  - `Idle`: Green-accented microphone icon (`🎤`) with subtle keyboard chord tooltip (`Alt+Shift+V`).
  - `Listening`: Active red/amber ring pulse animation with high-contrast text (`Listening...`) and haptic tap (`navigator.vibrate([20])`).
  - `Processing`: Brief spinner/wave icon during local intent resolution.
  - `Speaking`: Audio wave indicator while `SpeechSynthesis` is active.
  - `Error / Muted`: Slash icon indicating permission rejection with direct toggle to text inquiry.

### 3.2 Web Speech API Engine Architecture
- **Speech Recognition (`SpeechRecognition` / `webkitSpeechRecognition`)**:
  - `continuous: false`: One-shot query capture optimized for question-answer latency.
  - `interimResults: true`: Immediate visual streaming of user phonemes.
  - `maxAlternatives: 3`: Disambiguation for phonetically similar Org commands ("refile", "clock in", "todo").
  - Mobile audio context unlocking on user gesture (`AudioContext.resume()`).
- **Speech Synthesis (`SpeechSynthesis` & `SpeechSynthesisUtterance`)**:
  - Low-latency voice response: Speaks concise key combinations directly (e.g., *"Press Alt Shift I to clock in"*).
  - Rate tuning: 1.05x speed for snappy assistive responses.
  - Barge-in cancellation: Any subsequent keypress or HUD tap calls `window.speechSynthesis.cancel()`.

### 3.3 Non-Disruptive On-The-Fly HUD Overlay
- Replaces disruptive full-screen modal takeovers for voice queries.
- Appears as a lightweight floating card at top-right/top-center.
- Displays:
  1. The user's transcribed query.
  2. Prominent keyboard shortcut badges (e.g. `Alt + Shift + I` and single-key `i`).
  3. One-sentence Norang workflow rationale.
  4. Instant action buttons: "Run Now" (executes command immediately) and "Try Key" (activates interactive chord verification).
- Auto-fades after 5 seconds of inactivity, or dismisses instantly when the user presses any key or clicks the dismiss target.

### 3.4 Progressive Keyboard Enrollment Loop
Every voice interaction is designed to graduate the user into keyboard efficiency:
1. User asks verbally: *"Which shortcut should I use to capture a meeting?"*
2. Voice assistant responds verbally and displays visual keycaps: *"Use Alt Shift C, then press M."*
3. The HUD highlights the shortcut sequence with high-contrast keycap styling.
4. User learns the shortcut in the context of their immediate task without navigating away.

---

## 4. Acceptance Criteria
1. Prominent microphone icon button in top nav header toggles speech recognition with responsive visual listening feedback.
2. Voice query *"Which keyboard shortcut should be used to <operation>?"* correctly resolves for all core Norang operations (clock in, clock out, capture, refile, change todo state, agenda, export, tag filter, phone mfa).
3. The response displays in a non-disruptive floating HUD overlay that preserves document cursor position and scroll state.
4. Voice audio speaks the concise shortcut answer using `SpeechSynthesis` and terminates cleanly on barge-in.
5. In environments without microphone access, a graceful text input fallback provides identical intent resolution.
6. Test suites in `pivot/` pass 100% with automated coverage for speech recognition, intent parsing, and HUD interactions.
