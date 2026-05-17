import { describe, expect, it } from 'vitest';
import { canAccessPath, getHomePath, getRoleLabel } from './access';

describe('ops access rules', () => {
  it('lets signed-in users reach their profile page', () => {
    expect(canAccessPath('master', '/profile')).toBe(true);
    expect(canAccessPath('operations', '/profile')).toBe(true);
    expect(canAccessPath('community', '/profile')).toBe(true);
  });

  it('lets signed-in users open the live online roster from dashboard widgets', () => {
    expect(canAccessPath('master', '/online-users')).toBe(true);
    expect(canAccessPath('operations', '/online-users')).toBe(true);
    expect(canAccessPath('community', '/online-users')).toBe(true);
  });

  it('lets signed-in users open live report pages', () => {
    expect(canAccessPath('master', '/system-live-report')).toBe(true);
    expect(canAccessPath('operations', '/system-live-report')).toBe(true);
    expect(canAccessPath('community', '/system-live-report')).toBe(true);
    expect(canAccessPath('master', '/dropbox-live-report')).toBe(true);
    expect(canAccessPath('operations', '/dropbox-live-report')).toBe(true);
    expect(canAccessPath('community', '/dropbox-live-report')).toBe(true);
  });

  it('keeps system administration master-only', () => {
    expect(canAccessPath('master', '/admin')).toBe(true);
    expect(canAccessPath('operations', '/admin')).toBe(false);
    expect(canAccessPath('community', '/settings')).toBe(false);
  });

  it('uses a stable home and readable labels for all auth roles', () => {
    expect(getHomePath('operations')).toBe('/');
    expect(getRoleLabel('master')).toBe('Master');
    expect(getRoleLabel('operations')).toBe('Operations');
    expect(getRoleLabel('community')).toBe('Community');
  });
});
