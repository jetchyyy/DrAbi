import type { Role } from '../types/domain';

export function getHomePathForRole(role?: Role | null) {
  switch (role) {
    case 'patient':
      return '/portal';
    case 'specialist':
      return '/specialist/profile';
    default:
      return '/app/profile';
  }
}

export function getLoginPathForPathname(pathname: string) {
  void pathname;
  return '/login';
}
