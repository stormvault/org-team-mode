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
    const ownerUid = user ? user.uid : 'google-user-alice';

    const sampleProject: CollaborativeProject = {
      id: 'proj-phoenix',
      name: 'Phoenix Infrastructure',
      ownerUid,
      members: [
        {
          uid: ownerUid,
          name: user?.displayName || 'Alice Engineer',
          email: user?.email || 'alice@google.com',
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

  public getAccessibleFiles(userId?: string): { personal: string[]; projects: string[] } {
    const uid = userId || this.authService.currentUser()?.uid || 'default';
    const personal = this.getPersonalFiles();
    const projectFiles: string[] = [];

    this.projectsSignal().forEach(p => {
      const isMember = p.ownerUid === uid || p.members.some(m => m.uid === uid);
      if (isMember) {
        projectFiles.push(...p.orgFiles);
      }
    });

    return {
      personal,
      projects: Array.from(new Set(projectFiles))
    };
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return false;

    // Check if already in project
    if (project.members.some(m => m.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      return false;
    }

    const newMember: ProjectMember = {
      uid: `invited-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedEmail.split('@')[0],
      email: trimmedEmail,
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

  /**
   * Adds an already registered user (Email or Google Auth) by name,
   * strictly requiring that Firebase Phone Authentication MFA is completed.
   */
  public addMemberByName(
    projectId: string,
    name: string,
    _optionalEmail?: string
  ): { success: boolean; error?: string; member?: ProjectMember } {
    const project = this.getProject(projectId);
    if (!project) {
      return { success: false, error: `Project not found.` };
    }

    // Lookup user in registered users directory
    const registeredUser = this.authService.findRegisteredUserByName(name);
    if (!registeredUser) {
      return {
        success: false,
        error: `User "${name}" is not registered. Users must be registered with Firebase Google or Email Authentication.`
      };
    }

    // Mandatory Phone Authentication MFA check
    if (!registeredUser.phoneMfaLinked) {
      return {
        success: false,
        error: `User "${registeredUser.displayName || name}" has not completed Firebase Phone Authentication MFA. Mandatory Phone MFA is required to collaborate on projects.`
      };
    }

    // Check if already a member
    const alreadyMember = project.members.some(
      m => m.uid === registeredUser.uid || m.email.toLowerCase() === (registeredUser.email || '').toLowerCase()
    );
    if (alreadyMember) {
      return {
        success: false,
        error: `User "${registeredUser.displayName || name}" is already a member of this project.`
      };
    }

    const newMember: ProjectMember = {
      uid: registeredUser.uid,
      name: registeredUser.displayName || name,
      email: registeredUser.email || '',
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

    return { success: true, member: newMember };
  }

  public getEligibleUsersToAdd(projectId: string) {
    const project = this.getProject(projectId);
    if (!project) return [];

    const memberUids = new Set(project.members.map(m => m.uid));
    // Must be registered AND have Phone MFA linked AND not currently a member
    return this.authService.getEligibleCollaborators().filter(u => !memberUids.has(u.uid));
  }
}
