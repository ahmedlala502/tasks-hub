import type { OpsRole } from '../auth/types';

const OPERATIONS_PATHS = new Set([
  '/',
  '/profile',
  '/handover',
  '/tasks',
  '/priority-board',
  '/blockers',
  '/analytics',
  '/assets',
  '/reporting',
  '/templates',
]);
const MASTER_ONLY_PATHS = new Set(['/audit', '/settings', '/admin']);

export function canAccessOperations(role: OpsRole | null): boolean {
  return role === 'master' || role === 'operations';
}

export function canAccessCommunity(role: OpsRole | null): boolean {
  return role === 'master' || role === 'community';
}

export function canAccessAdmin(role: OpsRole | null): boolean {
  return role === 'master';
}

export function canAccessPath(role: OpsRole | null, pathname: string): boolean {
  if (!role) return false;
  if (MASTER_ONLY_PATHS.has(pathname)) return canAccessAdmin(role);
  if (OPERATIONS_PATHS.has(pathname)) return role === 'master' || role === 'operations' || role === 'community';
  return false;
}

export function getHomePath(role: OpsRole | null): string {
  return '/';
}

export function getRoleLabel(role: OpsRole | null): string {
  if (role === 'master') return 'Master';
  if (role === 'community') return 'Community';
  if (role === 'operations') return 'Operations';
  return 'Workspace';
}
