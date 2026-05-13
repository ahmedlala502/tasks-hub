import { describe, expect, it } from 'vitest';
import { canAccessPath, getHomePath, getRoleLabel } from './access';

describe('ops access rules', () => {
  it('lets signed-in users reach their profile page', () => {
    expect(canAccessPath('master', '/profile')).toBe(true);
    expect(canAccessPath('operations', '/profile')).toBe(true);
    expect(canAccessPath('community', '/profile')).toBe(true);
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
