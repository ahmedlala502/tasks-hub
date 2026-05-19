import { describe, expect, it } from 'vitest';
import { normalizeDashboardName } from './dashboardView';

describe('dashboard view helpers', () => {
  it('normalizes valid employee names', () => {
    expect(normalizeDashboardName('  Shahd   KSA  ')).toBe('Shahd KSA');
  });

  it('falls back when recovered task data is missing an owner name', () => {
    expect(normalizeDashboardName(undefined)).toBe('Unassigned');
    expect(normalizeDashboardName(null)).toBe('Unassigned');
    expect(normalizeDashboardName('   ')).toBe('Unassigned');
  });
});
