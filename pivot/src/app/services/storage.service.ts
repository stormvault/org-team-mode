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

    this.inMemoryFiles.set('user:default:todo.org', defaultTodo);
    this.inMemoryFiles.set('user:default:habits.org', defaultHabits);
    this.inMemoryFiles.set('user:default:refile.org', '#+TITLE: Refile Inbox\n\n');
    this.inMemoryFiles.set('user:default:projects.org', '#+TITLE: Active Projects\n\n');
    this.inMemoryFiles.set('user:default:archive.org', '#+TITLE: Org Archive\n\n');

    // Sample collaborative project file
    this.inMemoryFiles.set(
      'proj:projects/phoenix.org',
      `#+TITLE: Phoenix Infrastructure Project\n* TODO Set up multi-region failover :infra:\n* NEXT Configure Terraform VPC modules :cloud:`
    );
  }

  private getStorageKey(filename: string, userId = 'default'): { memKey: string; localKey: string } {
    if (filename.startsWith('projects/')) {
      const sanitized = filename.replace(/\//g, '_');
      return {
        memKey: `proj:${filename}`,
        localKey: `org_proj_${sanitized}`
      };
    }
    return {
      memKey: `user:${userId}:${filename}`,
      localKey: `org_user_${userId}_${filename}`
    };
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

  public async saveOrgFile(filename: string, content: string, userId = 'default'): Promise<void> {
    const { memKey, localKey } = this.getStorageKey(filename, userId);
    this.inMemoryFiles.set(memKey, content);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localKey, content);
    }
  }

  public async loadOrgFile(filename: string, userId = 'default'): Promise<string | null> {
    const { memKey, localKey } = this.getStorageKey(filename, userId);

    if (this.inMemoryFiles.has(memKey)) {
      return this.inMemoryFiles.get(memKey)!;
    }

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(localKey);
      if (saved !== null) {
        this.inMemoryFiles.set(memKey, saved);
        return saved;
      }
    }

    // Default template fallbacks for personal files
    if (filename === 'todo.org') {
      return this.inMemoryFiles.get('user:default:todo.org') || null;
    }
    if (filename === 'habits.org') {
      return this.inMemoryFiles.get('user:default:habits.org') || null;
    }
    if (filename.startsWith('projects/')) {
      return this.inMemoryFiles.get('proj:projects/phoenix.org') || `#+TITLE: ${filename}\n\n`;
    }

    return `#+TITLE: ${filename}\n\n`;
  }

  public async listOrgFiles(userId = 'default'): Promise<string[]> {
    const userPrefix = `user:${userId}:`;
    const files = new Set<string>();

    for (const key of this.inMemoryFiles.keys()) {
      if (key.startsWith(userPrefix)) {
        files.add(key.replace(userPrefix, ''));
      } else if (key.startsWith('proj:')) {
        files.add(key.replace('proj:', ''));
      }
    }

    if (typeof localStorage !== 'undefined') {
      const localUserPrefix = `org_user_${userId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(localUserPrefix)) {
          files.add(k.replace(localUserPrefix, ''));
        } else if (k && k.startsWith('org_proj_')) {
          files.add(k.replace('org_proj_', '').replace(/_/g, '/'));
        }
      }
    }

    // Always ensure canonical personal files are available
    ['refile.org', 'todo.org', 'habits.org', 'projects.org', 'archive.org'].forEach(f => files.add(f));

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
