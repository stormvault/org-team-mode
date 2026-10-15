import { Injectable, signal, computed } from '@angular/core';
import { FirebaseUser, AuthProvider } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private currentUserSignal = signal<FirebaseUser | null>(null);
  public readonly currentUser = this.currentUserSignal.asReadonly();

  // Temporary storage for active phone verification requests (confirmationId -> { phoneNumber, code })
  private pendingPhoneVerifications = new Map<string, { phoneNumber: string; code: string }>();

  public readonly isPhoneMfaComplete = computed<boolean>(() => {
    const user = this.currentUserSignal();
    return !!user && user.phoneMfaLinked;
  });

  public readonly phoneMfaRequired = computed<boolean>(() => {
    const user = this.currentUserSignal();
    return !!user && !user.phoneMfaLinked;
  });

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('firebase_user_session');
      if (saved) {
        try {
          this.currentUserSignal.set(JSON.parse(saved));
        } catch {}
      }
    }
  }

  private persistSession(user: FirebaseUser | null): void {
    this.currentUserSignal.set(user);
    if (typeof localStorage !== 'undefined') {
      if (user) {
        localStorage.setItem('firebase_user_session', JSON.stringify(user));
      } else {
        localStorage.removeItem('firebase_user_session');
      }
    }
  }

  public async signInWithGoogle(): Promise<FirebaseUser> {
    const user: FirebaseUser = {
      uid: 'google-user-789',
      email: 'user@google.com',
      displayName: 'Google Org User',
      photoURL: 'https://lh3.googleusercontent.com/a/default-user',
      providerId: 'google',
      phoneMfaLinked: false, // Mandatory Phone MFA is required!
      idToken: `mock-jwt-token-${Date.now()}`
    };
    this.persistSession(user);
    return user;
  }

  public async signInWithEmail(email: string, _password: string): Promise<FirebaseUser> {
    const user: FirebaseUser = {
      uid: `email-user-${Math.random().toString(36).slice(2, 7)}`,
      email,
      displayName: email.split('@')[0],
      providerId: 'password',
      phoneMfaLinked: false, // Mandatory Phone MFA is required!
      idToken: `mock-jwt-token-${Date.now()}`
    };
    this.persistSession(user);
    return user;
  }

  public async registerWithEmail(email: string, password: string, name: string): Promise<FirebaseUser> {
    const user: FirebaseUser = {
      uid: `email-user-${Math.random().toString(36).slice(2, 7)}`,
      email,
      displayName: name,
      providerId: 'password',
      phoneMfaLinked: false, // Mandatory Phone MFA is required!
      idToken: `mock-jwt-token-${Date.now()}`
    };
    this.persistSession(user);
    return user;
  }

  public async sendPhoneVerificationCode(phoneNumber: string): Promise<{ confirmationId: string }> {
    const confirmationId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Deterministic test verification code '123456'
    this.pendingPhoneVerifications.set(confirmationId, {
      phoneNumber,
      code: '123456'
    });
    return { confirmationId };
  }

  public async linkPhoneMfa(confirmationId: string, verificationCode: string): Promise<FirebaseUser> {
    const current = this.currentUserSignal();
    if (!current) {
      throw new Error('No authenticated user session to link phone MFA.');
    }

    const verification = this.pendingPhoneVerifications.get(confirmationId);
    if (!verification) {
      throw new Error('Verification session expired or not found.');
    }

    if (verificationCode !== verification.code) {
      throw new Error('Invalid verification code.');
    }

    const updatedUser: FirebaseUser = {
      ...current,
      phoneNumber: verification.phoneNumber,
      phoneMfaLinked: true
    };

    this.pendingPhoneVerifications.delete(confirmationId);
    this.persistSession(updatedUser);
    return updatedUser;
  }

  public signOut(): void {
    this.persistSession(null);
  }
}
