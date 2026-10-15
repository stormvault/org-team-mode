import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ShortcutDefinition {
  keys: string;
  description: string;
  action: string;
  category: 'Global' | 'Org Capture' | 'Agenda' | 'Clocking' | 'Navigation';
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService {
  private actionSubject = new Subject<string>();
  public readonly actionStream = this.actionSubject.asObservable();

  public readonly cheatSheetVisible = signal<boolean>(false);
  public readonly activeModal = signal<'none' | 'todo_state' | 'capture' | 'refile' | 'manual'>('none');

  public readonly registeredShortcuts: ShortcutDefinition[] = [
    { keys: '? / F1 / C-h / Alt + Shift + /', description: 'Toggle Interactive Emacs Self-Documentation Manual', action: 'manual', category: 'Global' },
    { keys: 'Alt + Shift + C', description: 'Quick Org Capture Drawer', action: 'capture', category: 'Org Capture' },
    { keys: 'Alt + Shift + A', description: 'Open Norang Multi-Block Agenda', action: 'agenda', category: 'Agenda' },
    { keys: 'Alt + Shift + I  or  i', description: 'Clock In to Selected Task / Habit', action: 'clock_in', category: 'Clocking' },
    { keys: 'Alt + Shift + O  or  o', description: 'Clock Out Active Clock', action: 'clock_out', category: 'Clocking' },
    { keys: 'Alt + Shift + T  or  t', description: 'Fast TODO State Selection Menu', action: 'todo_state', category: 'Global' },
    { keys: 'Alt + Shift + R  or  r', description: 'Refile Task to Target Org File', action: 'refile', category: 'Global' },
    { keys: 'Alt + Shift + B', description: 'Open Org Document & Babel Sandbox', action: 'org', category: 'Navigation' },
    { keys: 'Alt + Shift + E', description: 'Export Document (Markdown / HTML / CSV)', action: 'export', category: 'Global' },
    { keys: 'Alt + Shift + H', description: 'Toggle HabitFlow Daily & Interval View', action: 'toggle_view', category: 'Navigation' },
    { keys: 'Alt + Shift + P', description: 'Open Project Collaboration & Access Modal', action: 'projects', category: 'Global' },
    { keys: 'Alt + Shift + K', description: 'Toggle Keyboard Shortcuts Cheat Sheet', action: 'cheat_sheet', category: 'Global' },
    { keys: 'j / k  or  ↓ / ↑', description: 'Navigate Agenda Tasks (when in Agenda view)', action: 'agenda:nav', category: 'Agenda' },
    { keys: 't / n / s / w / h / d / c', description: 'Fast State Keys (Inside State Dialog)', action: 'fast_state', category: 'Global' },
    { keys: 't / h / n / p / m', description: 'Capture Template Hotkeys (Inside Capture Dialog)', action: 'capture_tpl', category: 'Org Capture' },
    { keys: 't / h / p / a  (or 1-4)', description: 'Refile Target Keys (Inside Refile Dialog)', action: 'refile_to', category: 'Global' },
    { keys: 'Escape / q', description: 'Close any active modal, manual, or drawer', action: 'escape', category: 'Navigation' }
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  public setActiveModal(modal: 'none' | 'todo_state' | 'capture' | 'refile' | 'manual'): void {
    this.activeModal.set(modal);
  }

  public handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInput = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    // Escape always emits, even from input
    if (event.key === 'Escape') {
      if (this.cheatSheetVisible()) {
        this.cheatSheetVisible.set(false);
      }
      this.activeModal.set('none');
      this.actionSubject.next('escape');
      return;
    }

    // Canonical Emacs Help Prefix: C-h (Ctrl + h) or Cmd + h
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      this.actionSubject.next('manual');
      return;
    }

    // Do not trigger global chords if standard browser shortcuts like Ctrl+W, Ctrl+T, Ctrl+N are pressed
    if (event.ctrlKey && !event.altKey && !event.shiftKey) {
      // Reserved for browser: do NOT preventDefault
      return;
    }

    // Browser-safe chords: Alt + Shift + <Key>
    if (event.altKey && event.shiftKey) {
      const keyUpper = event.key.toUpperCase();
      switch (keyUpper) {
        case 'C':
          event.preventDefault();
          this.actionSubject.next('capture');
          break;
        case 'A':
          event.preventDefault();
          this.actionSubject.next('agenda');
          break;
        case 'I':
          event.preventDefault();
          this.actionSubject.next('clock_in');
          break;
        case 'O':
          event.preventDefault();
          this.actionSubject.next('clock_out');
          break;
        case 'T':
          event.preventDefault();
          this.actionSubject.next('todo_state');
          break;
        case 'R':
          event.preventDefault();
          this.actionSubject.next('refile');
          break;
        case 'B':
          event.preventDefault();
          this.actionSubject.next('org');
          break;
        case 'E':
          event.preventDefault();
          this.actionSubject.next('export');
          break;
        case 'H':
          event.preventDefault();
          this.actionSubject.next('toggle_view');
          break;
        case 'P':
          event.preventDefault();
          this.actionSubject.next('projects');
          break;
        case 'K':
          event.preventDefault();
          this.toggleCheatSheet();
          this.actionSubject.next('cheat_sheet');
          break;
        case '/':
        case '?':
          event.preventDefault();
          this.actionSubject.next('manual');
          break;
      }
      return;
    }

    // If typing in input, ignore single key navigation
    if (isInput) return;

    // Single-key entrypoint to open manual overlay when not typing in input
    if (event.key === '?' || event.key === 'F1') {
      event.preventDefault();
      this.actionSubject.next('manual');
      return;
    }

    // Norang Fast Single-Key Modal Shortcuts when dialog is open and not typing in text field
    const currentModal = this.activeModal();
    if (currentModal === 'manual') {
      const k = event.key;
      if (k === 'Tab') {
        event.preventDefault();
        this.actionSubject.next(event.shiftKey ? 'manual:tab:prev' : 'manual:tab:next');
        return;
      }
      if (k === 'q') {
        event.preventDefault();
        this.actionSubject.next('escape');
        return;
      }
      if (k === 'j' || k === 'ArrowDown') {
        event.preventDefault();
        this.actionSubject.next('manual:next');
        return;
      }
      if (k === 'k' || k === 'ArrowUp') {
        event.preventDefault();
        this.actionSubject.next('manual:prev');
        return;
      }
      if (k === '1' || k === '2' || k === '3' || k === '4') {
        event.preventDefault();
        this.actionSubject.next(`manual:tab:${k}`);
        return;
      }
      if (k === 'd') {
        event.preventDefault();
        this.actionSubject.next('manual:describe');
        return;
      }
      if (k === 'v' || k === 'm') {
        event.preventDefault();
        this.actionSubject.next('manual:voice');
        return;
      }
      if (k === '/') {
        event.preventDefault();
        this.actionSubject.next('manual:search');
        return;
      }
      if (k === 'Enter') {
        event.preventDefault();
        this.actionSubject.next('manual:enter');
        return;
      }
    } else if (currentModal === 'todo_state') {
      const k = event.key.toLowerCase();
      if (k === 'q') {
        event.preventDefault();
        this.actionSubject.next('escape');
        return;
      }
      const stateMap: Record<string, string> = {
        t: 'TODO',
        n: 'NEXT',
        s: 'STARTED',
        w: 'WAITING',
        h: 'HOLD',
        d: 'DONE',
        c: 'CANCELLED'
      };
      if (stateMap[k]) {
        event.preventDefault();
        this.actionSubject.next(`fast_state:${stateMap[k]}`);
        return;
      }
    } else if (currentModal === 'capture') {
      const k = event.key.toLowerCase();
      if (k === 'q') {
        event.preventDefault();
        this.actionSubject.next('escape');
        return;
      }
      if (['t', 'h', 'n', 'p', 'm'].includes(k)) {
        event.preventDefault();
        this.actionSubject.next(`capture_tpl:${k}`);
        return;
      }
    } else if (currentModal === 'refile') {
      const k = event.key.toLowerCase();
      if (k === 'q') {
        event.preventDefault();
        this.actionSubject.next('escape');
        return;
      }
      const refileMap: Record<string, string> = {
        t: 'todo.org',
        '1': 'todo.org',
        h: 'habits.org',
        '2': 'habits.org',
        p: 'projects.org',
        '3': 'projects.org',
        a: 'archive.org',
        '4': 'archive.org'
      };
      if (refileMap[k]) {
        event.preventDefault();
        this.actionSubject.next(`refile_to:${refileMap[k]}`);
        return;
      }
    } else if (currentModal === 'none') {
      // Single-key navigation when no modal is active
      const k = event.key;
      if (k === 'j' || k === 'ArrowDown') {
        event.preventDefault();
        this.actionSubject.next('agenda:next_task');
        return;
      }
      if (k === 'k' || k === 'ArrowUp') {
        event.preventDefault();
        this.actionSubject.next('agenda:prev_task');
        return;
      }
      if (k === 'i' || k === 'I') {
        event.preventDefault();
        this.actionSubject.next('clock_in');
        return;
      }
      if (k === 'o' || k === 'O') {
        event.preventDefault();
        this.actionSubject.next('clock_out');
        return;
      }
      if (k === 't') {
        event.preventDefault();
        this.actionSubject.next('todo_state');
        return;
      }
      if (k === 'r') {
        event.preventDefault();
        this.actionSubject.next('refile');
        return;
      }
      if (k === '/') {
        event.preventDefault();
        this.actionSubject.next('agenda:focus_filter');
        return;
      }
    }
  }

  public toggleCheatSheet(): void {
    this.cheatSheetVisible.update(v => {
      const next = !v;
      this.activeModal.set(next ? 'manual' : 'none');
      return next;
    });
  }
}
