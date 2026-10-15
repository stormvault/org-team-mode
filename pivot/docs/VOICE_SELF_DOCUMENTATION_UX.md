# Architecture & UX Specification: High-Usability Web Speech API Voice Self-Documentation & Progressive Keyboard Enrollment

## 1. Executive Summary & Design Vision

Modern keyboard-driven productivity systems—exemplified by Emacs Org-mode and Bernt Hansen's canonical Plain-Text GTD workflow (`https://doc.norang.ca/org-mode.html`)—provide peerless execution speed for experienced power users. However, the steep initial learning curve and extensive keybinding catalog (e.g., `Alt+Shift+C`, `Alt+Shift+I`, `Alt+Shift+O`, `Alt+Shift+T`) create high barrier-to-entry friction, especially on touch-first mobile devices lacking physical modifier keys.

This document specifies the architecture and UX interaction model for **HabitFlow Org's Web Speech API Voice Self-Documentation Engine**. The system leverages browser-standard `SpeechRecognition` and `SpeechSynthesis` APIs to create a frictionless, zero-disruption voice assistant that:
1. **Answers on-the-fly operational questions:** *"Which keyboard shortcut should be used to <operation>?"*
2. **Preserves operational flow:** Operates via an ephemeral, floating Head-Up Display (HUD) without taking over the screen or displacing cursor focus and scroll positions.
3. **Drives Progressive Keyboard Enrollment:** Systematically teaches users the underlying keyboard shortcuts and chord sequences, transforming vocal intent into physical muscle memory.
4. **Exceeds Usability Standards:** Delivers a quantified System Usability Scale (SUS) score of **>= 77%** across both first-time voice users and seasoned power users.

```
+-----------------------------------------------------------------------------------+
|                            Top Nav Sticky Header                                  |
| [⭘ HabitFlow Org] [Daily] [Intervals] [Agenda] [Org] [Collab] ... [?] [🎤 Voice]   |
+-----------------------------------------------------------------------------------+
                                                                     |
                                                                     v
                                                    +-------------------------------+
                                                    | Floating HUD (Top-Right)      |
                                                    | Q: "Which shortcut to clock?" |
                                                    | A: "Use Alt + Shift + I"      |
                                                    | [Alt] + [Shift] + [I]  or (i) |
                                                    | [Run Action] [Try Key]  [✕]   |
                                                    +-------------------------------+
                                                                     |
                                            +------------------------+-----------------------+
                                            |                                                |
                                            v                                                v
                              [Direct Action Execution]                          [Interactive Chord Practice]
                              Triggers clock-in immediately                      Detects Alt+Shift+I / i
                              Updates task state -> STARTED                      Provides instant visual success
```

---

## 2. Quantitative Usability Benchmark Framework (>= 77% SUS)

### 2.1 The System Usability Scale (SUS) Benchmark
The System Usability Scale (SUS) is the ISO-standard 10-item instrument for measuring software usability. An average software product scores **68**. A score of **>= 77% (Grade A/B+)** represents the upper quartile of consumer and enterprise software, characterized by:
- Immediate comprehensibility (< 3 seconds to understand primary affordance).
- High task completion rate (> 92% on first attempt).
- Extremely low cognitive friction and absence of voice-interface anxiety.

### 2.2 Dual-Cohort Analysis & Friction Mitigation Matrix

| Dimension | Cohort A: Inexperienced Voice Users (< 3 voice interactions) | Cohort B: Power Keyboard & Experienced Voice Users |
| :--- | :--- | :--- |
| **Primary Anxiety / Risk** | Voice paralysis ("What can I say?"), fear of misrecognition, audio feedback shame. | Disruption of flow, modal interruption, slow response latency, lack of keyboard control. |
| **Target SUS Score** | **>= 77%** | **>= 85%** |
| **Visual Feedback Requirement** | Live streaming interim phoneme transcription within **100ms** of vocalization. | Ephemeral non-modal floating pill; zero displacement of editor cursor or agenda scroll. |
| **Latency Budget** | Audio synthesized response started within **< 400ms** of utterance finalization. | Intent recognized in **< 150ms**; instantaneous barge-in cancel on physical keypress. |
| **Error Recovery Strategy** | Forgiving phonetic synonyms ("punch in", "time track" -> `clock_in`) + one-touch sample queries. | Direct keyboard fallback without touching the mouse; non-intrusive HUD auto-fade. |
| **Physical Affordance** | Touch target **>= 44x44 CSS px** (WCAG 2.2 AAA); animated listening pulse and haptic buzz. | Global shortcut `Alt+Shift+V` / chord `v` inside manual buffer. |

---

## 3. Web Speech API Technical Architecture

The voice self-documentation engine coordinates the dual subsystems of the Web Speech API: `SpeechRecognition` (for capturing and parsing queries) and `SpeechSynthesis` (for acoustic confirmation).

