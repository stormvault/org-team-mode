import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FirebaseAuthService } from '../services/firebase-auth.service';

export const mfaGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(FirebaseAuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (!user) {
    return router.parseUrl('/login');
  }

  if (!user.phoneMfaLinked) {
    // Incomplete MFA: Redirect registered user to account linking registration view
    return router.parseUrl('/link-phone');
  }

  return true;
};
