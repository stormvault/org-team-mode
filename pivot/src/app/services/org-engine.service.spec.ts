import { describe, it, expect, beforeEach } from 'vitest';
import { OrgEngineService } from './org-engine.service';
import { NorangTodoState } from '../models/org.model';

describe('OrgEngineService (Norang Org-Mode Engine)', () => {
  let service: OrgEngineService;

  beforeEach(() => {
    service = new OrgEngineService();
  });

  describe('Task State Machine & Fast Selection', () => {
    it('should map fast selection keys to correct Norang TODO states', () => {
      expect(service.getStateFromFastKey('t')).toBe('TODO');
      expect(service.getStateFromFastKey('n')).toBe('NEXT');
      expect(service.getStateFromFastKey('s')).toBe('STARTED');
      expect(service.getStateFromFastKey('w')).toBe('WAITING');
      expect(service.getStateFromFastKey('h')).toBe('HOLD');
      expect(service.getStateFromFastKey('d')).toBe('DONE');
      expect(service.getStateFromFastKey('c')).toBe('CANCELLED');
      expect(service.getStateFromFastKey('x')).toBeNull();
    });

    it('should transition task states and record state transition logs', () => {
      const task = service.createTask({
        title: 'Draft quarterly report',
        file: 'refile.org'
      });
      expect(task.state).toBe('TODO');

      service.setTaskState(task.id, 'NEXT');
      const updated = service.getTask(task.id);
      expect(updated?.state).toBe('NEXT');
      expect(updated?.logs.length).toBe(1);
      expect(updated?.logs[0].fromState).toBe('TODO');
      expect(updated?.logs[0].toState).toBe('NEXT');

      service.setTaskState(task.id, 'DONE');
      const doneTask = service.getTask(task.id);
      expect(doneTask?.state).toBe('DONE');
      expect(doneTask?.closedAt).toBeDefined();
    });
  });

  describe('Org Capture & Refiling', () => {
    it('should capture a task into refile.org staging by default', () => {
      const captured = service.capture({
        templateKey: 't',
        title: 'Review pull request from team',
        body: 'Check test coverage and security constraints',
        tags: ['code-review']
      });

      expect(captured.file).toBe('refile.org');
      expect(captured.title).toBe('Review pull request from team');
      expect(captured.state).toBe('TODO');
      expect(captured.tags).toContain('code-review');
    });

    it('should capture a meeting note with attendees and discussion notes', () => {
      const meeting = service.capture({
        templateKey: 'm',
        title: 'Sprint Planning Sync',
        body: 'Attendees: Alice, Bob. Decided to focus on PWA offline sync.',
        tags: ['meeting']
      });

      expect(meeting.file).toBe('refile.org');
      expect(meeting.title).toBe('Sprint Planning Sync');
      expect(meeting.tags).toContain('meeting');
    });

    it('should refile tasks from refile.org to target files', () => {
      const captured = service.capture({
        templateKey: 't',
        title: 'Refactor audio service',
        tags: ['dev']
      });

      expect(captured.file).toBe('refile.org');
      const success = service.refileTask(captured.id, 'projects.org');
      expect(success).toBe(true);

      const refiled = service.getTask(captured.id);
      expect(refiled?.file).toBe('projects.org');
    });
  });

  describe('Time Clocking & Reporting', () => {
    it('should clock in and clock out of a task with duration calculation', () => {
      const task = service.createTask({
        title: 'Implement Web Audio chime',
        file: 'todo.org',
        effort: '0:30'
      });

      service.clockIn(task.id);
      expect(service.getActiveClock()?.taskId).toBe(task.id);
      expect(service.getTask(task.id)?.state).toBe('STARTED');

      // Clock out
      const clockEntry = service.clockOut();
      expect(clockEntry).not.toBeNull();
      expect(service.getActiveClock()).toBeNull();
      expect(clockEntry?.durationMinutes).toBeGreaterThanOrEqual(0);
    });

    it('should detect overtime when accumulated clock exceeds effort estimate', () => {
      const task = service.createTask({
        title: 'Quick fix for layout glitch',
        file: 'todo.org',
        effort: '0:15'
      });

      // Manually add clock entry exceeding 15 minutes
      service.addManualClock(task.id, 25);
      expect(service.isTaskOvertime(task.id)).toBe(true);
    });
  });

  describe('Custom Agenda & Stuck Projects Detection', () => {
    it('should generate custom agenda blocks including NEXT actions and Stuck Projects', () => {
      // Create a project with subtasks
      const project = service.createTask({
        title: 'Project Phoenix Redesign',
        file: 'projects.org',
        tags: ['project']
      });

      const subtask1 = service.createTask({
        title: 'Create wireframes',
        file: 'projects.org',
        parentId: project.id
      });

      // Initially subtask1 is TODO (not NEXT), so Project Phoenix is stuck!
      let stuckProjects = service.getStuckProjects();
      expect(stuckProjects.some(p => p.id === project.id)).toBe(true);

      // Now set subtask1 to NEXT
      service.setTaskState(subtask1.id, 'NEXT');
      stuckProjects = service.getStuckProjects();
      expect(stuckProjects.some(p => p.id === project.id)).toBe(false);

      const nextActions = service.getNextActions();
      expect(nextActions.some(t => t.id === subtask1.id)).toBe(true);
    });

    it('should filter agenda tasks by context tag', () => {
      service.createTask({ title: 'Call client about invoice', file: 'todo.org', tags: ['phone'] });
      service.createTask({ title: 'Inspect firejail profile', file: 'todo.org', tags: ['security'] });

      const phoneTasks = service.filterByTag('phone');
      expect(phoneTasks.length).toBe(1);
      expect(phoneTasks[0].title).toBe('Call client about invoice');
    });
  });

  describe('Org-Babel & Document Exporting', () => {
    it('should simulate Org-Babel code execution and generate results', () => {
      const code = 'print("Hello from Org-Babel!")';
      const result = service.executeBabelBlock('python', code);
      expect(result.status).toBe('success');
      expect(result.output).toContain('Hello from Org-Babel!');
    });

    it('should export tasks to Markdown and HTML format', () => {
      service.createTask({
        title: 'Publish release v1.0',
        file: 'todo.org',
        tags: ['release']
      });

      const md = service.exportToMarkdown();
      expect(md).toContain('# Org Mode Document');
      expect(md).toContain('Publish release v1.0');

      const html = service.exportToHtml();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Publish release v1.0');
    });

    it('should export clock report tables to CSV format', () => {
      const task = service.createTask({ title: 'Client consultation', file: 'todo.org' });
      service.addManualClock(task.id, 45);

      const csv = service.exportClockTableToCsv();
      expect(csv).toContain('Task ID,Title,File,Total Minutes,Total Hours');
      expect(csv).toContain('Client consultation');
      expect(csv).toContain('45');
    });
  });
});
