import { Injectable, signal, computed } from '@angular/core';

export interface ShortcutItem {
  id: string;
  keys: string;
  keyChord: string;
  action: string;
  description: string;
  category: 'Global' | 'Org Capture' | 'Agenda' | 'Clocking' | 'Navigation' | 'Modal Fast Keys';
  norangContext: string;
  emacsEquivalent?: string;
  keywords: string[];
}

export interface WorkflowTopic {
  id: string;
  title: string;
  section: string;
  norangRef: string;
  summary: string;
  steps: string[];
  keyShortcuts: string[];
  actionableNotes: string;
  keywords: string[];
}

export interface VoiceQueryResponse {
  query: string;
  answer: string;
  matchedShortcuts: ShortcutItem[];
  matchedWorkflow?: WorkflowTopic;
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class SelfDocumentationService {
  // Manual Overlay UI State
  public readonly manualVisible = signal<boolean>(false);
  public readonly activeTab = signal<'shortcuts' | 'workflows' | 'describe' | 'voice'>('shortcuts');
  public readonly selectedCategory = signal<string>('All');
  public readonly searchQuery = signal<string>('');
  public readonly selectedIndex = signal<number>(0);

  // Describe Key Inspector State
  public readonly lastInspectedKey = signal<string | null>(null);
  public readonly inspectedShortcut = signal<ShortcutItem | null>(null);

  // Web Speech API State
  public readonly isListening = signal<boolean>(false);
  public readonly transcript = signal<string>('');
  public readonly speechError = signal<string | null>(null);
  public readonly isSpeaking = signal<boolean>(false);
  public readonly voiceResponse = signal<VoiceQueryResponse | null>(null);

  // Native Web Speech recognition instance
  private recognition: any = null;
  public readonly isSpeechSupported = signal<boolean>(false);

  // Categories
  public readonly categories = ['All', 'Global', 'Org Capture', 'Agenda', 'Clocking', 'Navigation', 'Modal Fast Keys'] as const;

  // Complete Registry of Keyboard Shortcuts & Mappings
  public readonly shortcuts: ShortcutItem[] = [
    {
      id: 'sc-capture',
      keys: 'Alt + Shift + C',
      keyChord: 'ALT+SHIFT+C',
      action: 'capture',
      description: 'Quick Org Capture Drawer',
      category: 'Org Capture',
      norangContext: 'Captures fleeting ideas, tasks, habits, notes, phone logs, or meetings instantly into refile.org without disrupting current focus.',
      emacsEquivalent: 'C-c c',
      keywords: ['capture', 'inbox', 'new task', 'add task', 'note', 'meeting', 'phone']
    },
    {
      id: 'sc-agenda',
      keys: 'Alt + Shift + A',
      keyChord: 'ALT+SHIFT+A',
      action: 'agenda',
      description: 'Open Norang Multi-Block Agenda',
      category: 'Agenda',
      norangContext: 'Displays the canonical 5-block Norang custom agenda: Daily Schedule, NEXT Actions, Stuck Projects, Waiting tasks, and Done history.',
      emacsEquivalent: 'C-c a',
      keywords: ['agenda', 'schedule', 'next', 'calendar', 'stuck projects', 'waiting']
    },
    {
      id: 'sc-clock-in',
      keys: 'Alt + Shift + I',
      keyChord: 'ALT+SHIFT+I',
      action: 'clock_in',
      description: 'Clock In to Selected Task / Habit',
      category: 'Clocking',
      norangContext: 'Starts time clock on the selected item, automatically transitions its TODO state to STARTED, and logs clock start timestamp.',
      emacsEquivalent: 'C-c C-x C-i (or I)',
      keywords: ['clock in', 'start timer', 'time track', 'start work', 'begin task', 'clocking']
    },
    {
      id: 'sc-clock-out',
      keys: 'Alt + Shift + O',
      keyChord: 'ALT+SHIFT+O',
      action: 'clock_out',
      description: 'Clock Out Active Clock',
      category: 'Clocking',
      norangContext: 'Closes active clock entry, calculates elapsed duration, updates task CLOCKSUM, and verifies against :Effort: estimate.',
      emacsEquivalent: 'C-c C-x C-o (or O)',
      keywords: ['clock out', 'stop timer', 'end clock', 'finish work', 'clocking']
    },
    {
      id: 'sc-todo-state',
      keys: 'Alt + Shift + T',
      keyChord: 'ALT+SHIFT+T',
      action: 'todo_state',
      description: 'Fast TODO State Selection Menu',
      category: 'Global',
      norangContext: 'Opens state selection prompt for direct single-key transitions: t (TODO), n (NEXT), s (STARTED), w (WAITING), h (HOLD), d (DONE), c (CANCELLED).',
      emacsEquivalent: 'C-c C-t',
      keywords: ['todo state', 'change state', 'mark done', 'next', 'waiting', 'hold', 'status']
    },
    {
      id: 'sc-refile',
      keys: 'Alt + Shift + R',
      keyChord: 'ALT+SHIFT+R',
      action: 'refile',
      description: 'Refile Task to Target Org File',
      category: 'Global',
      norangContext: 'Refiles captured tasks from refile.org into target files: todo.org, habits.org, projects.org, notes.org, or archive.org.',
      emacsEquivalent: 'C-c C-w',
      keywords: ['refile', 'move task', 'organize', 'inbox zero', 'archive', 'categorize']
    },
    {
      id: 'sc-export',
      keys: 'Alt + Shift + E',
      keyChord: 'ALT+SHIFT+E',
      action: 'export',
      description: 'Export Document (Markdown / HTML / CSV)',
      category: 'Global',
      norangContext: 'Exports current Org document and clock tables into clean Markdown, styled HTML, or CSV clock report spreadsheets.',
      emacsEquivalent: 'C-c C-e',
      keywords: ['export', 'download', 'markdown', 'html', 'csv', 'report']
    },
    {
      id: 'sc-toggle-view',
      keys: 'Alt + Shift + H',
      keyChord: 'ALT+SHIFT+H',
      action: 'toggle_view',
      description: 'Toggle HabitFlow Daily & Interval View',
      category: 'Navigation',
      norangContext: 'Switches between HabitFlow daily streak tracking and sub-daily interval countdown timers with Web Audio reminders.',
      emacsEquivalent: 'v (agenda view cycle)',
      keywords: ['habit', 'streak', 'interval', 'timer', 'toggle view', 'switch view']
    },
    {
      id: 'sc-projects',
      keys: 'Alt + Shift + P',
      keyChord: 'ALT+SHIFT+P',
      action: 'projects',
      description: 'Open Project Collaboration & Firebase MFA Modal',
      category: 'Global',
      norangContext: 'Accesses shared multi-user project files and verifies mandatory Firebase Phone MFA authentication linking.',
      emacsEquivalent: 'C-c p (projectile / collab)',
      keywords: ['project', 'collaboration', 'mfa', 'phone', 'auth', 'team', 'share']
    },
    {
      id: 'sc-org-babel',
      keys: 'Alt + Shift + B',
      keyChord: 'ALT+SHIFT+B',
      action: 'org',
      description: 'Open Org Document & Babel Sandbox',
      category: 'Navigation',
      norangContext: 'Switches to the Org plain-text document editor and Org-Babel sandbox literate programming evaluator.',
      emacsEquivalent: 'C-c C-v (org-babel)',
      keywords: ['babel', 'org', 'literate', 'sandbox', 'code', 'python', 'eval']
    },
    {
      id: 'sc-manual',
      keys: '?  or  F1  or  C-h  or  Alt + Shift + /',
      keyChord: '?',
      action: 'manual',
      description: 'Toggle Interactive Emacs Self-Documentation Manual',
      category: 'Global',
      norangContext: 'Displays this full-screen interactive manual overlay buffer with searchable keybindings, Norang workflows, describe-key, and Web Speech API.',
      emacsEquivalent: 'C-h b / C-h m / C-h ? / C-h i',
      keywords: ['help', 'manual', 'documentation', 'shortcuts', 'describe', 'keys', 'cheat sheet', 'voice']
    },
    {
      id: 'sc-fast-state-keys',
      keys: 't / n / s / w / h / d / c',
      keyChord: 'FAST_STATE',
      action: 'fast_state',
      category: 'Modal Fast Keys',
      description: 'Fast State Keys (Inside State Dialog)',
      norangContext: 'Immediate single-key press inside state modal: t=TODO, n=NEXT, s=STARTED, w=WAITING, h=HOLD, d=DONE, c=CANCELLED.',
      emacsEquivalent: 'Norang org-todo-state fast selection',
      keywords: ['fast state', 'done', 'next', 'started', 'waiting', 'hold', 'cancelled']
    },
    {
      id: 'sc-capture-templates',
      keys: 't / h / n / p / m',
      keyChord: 'CAPTURE_TPL',
      action: 'fast_capture_template',
      category: 'Modal Fast Keys',
      description: 'Capture Template Hotkeys (Inside Capture Dialog)',
      norangContext: 'Direct template selector: t=Task (refile.org), h=Habit (habits.org), n=Note, p=Phone call, m=Meeting.',
      emacsEquivalent: 'Norang org-capture template keys',
      keywords: ['template', 'task', 'habit', 'note', 'phone', 'meeting']
    },
    {
      id: 'sc-refile-targets',
      keys: 't / h / p / a  (or 1 / 2 / 3 / 4)',
      keyChord: 'REFILE_KEYS',
      action: 'fast_refile_target',
      category: 'Modal Fast Keys',
      description: 'Refile Target Keys (Inside Refile Dialog)',
      norangContext: 'Single-key refile target selection: t=todo.org, h=habits.org, p=projects.org, a=archive.org.',
      emacsEquivalent: 'org-refile target selection',
      keywords: ['refile', 'todo.org', 'habits.org', 'projects.org', 'archive.org', 'target']
    },
    {
      id: 'sc-agenda-nav',
      keys: 'j / k  or  ↓ / ↑  (in Agenda)',
      keyChord: 'J/K',
      action: 'agenda:nav',
      category: 'Agenda',
      description: 'Navigate Agenda Tasks (Next / Previous Task)',
      norangContext: 'Moves the selection cursor across actionable and historical tasks in the Norang Agenda.',
      emacsEquivalent: 'n / p (org-agenda-next-line / org-agenda-previous-line)',
      keywords: ['agenda', 'navigate', 'next task', 'prev task', 'cursor', 'select']
    },
    {
      id: 'sc-tag-filter',
      keys: '/  (in Agenda)',
      keyChord: '/',
      action: 'filter_agenda',
      description: 'Fast Tag Filter (Filter Agenda by Context Tag)',
      category: 'Agenda',
      norangContext: 'Filters agenda items by context tag (e.g. :phone:, :review:, :security:, :boss:) conforming to Norang / RET filtering.',
      emacsEquivalent: '/ RET (org-agenda-filter-by-tag)',
      keywords: ['filter', 'tag', 'context', 'agenda filter']
    },
    {
      id: 'sc-escape',
      keys: 'Escape  or  q  or  C-g',
      keyChord: 'ESCAPE',
      action: 'escape',
      description: 'Escape / Quit Current Modal or Manual Overlay',
      category: 'Navigation',
      norangContext: 'Dismisses any open modal, capture drawer, state selector, or this manual overlay buffer.',
      emacsEquivalent: 'C-g (keyboard-quit) or q',
      keywords: ['escape', 'quit', 'close', 'cancel', 'exit']
    }
  ];

  // Norang GTD Workflows Reference Manual Database
  public readonly workflowTopics: WorkflowTopic[] = [
    {
      id: 'wf-inbox-capture',
      title: 'Inboxing & Capture Architecture',
      section: 'Section 4: Capture & Inboxing',
      norangRef: 'https://doc.norang.ca/org-mode.html#Capture',
      summary: 'Capture fleeting ideas, tasks, and communications into refile.org without losing focus on current execution.',
      steps: [
        'Press Alt + Shift + C to trigger the capture drawer.',
        'Choose template: [t] Task, [h] Habit, [n] Note, [p] Phone call, or [m] Meeting.',
        'Specify title, effort estimate (e.g. 0:30), and context tags (e.g. review, admin).',
        'Press Enter to submit. Task lands in refile.org, keeping active views uncluttered.'
      ],
      keyShortcuts: ['Alt + Shift + C', 't', 'h', 'n', 'p', 'm'],
      actionableNotes: 'Never put unstructured tasks directly into projects or archives. Everything enters via refile.org to preserve GTD discipline.',
      keywords: ['capture', 'inbox', 'refile.org', 'templates', 'fleeting']
    },
    {
      id: 'wf-refile-pipeline',
      title: 'The Refiling Pipeline (Inbox Zero)',
      section: 'Section 8: Refiling Tasks',
      norangRef: 'https://doc.norang.ca/org-mode.html#Refile',
      summary: 'Process items from refile.org into durable files: todo.org, habits.org, projects.org, or archive.org.',
      steps: [
        'Open Norang Agenda (Alt + Shift + A) and review the Refile Inbox block.',
        'Select a task and press Alt + Shift + R to open refiling targets.',
        'Target todo.org for standalone tasks, projects.org for multi-step projects, or habits.org for recurring routines.',
        'Confirm refiling. The item is atomically relocated with all historical clock entries intact.'
      ],
      keyShortcuts: ['Alt + Shift + R', 'Alt + Shift + A'],
      actionableNotes: 'Refile at least once per day during your morning or evening review to maintain inbox zero.',
      keywords: ['refile', 'organize', 'inbox zero', 'projects.org', 'todo.org', 'habits.org']
    },
    {
      id: 'wf-state-machine',
      title: 'Norang 7-State GTD State Machine',
      section: 'Section 5: Todo States & Triggers',
      norangRef: 'https://doc.norang.ca/org-mode.html#TodoStates',
      summary: 'Deterministic task lifecycle: TODO -> NEXT -> STARTED -> WAITING -> HOLD -> DONE -> CANCELLED.',
      steps: [
        'TODO: Actionable item awaiting work.',
        'NEXT: Immediate next physical action. Only tasks ready to execute with no dependencies are NEXT.',
        'STARTED: Currently active task with running clock.',
        'WAITING: Blocked on third party or delegated.',
        'HOLD: Paused by user decision. Remains visible in Agenda so projects are never lost.',
        'DONE: Completed task with closed timestamp and total clock sum.',
        'CANCELLED: Abandoned task with rationale logged.'
      ],
      keyShortcuts: ['Alt + Shift + T', 't', 'n', 's', 'w', 'h', 'd', 'c'],
      actionableNotes: 'Press Alt + Shift + T then the single key (e.g. "d" for DONE, "n" for NEXT) to instantly transition states.',
      keywords: ['states', 'todo', 'next', 'started', 'waiting', 'hold', 'done', 'cancelled']
    },
    {
      id: 'wf-clocking-effort',
      title: 'Precision Clocking & Effort Estimates',
      section: 'Section 6: Clocking & Time Accounting',
      norangRef: 'https://doc.norang.ca/org-mode.html#Clocking',
      summary: 'Bernt Hansen rule: Clock everything. Track accurate effort vs actual CLOCKSUM time.',
      steps: [
        'Press Alt + Shift + I to Clock In. Task transitions to STARTED and clock ticker activates in top nav.',
        'Work on the task. The active clock pill tracks elapsed minutes in real time.',
        'Press Alt + Shift + O to Clock Out. Duration is added to task CLOCKSUM.',
        'If actual clock sum exceeds :Effort: estimate, an overtime visual alert appears in the task card.'
      ],
      keyShortcuts: ['Alt + Shift + I', 'Alt + Shift + O'],
      actionableNotes: 'Export clock summaries to CSV spreadsheet anytime with Alt + Shift + E.',
      keywords: ['clocking', 'clock in', 'clock out', 'effort', 'clocksum', 'overtime', 'timer']
    },
    {
      id: 'wf-stuck-projects',
      title: 'Stuck Projects Identification',
      section: 'Section 10: Projects & Stuck Projects',
      norangRef: 'https://doc.norang.ca/org-mode.html#Projects',
      summary: 'Automatically flags multi-task projects that lack any active NEXT action, preventing project stagnation.',
      steps: [
        'Check Block 2 in Norang Agenda (Alt + Shift + A).',
        'Any project with subtasks where zero subtasks are NEXT or STARTED is flagged as Stuck (⚠️).',
        'Click "+ Add NEXT Task" or press Alt + Shift + C to define an immediate actionable step.',
        'Once a NEXT task is added, the project clears from the Stuck list immediately.'
      ],
      keyShortcuts: ['Alt + Shift + A', 'Alt + Shift + C'],
      actionableNotes: 'A project without a NEXT action is not progressing. Keep all projects unstuck daily.',
      keywords: ['stuck projects', 'projects', 'subtasks', 'momentum', 'agenda']
    },
    {
      id: 'wf-habits-intervals',
      title: 'HabitFlow Precision Habits & Intervals',
      section: 'Section 7: Habits & Recurring Tasks',
      norangRef: 'https://doc.norang.ca/org-mode.html#Habits',
      summary: 'Sub-daily interval timers (hydration, stretching) and daily streak maintenance with Web Audio chimes.',
      steps: [
        'Switch views with Alt + Shift + H between Daily Streaks and Sub-Daily Intervals.',
        'Interval timers tick down in background. When expired, a Web Audio chime sounds.',
        'Click "Log Now" or press hotkey to log check-in. The habit repeater (.+1d or .+30m) advances scheduled timestamp in Org.',
        'Streak counts and fire records update automatically.'
      ],
      keyShortcuts: ['Alt + Shift + H'],
      actionableNotes: 'Syncs bidirectionally with Org tasks in habits.org.',
      keywords: ['habits', 'intervals', 'streaks', 'timers', 'chimes', 'audio']
    },
    {
      id: 'wf-org-babel',
      title: 'Org-Babel Literate Programming & Sandboxing',
      section: 'Section 14: Babel & Literate Programming',
      norangRef: 'https://doc.norang.ca/org-mode.html#Babel',
      summary: 'Execute embedded code blocks (Python, Shell, Elisp, JS) inside the client sandbox with #+RESULTS:.',
      steps: [
        'Navigate to Org & Babel tab.',
        'Write or edit code in the Org-Babel sandbox code editor.',
        'Click "Execute Block". The code runs safely and inserts #+RESULTS: output directly below.',
        'Export complete documents to Markdown or HTML via Alt + Shift + E.'
      ],
      keyShortcuts: ['Alt + Shift + E'],
      actionableNotes: 'Supports client-side deterministic evaluation with zero network execution risks.',
      keywords: ['babel', 'literate programming', 'code', 'python', 'results', 'sandbox']
    },
    {
      id: 'wf-firebase-mfa',
      title: 'Firebase Phone MFA & Zero-Trust Workspace',
      section: 'Section 16: Security & Isolation',
      norangRef: 'https://doc.norang.ca/org-mode.html#Security',
      summary: 'Mandatory Phone MFA linking enforcing account security before granting access to personal or project Org files.',
      steps: [
        'Sign in via Google or Email/Password.',
        'If Phone MFA is unlinked, navigation guards redirect to Link Phone MFA view.',
        'Submit phone number and SMS verification code (123456).',
        'Once verified, full Org and Project collaboration access is unlocked.'
      ],
      keyShortcuts: ['Alt + Shift + P'],
      actionableNotes: 'Protects multi-user project files and maintains strict tenant UID isolation.',
      keywords: ['mfa', 'phone', 'security', 'firebase', 'auth', 'collaboration']
    }
  ];

  // Filtered shortcuts based on category and search query
  public readonly filteredShortcuts = computed(() => {
    const cat = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();

    return this.shortcuts.filter(sc => {
      const matchCat = cat === 'All' || sc.category === cat;
      if (!matchCat) return false;

      if (!q) return true;
      return (
        sc.keys.toLowerCase().includes(q) ||
        sc.description.toLowerCase().includes(q) ||
        sc.norangContext.toLowerCase().includes(q) ||
        sc.keywords.some(k => k.toLowerCase().includes(q)) ||
        (sc.emacsEquivalent && sc.emacsEquivalent.toLowerCase().includes(q))
      );
    });
  });

  // Filtered workflow topics based on search query
  public readonly filteredWorkflows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.workflowTopics;

    return this.workflowTopics.filter(wf =>
      wf.title.toLowerCase().includes(q) ||
      wf.summary.toLowerCase().includes(q) ||
      wf.actionableNotes.toLowerCase().includes(q) ||
      wf.keywords.some(k => k.toLowerCase().includes(q))
    );
  });

  constructor() {
    this.initSpeechRecognition();
  }

  /**
   * Initializes Web Speech API (SpeechRecognition / webkitSpeechRecognition)
   */
  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening.set(true);
          this.speechError.set(null);
        };

        this.recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          this.transcript.set(currentTranscript);

          // If speech recognition result is final, process the query
          const lastResult = event.results[event.results.length - 1];
          if (lastResult.isFinal) {
            this.processVoiceQuery(currentTranscript);
          }
        };

        this.recognition.onerror = (event: any) => {
          this.speechError.set(`Speech recognition error: ${event.error || 'Unknown'}`);
          this.isListening.set(false);
        };

        this.recognition.onend = () => {
          this.isListening.set(false);
        };

        this.isSpeechSupported.set(true);
      } catch (err) {
        this.isSpeechSupported.set(false);
      }
    } else {
      this.isSpeechSupported.set(false);
    }
  }

  /**
   * Toggles speech recognition listening
   */
  public toggleVoiceRecognition(): void {
    if (this.isListening()) {
      this.stopVoiceRecognition();
    } else {
      this.startVoiceRecognition();
    }
  }

  public startVoiceRecognition(): void {
    this.openManual('voice');
    this.transcript.set('');
    this.speechError.set(null);

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e: any) {
        // Recognition might already be started
        this.isListening.set(true);
      }
    } else {
      // Simulate mock prompt in environments where mic is unavailable
      this.speechError.set('Web Speech API is not supported in this browser or test environment. Use the text input below to query shortcuts.');
    }
  }

  public stopVoiceRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
    this.isListening.set(false);
  }

  /**
   * Processes a spoken query (e.g. "which keyboard shortcut should be used to clock in")
   * Finds matching shortcut, prepares verbal answer, and speaks aloud via SpeechSynthesis.
   */
  /**
   * Processes a spoken query (e.g. "which keyboard shortcut should be used to clock in")
   * Finds matching shortcut, prepares verbal answer, and speaks aloud via SpeechSynthesis.
   */
  public processVoiceQuery(queryText: string): VoiceQueryResponse {
    const raw = queryText.trim();
    let clean = raw.toLowerCase().replace(/[?.,!/]/g, ' ');

    // Normalize and strip common conversational question boilerplates
    const stripped = clean
      .replace(/^which keyboard shortcut should be used (to|for)\s+/, '')
      .replace(/^what keyboard shortcut should be used (to|for)\s+/, '')
      .replace(/^which keyboard shortcut (is|to|for)\s+/, '')
      .replace(/^what is the keyboard shortcut for\s+/, '')
      .replace(/^what is the shortcut for\s+/, '')
      .replace(/^which shortcut should i use (to|for)\s+/, '')
      .replace(/^which shortcut (to|for)\s+/, '')
      .replace(/^how do i\s+/, '')
      .replace(/^how to\s+/, '')
      .replace(/^can you tell me how to\s+/, '')
      .trim();

    const targetQuery = stripped || clean;

    let matched: ShortcutItem[] = [];
    let matchedWf: WorkflowTopic | undefined;
    let answer = '';

    // Direct intent matching across all canonical Norang operations
    if (targetQuery.includes('clock in') || targetQuery.includes('start timer') || targetQuery.includes('start work') || targetQuery.includes('time track')) {
      matched = this.shortcuts.filter(s => s.action === 'clock_in');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-clocking-effort');
      answer = 'To clock in, use Alt + Shift + I (or press i in the agenda). In Norang Org-mode, this immediately clocks into the selected task and sets its state to STARTED.';
    } else if (targetQuery.includes('clock out') || targetQuery.includes('stop timer') || targetQuery.includes('end clock') || targetQuery.includes('stop clock')) {
      matched = this.shortcuts.filter(s => s.action === 'clock_out');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-clocking-effort');
      answer = 'To clock out, use Alt + Shift + O (or press o in the agenda). This computes total elapsed minutes and logs it to the task CLOCKSUM.';
    } else if (targetQuery.includes('filter') || targetQuery.includes('tag') || targetQuery.includes('context')) {
      matched = this.shortcuts.filter(s => s.action === 'filter_agenda');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-stuck-projects');
      answer = 'To filter tasks by context tag in the Norang Agenda, press / and type your tag (such as :phone:, :review:, or :security:).';
    } else if (targetQuery.includes('escape') || targetQuery.includes('quit') || targetQuery.includes('close') || targetQuery.includes('cancel')) {
      matched = this.shortcuts.filter(s => s.action === 'escape');
      answer = 'To close any active modal, capture drawer, or this manual overlay buffer, press Escape or q (Emacs C-g keyboard-quit).';
    } else if (targetQuery.includes('template') || targetQuery.includes('phone') || targetQuery.includes('meeting')) {
      matched = this.shortcuts.filter(s => s.action === 'fast_capture_template');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-inbox-capture');
      answer = 'Inside the capture dialog, use fast single keys: t for Task, h for Habit, n for Note, p for Phone call, and m for Meeting.';
    } else if (targetQuery.includes('capture') || targetQuery.includes('new task') || targetQuery.includes('add task') || targetQuery.includes('inbox') || targetQuery.includes('note')) {
      matched = this.shortcuts.filter(s => s.action === 'capture');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-inbox-capture');
      answer = 'To capture a new task or note, press Alt + Shift + C. Items land safely in refile.org without disrupting your workflow.';
    } else if (targetQuery.includes('refile') || targetQuery.includes('move task') || targetQuery.includes('inbox zero') || targetQuery.includes('archive task')) {
      matched = this.shortcuts.filter(s => s.action === 'refile' || s.action === 'fast_refile_target');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-refile-pipeline');
      answer = 'To refile tasks from refile.org to target project or todo files, press Alt + Shift + R (or press r in the agenda), then press t, h, p, or a to choose the destination.';
    } else if (targetQuery.includes('todo state') || targetQuery.includes('change state') || targetQuery.includes('mark done') || targetQuery.includes('status') || targetQuery.includes('next') || targetQuery.includes('hold')) {
      matched = this.shortcuts.filter(s => s.action === 'todo_state' || s.action === 'fast_state');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-state-machine');
      answer = 'To change TODO state, press Alt + Shift + T (or t in the agenda), then press t for TODO, n for NEXT, s for STARTED, w for WAITING, h for HOLD, or d for DONE.';
    } else if (targetQuery.includes('agenda') || targetQuery.includes('schedule') || targetQuery.includes('stuck') || targetQuery.includes('waiting')) {
      matched = this.shortcuts.filter(s => s.action === 'agenda' || s.action === 'agenda:nav');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-stuck-projects');
      answer = 'To view your Norang Multi-Block Agenda, press Alt + Shift + A. You can navigate tasks using j and k or Arrow keys.';
    } else if (targetQuery.includes('export') || targetQuery.includes('download') || targetQuery.includes('markdown') || targetQuery.includes('csv') || targetQuery.includes('report')) {
      matched = this.shortcuts.filter(s => s.action === 'export');
      answer = 'To export your Org document to Markdown, HTML, or CSV clock tables, press Alt + Shift + E.';
    } else if (targetQuery.includes('babel') || targetQuery.includes('python') || targetQuery.includes('literate') || targetQuery.includes('code') || targetQuery.includes('eval')) {
      matched = this.shortcuts.filter(s => s.action === 'org');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-org-babel');
      answer = 'To open the Org plain-text document and Org-Babel code sandbox, press Alt + Shift + B.';
    } else if (targetQuery.includes('habit') || targetQuery.includes('interval') || targetQuery.includes('streak') || targetQuery.includes('timer')) {
      matched = this.shortcuts.filter(s => s.action === 'toggle_view');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-habits-intervals');
      answer = 'To toggle between Daily Streaks and Sub-Daily Intervals, press Alt + Shift + H.';
    } else if (targetQuery.includes('project') || targetQuery.includes('collab') || targetQuery.includes('mfa') || targetQuery.includes('phone auth') || targetQuery.includes('firebase')) {
      matched = this.shortcuts.filter(s => s.action === 'projects');
      matchedWf = this.workflowTopics.find(w => w.id === 'wf-firebase-mfa');
      answer = 'To open Project Collaboration and verify Firebase Phone MFA, press Alt + Shift + P.';
    } else if (targetQuery.includes('help') || targetQuery.includes('manual') || targetQuery.includes('describe') || targetQuery.includes('documentation')) {
      matched = this.shortcuts.filter(s => s.action === 'manual');
      answer = 'To open this interactive manual and self-documentation overlay, press question mark, F1, C-h, or Alt + Shift + /.';
    } else {
      // Relevance-scored keyword search across shortcuts catalog
      const stopWords = new Set([
        'which', 'keyboard', 'shortcut', 'shortcuts', 'should', 'used', 'use',
        'for', 'the', 'and', 'can', 'how', 'what', 'please', 'with', 'from',
        'into', 'this', 'that', 'view', 'open', 'show', 'tell', 'about'
      ]);

      const words = targetQuery
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !stopWords.has(w));

      if (words.length > 0) {
        const scoredShortcuts = this.shortcuts.map(sc => {
          let score = 0;
          const desc = sc.description.toLowerCase();
          const context = sc.norangContext.toLowerCase();
          for (const w of words) {
            if (desc.includes(w)) score += 5;
            if (sc.keywords.some(k => k.toLowerCase().includes(w))) score += 4;
            if (context.includes(w)) score += 2;
            if (sc.keys.toLowerCase().includes(w)) score += 3;
          }
          return { sc, score };
        }).filter(item => item.score > 0);

        scoredShortcuts.sort((a, b) => b.score - a.score);
        matched = scoredShortcuts.map(item => item.sc);
      }

      if (matched.length > 0) {
        const top = matched[0];
        answer = `Use the shortcut ${top.keys} for ${top.description}. ${top.norangContext}`;
      } else {
        answer = `I could not find a specific shortcut for "${raw}". Press question mark, F1, or C-h to view all registered keybindings.`;
      }
    }

    const response: VoiceQueryResponse = {
      query: raw,
      answer,
      matchedShortcuts: matched,
      matchedWorkflow: matchedWf,
      confidence: matched.length > 0 ? 0.95 : 0.4
    };

    this.voiceResponse.set(response);
    this.speakAnswer(answer);
    return response;
  }

  /**
   * Speaks verbal answer aloud using Web Speech Synthesis API
   */
  public speakAnswer(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => this.isSpeaking.set(true);
      utterance.onend = () => this.isSpeaking.set(false);
      utterance.onerror = () => this.isSpeaking.set(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      this.isSpeaking.set(false);
    }
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking.set(false);
  }

  /**
   * Describe-Key resolution: Inspects any key or chord string (e.g. "Alt+Shift+C", "C-h", "?", "t")
   */
  public inspectKeyChord(event: KeyboardEvent): ShortcutItem | null {
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    const key = event.key;
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    }

    const chord = parts.join(' + ');
    this.lastInspectedKey.set(chord);

    // Match in registered shortcuts
    let match: ShortcutItem | undefined;

    // Emacs canonical C-h
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
      match = this.shortcuts.find(s => s.action === 'manual');
    } else if (event.altKey && event.shiftKey) {
      const k = event.key.toUpperCase();
      if (k === '?' || k === '/') {
        match = this.shortcuts.find(s => s.action === 'manual');
      } else {
        match = this.shortcuts.find(s => s.keys.includes(`Alt + Shift + ${k}`));
      }
    } else if (event.key === '?' || event.key === 'F1') {
      match = this.shortcuts.find(s => s.action === 'manual');
    } else if (event.key === 'Escape' || event.key.toLowerCase() === 'q') {
      match = this.shortcuts.find(s => s.action === 'escape');
    } else if (event.key === '/') {
      match = this.shortcuts.find(s => s.action === 'filter_agenda');
    } else if (event.key.toLowerCase() === 'i') {
      match = this.shortcuts.find(s => s.action === 'clock_in');
    } else if (event.key.toLowerCase() === 'o') {
      match = this.shortcuts.find(s => s.action === 'clock_out');
    } else if (event.key.toLowerCase() === 'r') {
      match = this.shortcuts.find(s => s.action === 'refile');
    } else if (['t', 'n', 's', 'w', 'h', 'd', 'c'].includes(event.key.toLowerCase())) {
      match = this.shortcuts.find(s => s.action === 'fast_state');
    } else if (['p', 'm'].includes(event.key.toLowerCase())) {
      match = this.shortcuts.find(s => s.action === 'fast_capture_template');
    } else if (['1', '2', '3', '4'].includes(event.key)) {
      match = this.shortcuts.find(s => s.action === 'fast_refile_target');
    } else if (['j', 'k'].includes(event.key.toLowerCase()) || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      match = this.shortcuts.find(s => s.action === 'agenda:nav');
    }

    this.inspectedShortcut.set(match || null);
    return match || null;
  }

  public readonly tabList: Array<'shortcuts' | 'workflows' | 'describe' | 'voice'> = [
    'shortcuts',
    'workflows',
    'describe',
    'voice'
  ];

  public cycleTab(direction: 1 | -1 = 1): void {
    const current = this.activeTab();
    const idx = this.tabList.indexOf(current);
    const nextIdx = (idx + direction + this.tabList.length) % this.tabList.length;
    this.selectTab(this.tabList[nextIdx]);
  }

  // Navigation & Manual Controls
  public openManual(tab: 'shortcuts' | 'workflows' | 'describe' | 'voice' = 'shortcuts'): void {
    this.activeTab.set(tab);
    this.manualVisible.set(true);
  }

  public closeManual(): void {
    this.manualVisible.set(false);
    this.stopSpeaking();
    this.stopVoiceRecognition();
  }

  public toggleManual(): void {
    if (this.manualVisible()) {
      this.closeManual();
    } else {
      this.openManual();
    }
  }

  public selectTab(tab: 'shortcuts' | 'workflows' | 'describe' | 'voice'): void {
    this.activeTab.set(tab);
    this.selectedIndex.set(0);
  }

  public navigateNext(): void {
    const list = this.activeTab() === 'shortcuts'
      ? this.filteredShortcuts()
      : this.filteredWorkflows();
    if (list.length === 0) return;
    this.selectedIndex.update(idx => (idx + 1) % list.length);
  }

  public navigatePrev(): void {
    const list = this.activeTab() === 'shortcuts'
      ? this.filteredShortcuts()
      : this.filteredWorkflows();
    if (list.length === 0) return;
    this.selectedIndex.update(idx => (idx - 1 + list.length) % list.length);
  }
}
