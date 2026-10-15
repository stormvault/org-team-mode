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
});