```
                            [User Microphone Input]
                                       |
                                       v
                    +-------------------------------------+
                    |   window.SpeechRecognition Engine   |
                    | continuous: false | interimResults: |
                    +-------------------------------------+
                             /                   \
        (onresult: interim) /                     \ (onresult: isFinal)
                           v                       v
               [Live Transcript Stream]    [Process Voice Query Intent]
               Updates reactive HUD pill    Normalized token match & scoring
                                                   |
                        +--------------------------+--------------------------+
                        |                                                     |
                        v                                                     v
          [Matched Shortcut & Action]                           [SpeechSynthesisUtterance]
          - Keyboard Keycaps: [Alt]+[Shift]+[I]                 - Text: "Use Alt Shift I"
          - Norang GTD rationale                                - Rate: 1.05x | Pitch: 1.0
          - Action trigger callback                             - Barge-in on keypress / tap
```

### 3.1 Speech Recognition Lifecycle (`SpeechRecognition`)
The recognition service implements a single-shot, low-latency transaction cycle:
1. **Activation:** Triggered by tapping `#btn-voice-assistant` or pressing `v`.
2. **Audio Context Unlock:** Under mobile WebKit (iOS Safari) and Chromium Android, audio streams require direct user gesture initiation. The service triggers `AudioContext.resume()` immediately within the pointer event handler.
3. **Configuration:**
   - `continuous = false`: Enforces rapid turnaround on single question phrases without waiting for prolonged trailing silence timeouts.
   - `interimResults = true`: Emits partial speech tokens in real time, rendering them directly into the floating HUD pill so the user receives immediate confirmation that their voice is being processed.
   - `lang = 'en-US'`: Standardized for canonical Norang and technical shortcut terminology.
4. **Finalization & Intent Extraction:** Upon `isFinal === true`, the accumulated transcript is passed to the deterministic query parsing engine, and recognition closes automatically.

### 3.2 Speech Synthesis Lifecycle (`SpeechSynthesis`)
1. **Utterance Formulation:** Synthesizes a concise, action-first sentence:
   - *Example:* `"To clock in, use Alt + Shift + I. In Norang Org-mode, this starts the timer and marks the task STARTED."*
2. **Acoustic Settings:** `rate = 1.05` (crisp, efficient assistive tempo) with default locale voice.
3. **Instant Barge-in Protocol:**
   - If the user presses *any* physical key on their keyboard or taps the HUD dismiss target, `window.speechSynthesis.cancel()` is invoked synchronously.
   - This eliminates irritating voice overlap and allows power users to immediately proceed with their work.

### 3.3 Robust Error Handling & Permission Matrix
- **`not-allowed` / `permission-denied`:** The HUD displays a friendly status notice and switches effortlessly to inline text query input without modal blocking.
- **`no-speech`:** Timed out safely; the HUD remains visible with pre-populated sample questions (e.g. *"Which shortcut to clock in?"*, *"How to refile?"*).
- **Unsupported Environments (Desktop Firefox without flags, Headless CI):** Graceful fallback to instantaneous fuzzy text matching; audio synthesis fails silently without throwing unhandled exceptions.

---

## 4. Non-Disruptive Floating HUD (Head-Up Display) UX Model

### 4.1 Zero-Disruption Principles
Traditional voice assistants often render modal takeovers that blank the screen, hijack keyboard focus, and discard current cursor state. For a high-density, text-centric tool like HabitFlow Org:
- **No Focus Hijacking:** Text selection and cursor positioning in the active Org-Babel buffer or Agenda view remain intact.
- **Top-Right Fixed Anchor:** Positioned at `top: 4.5rem; right: 1.5rem; max-width: 420px; z-index: 45`.
- **Auto-Dismiss Lifecycle:** After displaying the requested shortcut and completing speech synthesis, the HUD initiates a 4-second auto-fade countdown. Hovering over the HUD pauses the timer; pressing `Escape` or any action dismisses it instantly.

### 4.2 Floating HUD Component Structure

```html
<div id="voice-hud-overlay" class="fixed top-18 right-6 z-45 w-96 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md p-4 text-white">
  <!-- Status Header -->
  <div class="flex items-center justify-between border-b border-slate-800 pb-2">
    <div class="flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Voice Assistant</span>
    </div>
    <button (click)="dismissHud()" class="text-slate-400 hover:text-white text-xs">✕</button>
  </div>

  <!-- Real-time Query / Transcript -->
  <div class="mt-2 text-xs text-slate-300 italic">
    "{{ transcript || 'Listening for your shortcut question...' }}"
  </div>

  <!-- Keycap Showcase & Rationale -->
  <div class="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
    <div class="flex items-center gap-2">
      <kbd class="px-2.5 py-1 rounded-md bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 font-mono font-bold text-xs">
        {{ shortcut.keys }}
      </kbd>
      <span class="text-xs font-semibold text-white">{{ shortcut.description }}</span>
    </div>
    <p class="mt-1 text-[11px] text-slate-400 leading-snug">{{ shortcut.norangContext }}</p>
  </div>

  <!-- Action & Interactive Chord Enrollment Controls -->
  <div class="mt-3 flex items-center justify-between gap-2">
    <button (click)="runAction(shortcut.action)" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs">
      Run Action
    </button>
    <button (click)="startTryChord(shortcut)" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs">
      Try Key (Practice)
    </button>
  </div>
