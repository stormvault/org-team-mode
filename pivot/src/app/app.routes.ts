import { Routes } from '@angular/router';
import { mfaGuard } from './guards/mfa.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./app').then(m => m.App),
    canActivate: [mfaGuard]
  },
  {
    path: 'link-phone',
    loadComponent: () => import('./app').then(m => m.App)
  },
  {
    path: 'login',
    loadComponent: () => import('./app').then(m => m.App)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
