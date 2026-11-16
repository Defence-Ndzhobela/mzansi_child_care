import { UserRole } from '../types';

// Where each role lands after signing in, and the API path that confirms the role on the server.
export function dashboardPathFor(role: UserRole | undefined): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'SOCIAL_WORKER') return '/social-worker/dashboard';
  return '/parent/dashboard';
}

export function roleCheckPathFor(role: UserRole): string {
  if (role === 'ADMIN') return '/admin/me';
  if (role === 'SOCIAL_WORKER') return '/social-worker/me';
  return '/parent/me';
}