</div>
```

---

## 5. Progressive Keyboard Enrollment Architecture

The fundamental philosophy of the voice self-documentation assistant is **enrollment, not replacement**. Voice provides immediate discovery for newcomers and mobile users, but guides them progressively toward keyboard mastery:

```
[Level 1: Novice / Mobile]
User taps [🎤 Voice] in top header -> Asks: "Which shortcut should I use to clock in?"
                    |
                    v
[Level 2: Dual-Sensory Feedback]
HUD vocalizes: "Use Alt + Shift + I" while visually displaying keycaps [Alt] + [Shift] + [I]
                    |
                    v
[Level 3: Muscle Memory Practice (Try Key)]
User clicks "Try Key" or hits keyboard -> HUD listens for the chord and flashes green on match: "✓ Key Confirmed!"
                    |
                    v
[Level 4: Mastery / Autonomous Operation]
User ceases using voice for routine actions; directly executes Alt+Shift+I or agenda single-key i.
Voice remains available as an on-the-fly reference manual for complex/rare workflows.
```

---

## 6. Canonical Norang GTD Voice Intent Mappings

The voice engine resolves colloquial questions into exact Norang GTD keyboard actions:

| Voice Query Pattern | Resolved Action | Canonical Keys | Agenda Key | Norang GTD Context |
| :--- | :--- | :--- | :--- | :--- |
| *"Which shortcut to clock in?"* / *"Start timer"* | `clock_in` | `Alt + Shift + I` | `i` | Starts clock, transitions state to STARTED, logs start timestamp. |
| *"Which shortcut to clock out?"* / *"Stop timer"* | `clock_out` | `Alt + Shift + O` | `o` | Closes active clock, updates task CLOCKSUM, checks against effort. |
| *"How to capture a task?"* / *"New note"* | `capture` | `Alt + Shift + C` | `c` | Opens capture drawer into `refile.org` without disrupting focus. |
| *"How to refile tasks?"* / *"Inbox zero"* | `refile` | `Alt + Shift + R` | `r` | Relocates items from `refile.org` to target Org files. |
| *"How to change TODO state?"* / *"Mark done"* | `todo_state` | `Alt + Shift + T` | `t` | Norang 7-state cycle: TODO, NEXT, STARTED, WAITING, HOLD, DONE, CANCELLED. |
| *"Open agenda"* / *"View schedule"* | `agenda` | `Alt + Shift + A` | `a` | Canonical 5-block Norang Agenda with stuck projects and waiting items. |
| *"Open Org and Babel"* / *"Run code sandbox"* | `org` | `Alt + Shift + B` | `b` | Plain-text Org buffer and literate programming execution sandbox. |
| *"Export document"* / *"Download clock CSV"* | `export` | `Alt + Shift + E` | `e` | Exports to Markdown, styled HTML, and CSV clock reports. |
| *"Toggle habit view"* / *"Switch to intervals"* | `toggle_view` | `Alt + Shift + H` | `h` | Cycles between daily streaks and sub-daily interval countdown timers. |
| *"Open projects and MFA"* / *"Phone auth"* | `projects` | `Alt + Shift + P` | `p` | Multi-user project collaboration and Firebase Phone MFA registration. |
| *"Help"* / *"Open manual"* / *"Describe key"* | `manual` | `?` or `F1` or `C-h` | `?` | Interactive Emacs self-documentation overlay buffer. |

---

## 7. Verification & Usability Audit Checklist

- [x] **Touch Target Verification:** Sticky top navigation microphone button `#btn-voice-assistant` measures >= 44x44 CSS pixels.
- [x] **Visual Listening Feedback:** Real-time pulsing ring animation and text display during active speech capture.
- [x] **Non-Disruptive HUD:** Ephemeral card anchored top-right without creating modal backdrop or stealing editor focus.
- [x] **Instant Barge-in:** Keypress or tap synchronously stops active speech synthesis.
- [x] **Keyboard Practice Drill:** Interactive "Try Key" chord validation trains muscle memory directly in place.
- [x] **Automated Testing:** 100% pass rate in unit tests covering voice processing, HUD state, and user interaction flows.
