import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;

  beforeEach(() => {
    service = new KeyboardShortcutsService();
  });

  it('should identify browser-safe Alt+Shift shortcuts', () => {
    let triggeredAction: string | null = null;
    service.actionStream.subscribe(action => {
      triggeredAction = action;
    });

    const event = new KeyboardEvent('keydown', {
      key: 'C',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });

    service.handleKeyDown(event);
    expect(triggeredAction).toBe('capture');
  });

  it('should not intercept reserved browser shortcuts like Ctrl+W or Ctrl+T', () => {
    let triggeredAction: string | null = null;
    service.actionStream.subscribe(action => {
      triggeredAction = action;
    });

    const ctrlW = new KeyboardEvent('keydown', {
      key: 'w',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });

    service.handleKeyDown(ctrlW);
    expect(triggeredAction).toBeNull();
    expect(ctrlW.defaultPrevented).toBe(false);
  });

  it('should trigger cheat sheet on Alt+Shift+K', () => {
    let triggeredAction: string | null = null;
    service.actionStream.subscribe(action => {
      triggeredAction = action;
    });

    const event = new KeyboardEvent('keydown', {
      key: 'K',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });

    service.handleKeyDown(event);
    expect(triggeredAction).toBe('cheat_sheet');
  });

  it('should trigger clock-in and clock-out on Alt+Shift+I and Alt+Shift+O', () => {
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'I', altKey: true, shiftKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'O', altKey: true, shiftKey: true }));

    expect(actions).toEqual(['clock_in', 'clock_out']);
  });

  it('should trigger fast single-key TODO state selection when todo_state modal is active', () => {
    service.setActiveModal('todo_state');
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'd' })); // DONE
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'n' })); // NEXT
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 's' })); // STARTED

    expect(actions).toEqual(['fast_state:DONE', 'fast_state:NEXT', 'fast_state:STARTED']);
  });

  it('should trigger template selection hotkey when capture modal is active', () => {
    service.setActiveModal('capture');
    let triggeredAction: string | null = null;
    service.actionStream.subscribe(action => {
      triggeredAction = action;
    });

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'm' })); // meeting template
    expect(triggeredAction).toBe('capture_tpl:m');
  });

  it('should trigger manual on ? single key, F1, and Alt+Shift+/', () => {
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: '?' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'F1' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: '/', altKey: true, shiftKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true })); // Emacs C-h

    expect(actions).toEqual(['manual', 'manual', 'manual', 'manual']);
  });

  it('should trigger org view on Alt+Shift+B', () => {
    let triggeredAction: string | null = null;
    service.actionStream.subscribe(action => {
      triggeredAction = action;
    });

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'B', altKey: true, shiftKey: true }));
    expect(triggeredAction).toBe('org');
  });

  it('should trigger refile targets when refile modal is active', () => {
    service.setActiveModal('refile');
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 't' })); // todo.org
    service.handleKeyDown(new KeyboardEvent('keydown', { key: '2' })); // habits.org
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'p' })); // projects.org
    service.handleKeyDown(new KeyboardEvent('keydown', { key: '4' })); // archive.org
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'q' })); // escape

    expect(actions).toEqual([
      'refile_to:todo.org',
      'refile_to:habits.org',
      'refile_to:projects.org',
      'refile_to:archive.org',
      'escape'
    ]);
  });

  it('should trigger single-key agenda navigation when no modal is active', () => {
    service.setActiveModal('none');
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'k' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'i' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'o' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 't' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'r' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: '/' }));

    expect(actions).toEqual([
      'agenda:next_task',
      'agenda:prev_task',
      'clock_in',
      'clock_out',
      'todo_state',
      'refile',
      'agenda:focus_filter'
    ]);
  });

  it('should navigate manual using j/k, numbers, and escape via q', () => {
    service.setActiveModal('manual');
    const actions: string[] = [];
    service.actionStream.subscribe(action => actions.push(action));

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'k' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: '2' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'd' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'v' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'q' }));

    expect(actions).toEqual([
      'manual:next',
      'manual:prev',
      'manual:tab:2',
      'manual:describe',
      'manual:voice',
      'manual:tab:next',
      'manual:tab:prev',
      'escape'
    ]);
  });

  it('should synchronize activeModal when cheat sheet is toggled', () => {
    expect(service.activeModal()).toBe('none');
    service.toggleCheatSheet();
    expect(service.cheatSheetVisible()).toBe(true);
    expect(service.activeModal()).toBe('manual');

    service.toggleCheatSheet();
    expect(service.cheatSheetVisible()).toBe(false);
    expect(service.activeModal()).toBe('none');
  });
});

