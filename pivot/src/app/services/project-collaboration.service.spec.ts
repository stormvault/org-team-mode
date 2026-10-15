import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectCollaborationService } from './project-collaboration.service';
import { FirebaseAuthService } from './firebase-auth.service';

describe('ProjectCollaborationService (Segregated Org Projects & User Sharing)', () => {
  let collabService: ProjectCollaborationService;
  let authService: FirebaseAuthService;

  beforeEach(async () => {
    authService = new FirebaseAuthService();
    // Simulate authenticated user with completed MFA
    await authService.signInWithGoogle();
    const { confirmationId } = await authService.sendPhoneVerificationCode('+15559876543');
    await authService.linkPhoneMfa(confirmationId, '123456');

    collabService = new ProjectCollaborationService(authService);
  });

  it('should maintain segregated personal vs shared project org files', () => {
    const personal = collabService.getPersonalFiles();
    expect(personal).toContain('refile.org');
    expect(personal).toContain('todo.org');
    expect(personal).toContain('habits.org');

    const project = collabService.createProject('Phoenix Infrastructure');
    expect(project.orgFiles.length).toBeGreaterThan(0);
    expect(project.orgFiles[0]).toContain('projects/phoenix');
  });

  it('should invite collaborator by email address', async () => {
    const project = collabService.createProject('Alpha Launch');
    const invited = await collabService.inviteByEmail(project.id, 'colleague@google.com');
    expect(invited).toBe(true);

    const updated = collabService.getProject(project.id);
    expect(updated?.members.some(m => m.email === 'colleague@google.com')).toBe(true);
  });

  it('should add existing registered user one-at-a-time by name', () => {
    const project = collabService.createProject('Beta System');
    const success = collabService.addMemberByName(project.id, 'Bob Vance', 'bob@example.com');
    expect(success).toBe(true);

    const updated = collabService.getProject(project.id);
    expect(updated?.members.some(m => m.name === 'Bob Vance')).toBe(true);
  });
});
