import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { mfaGuard } from './mfa.guard';
import { FirebaseAuthService } from '../services/firebase-auth.service';

describe('mfaGuard', () => {
  let authService: FirebaseAuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FirebaseAuthService,
        {
          provide: Router,
          useValue: {
            parseUrl: (url: string) => ({ url } as unknown as UrlTree)
          }
        }
      ]
    });

    authService = TestBed.inject(FirebaseAuthService);
    router = TestBed.inject(Router);
    authService.signOut();
  });

  it('should redirect unauthenticated users to /login', () => {
    const result = TestBed.runInInjectionContext(() =>
      mfaGuard({} as any, {} as any)
    );
    expect((result as any).url).toBe('/login');
  });

  it('should redirect authenticated users without phone MFA to /link-phone', async () => {
    await authService.signInWithGoogle();
    const result = TestBed.runInInjectionContext(() =>
      mfaGuard({} as any, {} as any)
    );
    expect((result as any).url).toBe('/link-phone');
  });

  it('should allow access to users with verified phone MFA', async () => {
    await authService.signInWithGoogle();
    const { confirmationId } = await authService.sendPhoneVerificationCode('+15551112233');
    await authService.linkPhoneMfa(confirmationId, '123456');

    const result = TestBed.runInInjectionContext(() =>
      mfaGuard({} as any, {} as any)
    );
    expect(result).toBe(true);
  });
});
