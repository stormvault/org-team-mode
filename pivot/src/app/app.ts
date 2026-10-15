import { Component, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrgEngineService } from './services/org-engine.service';
import { HabitService } from './services/habit.service';
import { AudioService } from './services/audio.service';
import { KeyboardShortcutsService } from './services/keyboard-shortcuts.service';
import { StorageService } from './services/storage.service';
import { FirebaseAuthService } from './services/firebase-auth.service';
import { ProjectCollaborationService } from './services/project-collaboration.service';
import { NorangTodoState, OrgTask } from './models/org.model';
import { Habit } from './models/habit.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('HabitFlow Org — Precision Habits & Norang Org Mode');

  // Active view tab
  public readonly activeTab = signal<'daily' | 'intervals' | 'agenda' | 'org' | 'collab'>('daily');

  // UI Preferences
  public readonly darkMode = signal<boolean>(true);
  public readonly selectedCategory = signal<string>('All');
  public readonly weekOffset = signal<number>(0);
  public readonly toast = signal<{ message: string; icon: string } | null>(null);

  // Modals visibility
  public readonly captureModalOpen = signal<boolean>(false);
  public readonly todoStateModalOpen = signal<boolean>(false);
  public readonly refileModalOpen = signal<boolean>(false);
  public readonly exportModalOpen = signal<boolean>(false);
  public readonly targetTaskId = signal<string | null>(null);

  // Capture Form State
  public captureTemplateKey = 't';
  public captureTitle = '';
  public captureBody = '';
  public captureEffort = '0:30';
  public captureTags = '';

  // Agenda Filter State
  public readonly agendaTagFilter = signal<string>('');

  // Org Plain Text & Babel State
  public readonly selectedOrgFile = signal<string>('todo.org');
  public orgFileContent = '';
  public babelLanguage = 'python';
  public babelCode = 'print("Hello from Norang Org-Babel sandbox!")';
  public babelOutput = '';

  // Auth & Phone MFA Form State
  public phoneInput = '+15552345678';
  public smsCodeInput = '123456';
  public phoneConfirmationId = signal<string | null>(null);
  public authMessage = signal<string | null>(null);

  // Collaboration Form State
  public newProjectName = '';
  public inviteEmail = '';
  public addMemberName = '';
  public addMemberEmail = '';

  // Subscriptions & Timers
  private shortcutSub?: Subscription;
  private intervalTimerId?: any;

  // Computed helper for first active interval habit
  public readonly activeIntervalHabit = computed(() => {
    return this.habitService.habits().find(h => h.type === 'interval');
  });

  public readonly activeIntervalRemaining = computed(() => {
    const habit = this.activeIntervalHabit();
    if (!habit) return 0;
    return this.habitService.getTimerRemaining(habit.id);
  });

  public readonly activeIntervalProgressPercent = computed(() => {
    const habit = this.activeIntervalHabit();
    if (!habit || !habit.intervalSeconds) return 0;
    const remaining = this.activeIntervalRemaining();
    return Math.max(0, Math.min(100, Math.round(((habit.intervalSeconds - remaining) / habit.intervalSeconds) * 100)));
  });

  public readonly formattedCountdown = computed(() => {
    const totalSec = this.activeIntervalRemaining();
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  public formatTimer(habitId: string): string {
    const totalSec = this.habitService.getTimerRemaining(habitId);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  public readonly weekDays = computed(() => {
    const offset = this.weekOffset();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + (offset * 7));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = this.habitService.formatDateKey(d);
      days.push({
        date: d,
        dateKey,
        dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: dateKey === this.habitService.formatDateKey(new Date())
      });
    }
    return days;
  });

  public readonly filteredAgendaTasks = computed(() => {
    const tag = this.agendaTagFilter().trim();
    if (!tag) {
      return this.orgEngine.getAllTasks();
    }
    return this.orgEngine.filterByTag(tag);
  });

  constructor(
    public orgEngine: OrgEngineService,
    public habitService: HabitService,
    public audioService: AudioService,
    public shortcutsService: KeyboardShortcutsService,
    public storageService: StorageService,
    public authService: FirebaseAuthService,
    public collabService: ProjectCollaborationService
  ) {}

  ngOnInit(): void {
    this.initTheme();
    this.initShortcuts();
    this.loadSelectedOrgFile();
    this.startIntervalTicker();
  }

  ngOnDestroy(): void {
    if (this.shortcutSub) {
      this.shortcutSub.unsubscribe();
    }
    if (this.intervalTimerId) {
      clearInterval(this.intervalTimerId);
    }
  }

  private initTheme(): void {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('habitflow_dark_mode');
      if (savedTheme !== null) {
        this.darkMode.set(savedTheme === 'true');
      }
    }
    this.applyThemeClass();
  }

  public toggleTheme(): void {
    const newVal = !this.darkMode();
    this.darkMode.set(newVal);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('habitflow_dark_mode', String(newVal));
    }
    this.applyThemeClass();
  }

  private applyThemeClass(): void {
    if (typeof document !== 'undefined') {
      if (this.darkMode()) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  private initShortcuts(): void {
    this.shortcutSub = this.shortcutsService.actionStream.subscribe(action => {
      switch (action) {
        case 'capture':
          this.openCaptureModal();
          break;
        case 'agenda':
          this.activeTab.set('agenda');
          break;
        case 'toggle_view':
          this.toggleHabitView();
          break;
        case 'clock_in':
          this.quickClockIn();
          break;
        case 'clock_out':
          this.quickClockOut();
          break;
        case 'todo_state':
          this.openTodoStateModal();
          break;
        case 'refile':
          this.openRefileModal();
          break;
        case 'export':
          this.exportModalOpen.set(true);
          break;
        case 'projects':
          this.activeTab.set('collab');
          break;
        case 'escape':
          this.closeAllModals();
          break;
      }
    });
  }

  private startIntervalTicker(): void {
    if (typeof window !== 'undefined') {
      this.intervalTimerId = setInterval(() => {
        const habits = this.habitService.habits();
        habits.forEach(h => {
          if (h.type === 'interval') {
            this.habitService.tickTimer(h.id);
          }
        });
      }, 1000);
    }
  }

  public showToast(message: string, icon = 'ph-check-circle'): void {
    this.toast.set({ message, icon });
    setTimeout(() => {
      this.toast.set(null);
    }, 3000);
  }

  public toggleHabitView(): void {
    const current = this.activeTab();
    if (current === 'daily') {
      this.activeTab.set('intervals');
    } else {
      this.activeTab.set('daily');
    }
  }

  public logActiveIntervalHabit(): void {
    const habit = this.activeIntervalHabit();
    if (habit) {
      this.habitService.logIntervalHabit(habit.id);
      this.showToast(`Logged ${habit.name}!`);
    }
  }

  public toggleActiveIntervalPause(): void {
    const habit = this.activeIntervalHabit();
    if (habit) {
      this.habitService.toggleTimerPause(habit.id);
    }
  }

  // Org Capture Modal
  public openCaptureModal(): void {
    this.captureModalOpen.set(true);
  }

  public submitCapture(): void {
    if (!this.captureTitle.trim()) return;

    const tags = this.captureTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const task = this.orgEngine.capture({
      templateKey: this.captureTemplateKey,
      title: this.captureTitle.trim(),
      body: this.captureBody.trim(),
      effort: this.captureEffort.trim(),
      tags
    });

    this.showToast(`Captured: "${task.title}" to ${task.file}`);
    this.captureTitle = '';
    this.captureBody = '';
    this.captureTags = '';
    this.captureModalOpen.set(false);
  }

  // Fast TODO Selection Modal
  public openTodoStateModal(taskId?: string): void {
    if (taskId) {
      this.targetTaskId.set(taskId);
    } else {
      const active = this.orgEngine.getActiveClock();
      if (active) {
        this.targetTaskId.set(active.taskId);
      } else {
        const first = this.orgEngine.getAllTasks()[0];
        if (first) this.targetTaskId.set(first.id);
      }
    }
    this.todoStateModalOpen.set(true);
  }

  public selectFastTodoState(state: NorangTodoState): void {
    const id = this.targetTaskId();
    if (id) {
      this.orgEngine.setTaskState(id, state);
      this.showToast(`Updated task state to [${state}]`);
    }
    this.todoStateModalOpen.set(false);
  }

  // Refile Modal
  public openRefileModal(taskId?: string): void {
    if (taskId) {
      this.targetTaskId.set(taskId);
    } else {
      const firstRefile = this.orgEngine.getAllTasks().find(t => t.file === 'refile.org');
      if (firstRefile) {
        this.targetTaskId.set(firstRefile.id);
      }
    }
    this.refileModalOpen.set(true);
  }

  public confirmRefile(targetFile: string): void {
    const id = this.targetTaskId();
    if (id) {
      this.orgEngine.refileTask(id, targetFile);
      this.showToast(`Refiled task to ${targetFile}`);
    }
    this.refileModalOpen.set(false);
  }

  public quickClockIn(taskId?: string): void {
    const target = taskId || this.orgEngine.getAllTasks()[0]?.id;
    if (target) {
      this.orgEngine.clockIn(target);
      const task = this.orgEngine.getTask(target);
      this.showToast(`Clocked IN: ${task?.title}`);
      this.audioService.playCheckin();
    }
  }

  public quickClockOut(): void {
    const entry = this.orgEngine.clockOut();
    if (entry) {
      this.showToast(`Clocked OUT. Logged ${entry.durationMinutes}m.`);
      this.audioService.playCheckin();
    } else {
      this.showToast('No active clock running.');
    }
  }

  public closeAllModals(): void {
    this.captureModalOpen.set(false);
    this.todoStateModalOpen.set(false);
    this.refileModalOpen.set(false);
    this.exportModalOpen.set(false);
    this.shortcutsService.cheatSheetVisible.set(false);
  }

  // Org Plain Text & Babel
  public async loadSelectedOrgFile(): Promise<void> {
    const filename = this.selectedOrgFile();
    const content = await this.storageService.loadOrgFile(filename);
    this.orgFileContent = content || `#+TITLE: ${filename}\n\n`;
  }

  public async saveOrgFile(): Promise<void> {
    const filename = this.selectedOrgFile();
    await this.storageService.saveOrgFile(filename, this.orgFileContent);
    this.showToast(`Saved ${filename} to browser storage!`);
  }

  public runBabelBlock(): void {
    const result = this.orgEngine.executeBabelBlock(this.babelLanguage, this.babelCode);
    this.babelOutput = `#+RESULTS:\n: ${result.output}`;
    this.showToast(`Executed Org-Babel block (${this.babelLanguage})`);
  }

  // Auth & Phone MFA
  public async loginWithGoogle(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
      this.showToast('Signed in with Google! Mandatory Phone MFA required.');
    } catch (e: any) {
      this.authMessage.set(e.message);
    }
  }

  public async loginWithEmail(): Promise<void> {
    try {
      await this.authService.signInWithEmail('user@example.com', 'password');
      this.showToast('Signed in with Email! Mandatory Phone MFA required.');
    } catch (e: any) {
      this.authMessage.set(e.message);
    }
  }

  public async sendPhoneVerification(): Promise<void> {
    try {
      const res = await this.authService.sendPhoneVerificationCode(this.phoneInput);
      this.phoneConfirmationId.set(res.confirmationId);
      this.showToast(`SMS Verification Code sent to ${this.phoneInput}! (Use 123456)`);
    } catch (e: any) {
      this.authMessage.set(e.message);
    }
  }

  public async confirmLinkPhoneMfa(): Promise<void> {
    const confId = this.phoneConfirmationId();
    if (!confId) return;
    try {
      await this.authService.linkPhoneMfa(confId, this.smsCodeInput);
      this.phoneConfirmationId.set(null);
      this.showToast('Phone MFA verified & account linked successfully! Full Org access granted.');
    } catch (e: any) {
      this.authMessage.set(e.message);
    }
  }

  // Project Collaboration
  public createNewProject(): void {
    if (!this.newProjectName.trim()) return;
    const project = this.collabService.createProject(this.newProjectName.trim());
    this.showToast(`Created collaborative project: ${project.name}`);
    this.newProjectName = '';
  }

  public async sendInvite(): Promise<void> {
    const projects = this.collabService.projects();
    if (projects.length === 0 || !this.inviteEmail.trim()) return;
    const projectId = projects[0].id;
    await this.collabService.inviteByEmail(projectId, this.inviteEmail.trim());
    this.showToast(`Invitation sent to ${this.inviteEmail}!`);
    this.inviteEmail = '';
  }

  public addMember(): void {
    const projects = this.collabService.projects();
    if (projects.length === 0 || !this.addMemberName.trim() || !this.addMemberEmail.trim()) return;
    const projectId = projects[0].id;
    this.collabService.addMemberByName(projectId, this.addMemberName.trim(), this.addMemberEmail.trim());
    this.showToast(`Added member ${this.addMemberName} to project!`);
    this.addMemberName = '';
    this.addMemberEmail = '';
  }

  // Exporters
  public downloadMarkdown(): void {
    const content = this.orgEngine.exportToMarkdown();
    this.triggerDownload('org-document.md', content, 'text/markdown');
  }

  public downloadHtml(): void {
    const content = this.orgEngine.exportToHtml();
    this.triggerDownload('org-document.html', content, 'text/html');
  }

  public downloadCsv(): void {
    const content = this.orgEngine.exportClockTableToCsv();
    this.triggerDownload('clock-report.csv', content, 'text/csv');
  }

  private triggerDownload(filename: string, content: string, mimeType: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`Exported ${filename}`);
  }
}
