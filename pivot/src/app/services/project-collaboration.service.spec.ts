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

    const accessible = collabService.getAccessibleFiles(authService.currentUser()?.uid);
    expect(accessible.personal).toEqual(personal);
    expect(accessible.projects.some(f => f.includes('phoenix'))).toBe(true);
  });

  it('should invite collaborator by email address', async () => {
    const project = collabService.createProject('Alpha Launch');
    const invited = await collabService.inviteByEmail(project.id, 'colleague@google.com');
    expect(invited).toBe(true);

    const updated = collabService.getProject(project.id);
    expect(updated?.members.some(m => m.email === 'colleague@google.com')).toBe(true);
  });

  it('should add existing registered user one-at-a-time by name when Phone MFA is verified', () => {
    const project = collabService.createProject('Beta System');
    // Bob Vance is registered in FirebaseAuthService with phoneMfaLinked: true
    const result = collabService.addMemberByName(project.id, 'Bob Vance');
    expect(result.success).toBe(true);
    expect(result.member?.name).toBe('Bob Vance');

    const updated = collabService.getProject(project.id);
    expect(updated?.members.some(m => m.name === 'Bob Vance')).toBe(true);
  });

  it('should reject adding users who are not registered with Firebase', () => {
    const project = collabService.createProject('Gamma System');
    const result = collabService.addMemberByName(project.id, 'Unregistered Person');
    expect(result.success).toBe(false);
    expect(result.error).toContain('is not registered');
  });

  it('should reject adding registered users whose Firebase Phone MFA is incomplete', () => {
    const project = collabService.createProject('Delta System');
    // Charlie Unverified is registered with Google but phoneMfaLinked is false
    const result = collabService.addMemberByName(project.id, 'Charlie Unverified');
    expect(result.success).toBe(false);
    expect(result.error).toContain('has not completed Firebase Phone Authentication MFA');
  });
});
