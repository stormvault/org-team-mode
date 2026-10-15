import { Injectable } from '@angular/core';

export interface StorageRevision {
  id: string;
  timestamp: string;
  description: string;
  files: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private inMemoryFiles = new Map<string, string>();
  private inMemoryRevisions: StorageRevision[] = [];

  constructor() {
    this.initDefaultFiles();
  }

  private initDefaultFiles(): void {
    const defaultTodo = `* NEXT Review weekly GTD projects and clear inbox :review:admin:
  :PROPERTIES:
  :CATEGORY: OrgReview
  :END:
* TODO Verify phone MFA linking flow :security:auth:
  :PROPERTIES:
  :Effort: 0:45
  :END:`;

    const defaultHabits = `* TODO Hydrate 250ml Water (Refill & Stretch) :habit:health:
  SCHEDULED: <2026-10-15 Thu .+40m>
  :PROPERTIES:
  :STYLE: habit
  :CATEGORY: Health
  :END:
* TODO Morning Mindfulness (15m) :habit:mindfulness:
  SCHEDULED: <2026-10-15 Thu .+1d>
  :PROPERTIES:
  :STYLE: habit
  :CATEGORY: Mindfulness
  :END:`;

    this.inMemoryFiles.set('todo.org', defaultTodo);
    this.inMemoryFiles.set('habits.org', defaultHabits);
    this.inMemoryFiles.set('refile.org', '#+TITLE: Refile Inbox\n\n');
    this.inMemoryFiles.set('projects.org', '#+TITLE: Active Projects\n\n');
    this.inMemoryFiles.set('archive.org', '#+TITLE: Org Archive\n\n');
  }

  public saveSetting(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`habitflow_${key}`, value);
    }
  }

  public getSetting(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`habitflow_${key}`);
    }
    return null;
  }

  public async saveOrgFile(filename: string, content: string): Promise<void> {
    this.inMemoryFiles.set(filename, content);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`org_file_${filename}`, content);
    }
  }

  public async loadOrgFile(filename: string): Promise<string | null> {
    if (this.inMemoryFiles.has(filename)) {
      return this.inMemoryFiles.get(filename)!;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`org_file_${filename}`);
    }
    return null;
  }

  public async listOrgFiles(): Promise<string[]> {
    const files = new Set<string>(this.inMemoryFiles.keys());
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('org_file_')) {
          files.add(key.replace('org_file_', ''));
        }
      }
    }
    return Array.from(files);
  }

  public async createRevisionSnapshot(
    description: string,
    files: Record<string, string>
  ): Promise<string> {
    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot: StorageRevision = {
      id,
      timestamp: new Date().toISOString(),
      description,
      files: { ...files }
    };
    this.inMemoryRevisions.push(snapshot);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`org_rev_${id}`, JSON.stringify(snapshot));
    }
    return id;
  }

  public async getRevisions(): Promise<{ id: string; timestamp: string; description: string }[]> {
    return this.inMemoryRevisions.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      description: r.description
    }));
  }
}
