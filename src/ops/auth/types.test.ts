import { describe, expect, it } from 'vitest';
import { getDepartmentFromMetadata, getRoleFromMetadata } from './types';

describe('ops auth metadata', () => {
  it('keeps authorization roles constrained to supported app roles', () => {
    expect(getRoleFromMetadata('master')).toBe('master');
    expect(getRoleFromMetadata('operations')).toBe('operations');
    expect(getRoleFromMetadata('community')).toBe('community');
    expect(getRoleFromMetadata('admin')).toBe('operations');
  });

  it('normalizes profile department names for user profiles and assignments', () => {
    expect(getDepartmentFromMetadata('Coverage & Monitoring')).toBe('Coverage & Monitoring');
    expect(getDepartmentFromMetadata('whatsapp')).toBe('WhatsApp / Live Chat');
    expect(getDepartmentFromMetadata('unknown')).toBe('Operations');
  });
});
