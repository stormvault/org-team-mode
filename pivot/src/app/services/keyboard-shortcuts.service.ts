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
  public readonly activeModal = signal<'none' | 'todo_state' | 'capture' | 'refile'>('none');

  public readonly registeredShortcuts: ShortcutDefinition[] = [
    { keys: 'Alt + Shift + C', description: 'Quick Org Capture Drawer', action: 'capture', category: 'Org Capture' },
    { keys: 'Alt + Shift + A', description: 'Open Norang Multi-Block Agenda', action: 'agenda', category: 'Agenda' },
    { keys: 'Alt + Shift + I', description: 'Clock In to Selected Task / Habit', action: 'clock_in', category: 'Clocking' },
    { keys: 'Alt + Shift + O', description: 'Clock Out Active Clock', action: 'clock_out', category: 'Clocking' },
    { keys: 'Alt + Shift + T', description: 'Fast TODO State Selection Menu', action: 'todo_state', category: 'Global' },
    { keys: 'Alt + Shift + R', description: 'Refile Task to Target Org File', action: 'refile', category: 'Global' },
    { keys: 'Alt + Shift + E', description: 'Export Document (Markdown / HTML / CSV)', action: 'export', category: 'Global' },
    { keys: 'Alt + Shift + H', description: 'Toggle HabitFlow Daily & Interval View', action: 'toggle_view', category: 'Navigation' },
    { keys: 'Alt + Shift + P', description: 'Open Project Collaboration & Access Modal', action: 'projects', category: 'Global' },
    { keys: 'Alt + Shift + K', description: 'Toggle Keyboard Shortcuts Cheat Sheet', action: 'cheat_sheet', category: 'Global' },
    { keys: 't / n / s / w / h / d / c', description: 'Fast State Keys (Inside State Dialog)', action: 'fast_state', category: 'Global' },
    { keys: 'Escape', description: 'Close any active modal or drawer', action: 'escape', category: 'Navigation' }
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  public setActiveModal(modal: 'none' | 'todo_state' | 'capture' | 'refile'): void {
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
      }
      return;
    }

    // If typing in input, ignore single key navigation
    if (isInput) return;

    // Norang Fast Single-Key Modal Shortcuts when dialog is open and not typing in text field
    const currentModal = this.activeModal();
    if (currentModal === 'todo_state') {
      const k = event.key.toLowerCase();
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
      if (['t', 'h', 'n', 'p', 'm'].includes(k)) {
        event.preventDefault();
        this.actionSubject.next(`capture_tpl:${k}`);
        return;
      }
    }
  }

  public toggleCheatSheet(): void {
    this.cheatSheetVisible.update(v => !v);
  }
}
