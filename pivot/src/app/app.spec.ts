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

    app.activeTab.set('intervals');
    expect(app.activeTab()).toBe('intervals');

    app.activeTab.set('agenda');
    expect(app.activeTab()).toBe('agenda');

    app.activeTab.set('org');
    expect(app.activeTab()).toBe('org');

    app.activeTab.set('collab');
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

  it('should log interval habit from banner', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const intervalHabit = app.activeIntervalHabit();
    expect(intervalHabit).toBeDefined();

    if (intervalHabit) {
      const initialCount = app.habitService.getTodayIntervalCount(intervalHabit.id);
      app.logActiveIntervalHabit();
      expect(app.habitService.getTodayIntervalCount(intervalHabit.id)).toBe(initialCount + 1);
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

  it('should execute phone MFA linking flow', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    await app.loginWithGoogle();
    expect(app.authService.phoneMfaRequired()).toBe(true);

    app.phoneInput = '+15554443322';
    await app.sendPhoneVerification();
    expect(app.phoneConfirmationId()).not.toBeNull();

    app.smsCodeInput = '123456';
    await app.confirmLinkPhoneMfa();
    expect(app.authService.isPhoneMfaComplete()).toBe(true);
  });

  it('should create collaborative projects and invite members', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.newProjectName = 'Orion Exploration';
    app.createNewProject();

    const projects = app.collabService.projects();
    expect(projects.some(p => p.name === 'Orion Exploration')).toBe(true);

    app.inviteEmail = 'partner@google.com';
    await app.sendInvite();

    app.addMemberName = 'Alice Engineer';
    app.addMemberEmail = 'alice@example.com';
    app.addMember();

    const updated = app.collabService.projects()[0];
    expect(updated.members.some(m => m.name === 'Alice Engineer')).toBe(true);
  });

  it('should trigger exports without throwing error', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(() => app.downloadMarkdown()).not.toThrow();
    expect(() => app.downloadHtml()).not.toThrow();
    expect(() => app.downloadCsv()).not.toThrow();
  });
});
