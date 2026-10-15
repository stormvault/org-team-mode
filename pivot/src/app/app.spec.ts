import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render HabitFlow Org title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('HabitFlow Org');
  });

  it('should switch between daily, intervals, and agenda tabs', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.activeTab()).toBe('daily');

    app.activeTab.set('intervals');
    expect(app.activeTab()).toBe('intervals');

    app.activeTab.set('agenda');
    expect(app.activeTab()).toBe('agenda');
  });

  it('should open and close capture modal', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.captureModalOpen()).toBe(false);

    app.openCaptureModal();
    expect(app.captureModalOpen()).toBe(true);

    app.closeAllModals();
    expect(app.captureModalOpen()).toBe(false);
  });
});
