import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelfDocumentationService } from './self-documentation.service';

describe('SelfDocumentationService', () => {
  let service: SelfDocumentationService;

  beforeEach(() => {
    service = new SelfDocumentationService();
  });

  it('should initialize with complete list of registered shortcuts', () => {
    expect(service.shortcuts.length).toBeGreaterThan(10);
    const clockIn = service.shortcuts.find(s => s.action === 'clock_in');
    expect(clockIn).toBeDefined();
    expect(clockIn?.keys).toBe('Alt + Shift + I');
    expect(clockIn?.norangContext).toContain('STARTED');
  });

  it('should filter shortcuts by category and search keyword', () => {
    service.selectedCategory.set('Clocking');
    expect(service.filteredShortcuts().every(s => s.category === 'Clocking')).toBe(true);

    service.selectedCategory.set('All');
    service.searchQuery.set('capture');
    expect(service.filteredShortcuts().some(s => s.action === 'capture')).toBe(true);
    expect(service.filteredShortcuts().every(s =>
      s.description.toLowerCase().includes('capture') ||
      s.norangContext.toLowerCase().includes('capture') ||
      s.keywords.some(k => k.includes('capture'))
    )).toBe(true);
  });

  it('should list Norang GTD workflow topics and filter by query', () => {
    expect(service.workflowTopics.length).toBeGreaterThan(5);
    const clockingWf = service.workflowTopics.find(w => w.id === 'wf-clocking-effort');
    expect(clockingWf).toBeDefined();
    expect(clockingWf?.title).toContain('Clocking');

    service.searchQuery.set('stuck');
    const filtered = service.filteredWorkflows();
    expect(filtered.some(w => w.id === 'wf-stuck-projects')).toBe(true);
  });

  it('should inspect key events in describe-key mode', () => {
    const clockInEvent = new KeyboardEvent('keydown', {
      key: 'I',
      altKey: true,
      shiftKey: true
    });

    const match = service.inspectKeyChord(clockInEvent);
    expect(match?.action).toBe('clock_in');
    expect(service.lastInspectedKey()).toBe('Alt + Shift + I');
    expect(service.inspectedShortcut()?.action).toBe('clock_in');

    const questionEvent = new KeyboardEvent('keydown', { key: '?' });
    const qMatch = service.inspectKeyChord(questionEvent);
    expect(qMatch?.action).toBe('manual');

    // Test single key bindings: i (clock in), o (clock out), r (refile)
    const iMatch = service.inspectKeyChord(new KeyboardEvent('keydown', { key: 'i' }));
    expect(iMatch?.action).toBe('clock_in');

    const oMatch = service.inspectKeyChord(new KeyboardEvent('keydown', { key: 'o' }));
    expect(oMatch?.action).toBe('clock_out');

    const rMatch = service.inspectKeyChord(new KeyboardEvent('keydown', { key: 'r' }));
    expect(rMatch?.action).toBe('refile');

    const cHMacth = service.inspectKeyChord(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true }));
    expect(cHMacth?.action).toBe('manual');
  });

  it('should process natural language voice queries and return exact keyboard shortcuts', () => {
    // Test: "which keyboard shortcut should be used to clock in"
    const clockInRes = service.processVoiceQuery('which keyboard shortcut should be used to clock in');
    expect(clockInRes.answer).toContain('Alt + Shift + I');
    expect(clockInRes.matchedShortcuts.some(s => s.action === 'clock_in')).toBe(true);

    // Test: "which shortcut to clock out"
    const clockOutRes = service.processVoiceQuery('which shortcut to clock out');
    expect(clockOutRes.answer).toContain('Alt + Shift + O');
    expect(clockOutRes.matchedShortcuts.some(s => s.action === 'clock_out')).toBe(true);

    // Test: "how do I capture a new task"
    const captureRes = service.processVoiceQuery('how do I capture a new task');
    expect(captureRes.answer).toContain('Alt + Shift + C');
    expect(captureRes.matchedShortcuts.some(s => s.action === 'capture')).toBe(true);

    // Test: "how to change todo state"
    const stateRes = service.processVoiceQuery('how to change todo state');
    expect(stateRes.answer).toContain('Alt + Shift + T');

    // Test: "how to refile"
    const refileRes = service.processVoiceQuery('how to refile');
    expect(refileRes.answer).toContain('Alt + Shift + R');

    // Test: "show agenda"
    const agendaRes = service.processVoiceQuery('show agenda');
    expect(agendaRes.answer).toContain('Alt + Shift + A');
  });

  it('should handle unmapped queries gracefully', () => {
    const unknownRes = service.processVoiceQuery('quantum teleportation hyperdrive');
    expect(unknownRes.answer).toContain('could not find a specific shortcut');
    expect(unknownRes.confidence).toBeLessThan(0.5);
  });

  it('should toggle manual overlay and navigate between tabs and items', () => {
    expect(service.manualVisible()).toBe(false);
    service.openManual('shortcuts');
    expect(service.manualVisible()).toBe(true);
    expect(service.activeTab()).toBe('shortcuts');

    service.navigateNext();
    expect(service.selectedIndex()).toBe(1);
    service.navigatePrev();
    expect(service.selectedIndex()).toBe(0);

    service.selectTab('voice');
    expect(service.activeTab()).toBe('voice');

    // Test cycling tabs forward and backward
    service.selectTab('shortcuts');
    service.cycleTab(1);
    expect(service.activeTab()).toBe('workflows');
    service.cycleTab(1);
    expect(service.activeTab()).toBe('describe');
    service.cycleTab(1);
    expect(service.activeTab()).toBe('voice');
    service.cycleTab(1);
    expect(service.activeTab()).toBe('shortcuts');

    service.cycleTab(-1);
    expect(service.activeTab()).toBe('voice');

    service.toggleManual();
    expect(service.manualVisible()).toBe(false);
  });

  it('should gracefully handle speech synthesis calls without errors', () => {
    expect(() => service.speakAnswer('Test speech')).not.toThrow();
    expect(() => service.stopSpeaking()).not.toThrow();
  });
});
