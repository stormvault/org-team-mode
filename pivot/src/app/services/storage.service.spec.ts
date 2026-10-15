import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService (IndexedDB & LocalStorage)', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  it('should store and retrieve localStorage settings', () => {
    service.saveSetting('test_theme', 'dark');
    expect(service.getSetting('test_theme')).toBe('dark');
  });

  it('should store and load org files in client-side storage', async () => {
    await service.saveOrgFile('tasks.org', '* TODO Write unit tests');
    const content = await service.loadOrgFile('tasks.org');
    expect(content).toBe('* TODO Write unit tests');

    const files = await service.listOrgFiles();
    expect(files).toContain('tasks.org');
  });

  it('should maintain strict per-user file isolation for personal Org files', async () => {
    // User Alice writes her private todo.org
    await service.saveOrgFile('todo.org', '* TODO Alice personal task', 'user-alice');
    // User Bob writes his private todo.org
    await service.saveOrgFile('todo.org', '* TODO Bob separate task', 'user-bob');

    const aliceContent = await service.loadOrgFile('todo.org', 'user-alice');
    const bobContent = await service.loadOrgFile('todo.org', 'user-bob');

    expect(aliceContent).toBe('* TODO Alice personal task');
    expect(bobContent).toBe('* TODO Bob separate task');
  });

  it('should store shared collaborative project files across users', async () => {
    await service.saveOrgFile(
      'projects/phoenix.org',
      '* TODO Shared team architecture task',
      'user-alice'
    );

    const loadedByBob = await service.loadOrgFile('projects/phoenix.org', 'user-bob');
    expect(loadedByBob).toBe('* TODO Shared team architecture task');
  });

  it('should create and retrieve revision snapshots', async () => {
    const revId = await service.createRevisionSnapshot('Initial snapshot', {
      'todo.org': '* TODO Initial task'
    });
    expect(revId).toBeDefined();

    const revisions = await service.getRevisions();
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[revisions.length - 1].description).toBe('Initial snapshot');
  });
});
