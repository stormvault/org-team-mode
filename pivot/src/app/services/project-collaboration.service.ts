import { Injectable, signal } from '@angular/core';
import { CollaborativeProject, ProjectMember } from '../models/auth.model';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectCollaborationService {
  private projectsSignal = signal<CollaborativeProject[]>([]);
  public readonly projects = this.projectsSignal.asReadonly();

  constructor(private authService: FirebaseAuthService) {
    this.seedProjects();
  }

  private seedProjects(): void {
    const user = this.authService.currentUser();
    const ownerUid = user ? user.uid : 'default-user-uid';

    const sampleProject: CollaborativeProject = {
      id: 'proj-phoenix',
      name: 'Phoenix Infrastructure',
      ownerUid,
      members: [
        {
          uid: ownerUid,
          name: user?.displayName || 'Primary User',
          email: user?.email || 'user@example.com',
          role: 'owner',
          invitedAt: new Date().toISOString()
        }
      ],
      orgFiles: ['projects/phoenix.org'],
      createdAt: new Date().toISOString()
    };

    this.projectsSignal.set([sampleProject]);
  }

  public getPersonalFiles(): string[] {
    return ['refile.org', 'todo.org', 'habits.org', 'notes.org', 'archive.org'];
  }

  public getProject(projectId: string): CollaborativeProject | undefined {
    return this.projectsSignal().find(p => p.id === projectId);
  }

  public createProject(name: string): CollaborativeProject {
    const user = this.authService.currentUser();
    const ownerUid = user ? user.uid : 'current-user-uid';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `proj-${Date.now()}`;

    const newProject: CollaborativeProject = {
      id,
      name,
      ownerUid,
      members: [
        {
          uid: ownerUid,
          name: user?.displayName || 'Owner',
          email: user?.email || 'owner@example.com',
          role: 'owner',
          invitedAt: new Date().toISOString()
        }
      ],
      orgFiles: [`projects/${slug}.org`],
      createdAt: new Date().toISOString()
    };

    this.projectsSignal.update(projects => [...projects, newProject]);
    return newProject;
  }

  public async inviteByEmail(projectId: string, email: string): Promise<boolean> {
    const project = this.getProject(projectId);
    if (!project) return false;

    const newMember: ProjectMember = {
      uid: `invited-${Math.random().toString(36).slice(2, 7)}`,
      name: email.split('@')[0],
      email,
      role: 'editor',
      invitedAt: new Date().toISOString()
    };

    this.projectsSignal.update(projects =>
      projects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            members: [...p.members, newMember]
          };
        }
        return p;
      })
    );
    return true;
  }

  public addMemberByName(projectId: string, name: string, email: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const newMember: ProjectMember = {
      uid: `registered-${Math.random().toString(36).slice(2, 7)}`,
      name,
      email,
      role: 'editor',
      invitedAt: new Date().toISOString()
    };

    this.projectsSignal.update(projects =>
      projects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            members: [...p.members, newMember]
          };
        }
        return p;
      })
    );
    return true;
  }
}
