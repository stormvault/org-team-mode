import { describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService (Firebase Auth & Mandatory Phone MFA)', () => {
  let authService: FirebaseAuthService;

  beforeEach(() => {
    authService = new FirebaseAuthService();
    authService.signOut();
  });

  it('should authenticate user with Google Sign-In but flag incomplete Phone MFA', async () => {
    const user = await authService.signInWithGoogle();
    expect(user.uid).toBeDefined();
    expect(user.providerId).toBe('google');
    expect(user.phoneMfaLinked).toBe(false);
    expect(authService.isPhoneMfaComplete()).toBe(false);
  });

  it('should authenticate user with Email/Password but flag incomplete Phone MFA', async () => {
    const user = await authService.signInWithEmail('alice@example.com', 'SecurePass123!');
    expect(user.email).toBe('alice@example.com');
    expect(user.phoneMfaLinked).toBe(false);
    expect(authService.isPhoneMfaComplete()).toBe(false);
  });

  it('should link phone number to current account and mark phone MFA as complete', async () => {
    await authService.signInWithGoogle();
    expect(authService.isPhoneMfaComplete()).toBe(false);

    const { confirmationId } = await authService.sendPhoneVerificationCode('+15551234567');
    expect(confirmationId).toBeDefined();

    const linkedUser = await authService.linkPhoneMfa(confirmationId, '123456');
    expect(linkedUser.phoneMfaLinked).toBe(true);
    expect(linkedUser.phoneNumber).toBe('+15551234567');
    expect(authService.isPhoneMfaComplete()).toBe(true);
  });

  it('should reject invalid MFA SMS verification code', async () => {
    await authService.signInWithGoogle();
    const { confirmationId } = await authService.sendPhoneVerificationCode('+15551234567');

    await expect(authService.linkPhoneMfa(confirmationId, '000000')).rejects.toThrow(
      'Invalid verification code'
    );
  });
});
