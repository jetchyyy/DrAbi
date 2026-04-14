import type { Role } from '../types/domain';

export function getHomePathForRole(role?: Role | null) {
  switch (role) {
    case 'patient':
      return '/portal/book';
    case 'specialist':
      return '/specialist/referrals';
    default:
      return '/app/dashboard';
  }
}

export function getLoginPathForPathname(pathname: string) {
  void pathname;
  return '/login';
}
