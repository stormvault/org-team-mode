import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App Component (HabitFlow Org & Norang GTD Dashboard)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app and render header title', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('HabitFlow Org');
  });

  it('should switch between daily, intervals, agenda, org, and collab tabs', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.activeTab()).toBe('daily');

    app.selectTab('intervals');
    expect(app.activeTab()).toBe('intervals');

    app.selectTab('agenda');
    expect(app.activeTab()).toBe('agenda');

    app.selectTab('org');
    expect(app.activeTab()).toBe('org');

    app.selectTab('collab');
    expect(app.activeTab()).toBe('collab');
  });

  it('should handle quick capture flow', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.openCaptureModal();
    expect(app.captureModalOpen()).toBe(true);

    app.captureTitle = 'Complete security audit';
    app.captureTemplateKey = 't';
    app.captureTags = 'security, audit';
    app.submitCapture();

    expect(app.captureModalOpen()).toBe(false);
    expect(app.toast()?.message).toContain('Complete security audit');

    const tasks = app.orgEngine.getAllTasks();
    expect(tasks.some(t => t.title === 'Complete security audit')).toBe(true);
  });

  it('should handle fast TODO state change', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const task = app.orgEngine.getAllTasks()[0];

    app.openTodoStateModal(task.id);
    expect(app.todoStateModalOpen()).toBe(true);

    app.selectFastTodoState('DONE');
    expect(app.todoStateModalOpen()).toBe(false);
    expect(app.orgEngine.getTask(task.id)?.state).toBe('DONE');
  });

  it('should handle task refiling', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const task = app.orgEngine.createTask({ title: 'Task to move', file: 'refile.org' });

    app.openRefileModal(task.id);
    expect(app.refileModalOpen()).toBe(true);

    app.confirmRefile('archive.org');
    expect(app.refileModalOpen()).toBe(false);
    expect(app.orgEngine.getTask(task.id)?.file).toBe('archive.org');
  });

  it('should toggle light and dark theme', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const initial = app.darkMode();
    app.toggleTheme();
    expect(app.darkMode()).toBe(!initial);
  });

  it('should log interval habit from banner and advance repeater in Org mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const intervalHabit = app.activeIntervalHabit();
    expect(intervalHabit).toBeDefined();

    if (intervalHabit) {
      const initialCount = app.habitService.getTodayIntervalCount(intervalHabit.id);
      app.logActiveIntervalHabit();
      expect(app.habitService.getTodayIntervalCount(intervalHabit.id)).toBe(initialCount + 1);

      const orgTask = app.orgEngine.getTask(`org-${intervalHabit.id}`);
      expect(orgTask?.scheduled).toBeDefined();
    }
  });

  it('should execute Org-Babel code blocks in sandbox', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.babelLanguage = 'python';
    app.babelCode = 'print("Babel output test")';
    app.runBabelBlock();

    expect(app.babelOutput).toContain('#+RESULTS:');
    expect(app.babelOutput).toContain('Babel output test');
  });

  it('should enforce Phone MFA redirection and block protected tabs when MFA is incomplete', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Sign in with Google (phone MFA not linked yet)
    await app.loginWithGoogle();
    expect(app.authService.phoneMfaRequired()).toBe(true);
    // User must be redirected immediately to account linking registration view
    expect(app.activeTab()).toBe('link-phone');

    // Attempting to access daily habits or agenda is blocked
    app.selectTab('daily');
    expect(app.activeTab()).toBe('link-phone');
    expect(app.toast()?.message).toContain('Access Denied');

    // Complete phone MFA linking
    app.phoneInput = '+15554443322';
    await app.sendPhoneVerification();
    expect(app.phoneConfirmationId()).not.toBeNull();

    app.smsCodeInput = '123456';
    await app.confirmLinkPhoneMfa();
    expect(app.authService.isPhoneMfaComplete()).toBe(true);

    // Full Org access unlocked
    expect(app.activeTab()).toBe('daily');
  });

  it('should create collaborative projects, invite members, and add registered users by name with Phone MFA requirement', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.newProjectName = 'Orion Exploration';
    app.createNewProject();

    const projects = app.collabService.projects();
    expect(projects.some(p => p.name === 'Orion Exploration')).toBe(true);

    app.inviteEmail = 'partner@google.com';
    await app.sendInvite();

    // Adding registered user with verified Phone MFA (Alice Engineer) succeeds
    app.addMemberName = 'Alice Engineer';
    app.addMember();

    const updated = app.collabService.projects()[0];
    expect(updated.members.some(m => m.name === 'Alice Engineer')).toBe(true);

    // Adding user with incomplete Phone MFA is rejected
    app.addMemberName = 'Charlie Unverified';
    app.addMember();
    expect(app.authMessage()).toContain('has not completed Firebase Phone Authentication MFA');

    // Adding unregistered user is rejected
    app.addMemberName = 'Non Existent';
    app.addMember();
    expect(app.authMessage()).toContain('is not registered');
  });

  it('should trigger exports without throwing error', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(() => app.downloadMarkdown()).not.toThrow();
    expect(() => app.downloadHtml()).not.toThrow();
    expect(() => app.downloadCsv()).not.toThrow();
  });

  it('should group accessible files into personal and collaborative project categories', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const files = app.accessibleFiles();
    expect(files.personal).toContain('todo.org');
    expect(files.personal).toContain('habits.org');
    expect(files.projects.some(f => f.includes('projects/'))).toBe(true);
  });

  it('should toggle interactive Emacs manual on question mark button click and keybinding', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const manualBtn = compiled.querySelector('#btn-interactive-manual') as HTMLButtonElement;
    expect(manualBtn).toBeTruthy();

    expect(app.selfDoc.manualVisible()).toBe(false);

    // Clicking the prominent ? button opens the interactive manual
    manualBtn.click();
    fixture.detectChanges();
    expect(app.selfDoc.manualVisible()).toBe(true);
    expect(compiled.textContent).toContain('*Norang Manual & Self-Documentation*');

    // Closing manual
    app.closeManual();
    fixture.detectChanges();
    expect(app.selfDoc.manualVisible()).toBe(false);

    // Triggering via keyboard shortcut action
    app.shortcutsService['actionSubject'].next('manual');
    expect(app.selfDoc.manualVisible()).toBe(true);
  });

  it('should trigger voice assistant on microphone button click and answer shortcut queries', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const voiceBtn = compiled.querySelector('#btn-voice-assistant') as HTMLButtonElement;
    expect(voiceBtn).toBeTruthy();

    // Clicking prominent microphone button triggers voice assistant
    voiceBtn.click();
    fixture.detectChanges();
    expect(app.selfDoc.manualVisible()).toBe(true);
    expect(app.selfDoc.activeTab()).toBe('voice');

    // Process a voice query: "which keyboard shortcut should be used to clock in"
    app.submitManualVoiceText('which keyboard shortcut should be used to clock in');
    fixture.detectChanges();

    expect(app.selfDoc.voiceResponse()).toBeTruthy();
    expect(app.selfDoc.voiceResponse()?.answer).toContain('Alt + Shift + I');
    expect(compiled.textContent).toContain('Alt + Shift + I');
    expect(compiled.textContent).toContain('Clock In to Selected Task / Habit');
  });

  it('should inspect key events in describe-key inspector tab', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.openManual('describe');
    expect(app.selfDoc.activeTab()).toBe('describe');

    const keyEvent = new KeyboardEvent('keydown', {
      key: 'C',
      altKey: true,
      shiftKey: true
    });
    app.onManualKeyInspector(keyEvent);

    expect(app.selfDoc.lastInspectedKey()).toBe('Alt + Shift + C');
    expect(app.selfDoc.inspectedShortcut()?.action).toBe('capture');
  });

  it('should execute shortcut action directly from manual overlay', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.openManual('shortcuts');
    expect(app.selfDoc.manualVisible()).toBe(true);

    // Run capture action from manual
    app.runShortcutAction('capture');
    expect(app.selfDoc.manualVisible()).toBe(false);
    expect(app.captureModalOpen()).toBe(true);
  });

  it('should display high-density blocks in Norang Agenda: next, stuck, waiting, hold, completed history, and inbox', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.selectTab('agenda');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Check all high-density GTD blocks are present
    expect(compiled.textContent).toContain('Norang NEXT Actions List');
    expect(compiled.textContent).toContain('Stuck Projects');
    expect(compiled.textContent).toContain('Waiting & Delegated Tasks');
    expect(compiled.textContent).toContain('On Hold & Blocked Tasks');
    expect(compiled.textContent).toContain('Historically Actionable Tasks');
    expect(compiled.textContent).toContain('Refile Inbox');

    // Verify hold and done tasks are populated
    expect(app.orgEngine.holdTasks().length).toBeGreaterThan(0);
    expect(app.orgEngine.doneTasks().length).toBeGreaterThan(0);
    expect(app.orgEngine.inboxTasks().length).toBeGreaterThan(0);
  });

  it('should filter agenda blocks when agendaTagFilter is applied', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Filter by 'security'
    app.agendaTagFilter.set('security');
    const filteredTasks = app.visibleAgendaTasks();
    expect(filteredTasks.length).toBeGreaterThan(0);
    expect(filteredTasks.every(t => t.tags.some(tag => tag.includes('security')))).toBe(true);

    // Filter by non-existent tag
    app.agendaTagFilter.set('nonexistenttagxyz');
    expect(app.visibleAgendaTasks().length).toBe(0);

    // Reset filter
    app.agendaTagFilter.set('');
    expect(app.visibleAgendaTasks().length).toBeGreaterThan(0);
  });

  it('should navigate agenda cursor and target selected task in openTodoStateModal even when a clock is active', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const tasks = app.visibleAgendaTasks();
    expect(tasks.length).toBeGreaterThan(1);

    // Clock in on task 0
    app.quickClockIn(tasks[0].id);
    expect(app.orgEngine.getActiveClock()?.taskId).toBe(tasks[0].id);

    // Navigate cursor to task 1
    app.selectAgendaNextTask();
    expect(app.selectedAgendaTaskId()).toBe(tasks[1].id);

    // Open TODO state modal without passing taskId
    app.openTodoStateModal();
    // It should target task 1 (the selected task), NOT task 0 (the clocked-in task)
    expect(app.targetTaskId()).toBe(tasks[1].id);

    // State change updates task 1
    app.selectFastTodoState('WAITING');
    expect(app.orgEngine.getTask(tasks[1].id)?.state).toBe('WAITING');
    expect(app.orgEngine.getTask(tasks[0].id)?.state).toBe('STARTED');
  });

  it('should automatically clock out task when transitioning to DONE', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const task = app.orgEngine.getAllTasks()[0];
    app.quickClockIn(task.id);
    expect(app.orgEngine.getActiveClock()?.taskId).toBe(task.id);

    // Change state to DONE
    app.openTodoStateModal(task.id);
    app.selectFastTodoState('DONE');

    // Clock must be stopped automatically
    expect(app.orgEngine.getActiveClock()).toBeNull();
    const updated = app.orgEngine.getTask(task.id);
    expect(updated?.state).toBe('DONE');
    expect(updated?.closedAt).toBeDefined();
    expect(updated?.clocks.length).toBeGreaterThan(0);
  });

  it('should cycle manual tabs via actionStream', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.openManual('shortcuts');
    expect(app.selfDoc.activeTab()).toBe('shortcuts');

    app.shortcutsService['actionSubject'].next('manual:tab:next');
    expect(app.selfDoc.activeTab()).toBe('workflows');

    app.shortcutsService['actionSubject'].next('manual:tab:next');
    expect(app.selfDoc.activeTab()).toBe('describe');

    app.shortcutsService['actionSubject'].next('manual:tab:prev');
    expect(app.selfDoc.activeTab()).toBe('workflows');
  });
});

