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
});
