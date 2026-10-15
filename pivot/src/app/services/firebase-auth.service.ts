import { Injectable, signal, computed } from '@angular/core';
import { FirebaseUser, AuthProvider } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private currentUserSignal = signal<FirebaseUser | null>(null);
  public readonly currentUser = this.currentUserSignal.asReadonly();

  // Directory of registered users in the system (Email & Google users)
  private registeredUsersSignal = signal<FirebaseUser[]>([]);
  public readonly registeredUsers = this.registeredUsersSignal.asReadonly();

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
    this.initDefaultRegisteredUsers();
    this.restoreSession();
  }

  private initDefaultRegisteredUsers(): void {
    const defaults: FirebaseUser[] = [
      {
        uid: 'google-user-alice',
        email: 'alice@google.com',
        displayName: 'Alice Engineer',
        photoURL: 'https://lh3.googleusercontent.com/a/alice',
        providerId: 'google',
        phoneNumber: '+15551112222',
        phoneMfaLinked: true,
        idToken: 'mock-jwt-alice'
      },
      {
        uid: 'email-user-bob',
        email: 'bob@example.com',
        displayName: 'Bob Vance',
        providerId: 'password',
        phoneNumber: '+15553334444',
        phoneMfaLinked: true,
        idToken: 'mock-jwt-bob'
      },
      {
        uid: 'google-user-charlie',
        email: 'charlie@google.com',
        displayName: 'Charlie Unverified',
        providerId: 'google',
        phoneMfaLinked: false, // Incomplete MFA!
        idToken: 'mock-jwt-charlie'
      },
      {
        uid: 'email-user-david',
        email: 'david@example.com',
        displayName: 'David Password',
        providerId: 'password',
        phoneMfaLinked: false, // Incomplete MFA!
        idToken: 'mock-jwt-david'
      }
    ];

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('firebase_registered_users');
      if (saved) {
        try {
          this.registeredUsersSignal.set(JSON.parse(saved));
          return;
        } catch {}
      }
    }
    this.registeredUsersSignal.set(defaults);
    this.persistRegisteredUsers();
  }

  private persistRegisteredUsers(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('firebase_registered_users', JSON.stringify(this.registeredUsersSignal()));
    }
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

  public getRegisteredUsers(): FirebaseUser[] {
    return this.registeredUsersSignal();
  }

  public getEligibleCollaborators(): FirebaseUser[] {
    // Only registered users with verified Firebase Phone Authentication MFA are eligible to collaborate
    return this.registeredUsersSignal().filter(u => u.phoneMfaLinked);
  }

  public findRegisteredUserByName(name: string): FirebaseUser | undefined {
    const trimmed = name.trim().toLowerCase();
    return this.registeredUsersSignal().find(
      u => u.displayName?.toLowerCase() === trimmed || u.email?.toLowerCase() === trimmed
    );
  }

  public async signInWithGoogle(customEmail?: string, customName?: string): Promise<FirebaseUser> {
    const email = customEmail || 'user@google.com';
    const displayName = customName || 'Google Org User';

    let user = this.registeredUsersSignal().find(u => u.email === email);
    if (!user) {
      user = {
        uid: 'google-user-789',
        email,
        displayName,
        photoURL: 'https://lh3.googleusercontent.com/a/default-user',
        providerId: 'google',
        phoneMfaLinked: false, // Mandatory Phone MFA is required!
        idToken: `mock-jwt-token-${Date.now()}`
      };
      this.registeredUsersSignal.update(users => [...users, user!]);
      this.persistRegisteredUsers();
    }

    this.persistSession(user);
    return user;
  }

  public async signInWithEmail(email: string, _password: string): Promise<FirebaseUser> {
    let user = this.registeredUsersSignal().find(u => u.email === email);
    if (!user) {
      user = {
        uid: `email-user-${Math.random().toString(36).slice(2, 7)}`,
        email,
        displayName: email.split('@')[0],
        providerId: 'password',
        phoneMfaLinked: false, // Mandatory Phone MFA is required!
        idToken: `mock-jwt-token-${Date.now()}`
      };
      this.registeredUsersSignal.update(users => [...users, user!]);
      this.persistRegisteredUsers();
    }

    this.persistSession(user);
    return user;
  }

  public async registerWithEmail(email: string, _password: string, name: string): Promise<FirebaseUser> {
    const user: FirebaseUser = {
      uid: `email-user-${Math.random().toString(36).slice(2, 7)}`,
      email,
      displayName: name,
      providerId: 'password',
      phoneMfaLinked: false, // Mandatory Phone MFA is required!
      idToken: `mock-jwt-token-${Date.now()}`
    };

    this.registeredUsersSignal.update(users => [...users, user]);
    this.persistRegisteredUsers();
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

    // Update in registered users directory
    this.registeredUsersSignal.update(users =>
      users.map(u => (u.uid === updatedUser.uid || u.email === updatedUser.email ? updatedUser : u))
    );
    this.persistRegisteredUsers();

    this.persistSession(updatedUser);
    return updatedUser;
  }

  public switchUser(userOrUid: FirebaseUser | string): void {
    if (typeof userOrUid === 'string') {
      const user = this.registeredUsersSignal().find(u => u.uid === userOrUid);
      if (user) {
        this.persistSession(user);
      }
    } else {
      this.persistSession(userOrUid);
    }
  }

  public signOut(): void {
    this.persistSession(null);
  }
}
