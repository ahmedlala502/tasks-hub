import { describe, expect, it } from 'vitest';
import { getDepartmentFromMetadata, getOfficeFromMetadata, getOfficeFromProfile, getRoleFromMetadata, OPS_OFFICES } from './types';

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

  it('keeps office assignment mandatory and limited to the four operating offices', () => {
    expect(OPS_OFFICES).toEqual(['Egypt', 'KSA', 'UAE', 'Kuwait']);
    expect(getOfficeFromMetadata('Cairo HQ')).toBe('Egypt');
    expect(getOfficeFromMetadata('saudi-arabia')).toBe('KSA');
    expect(getOfficeFromMetadata('Dubai')).toBe('UAE');
    expect(getOfficeFromMetadata('KW')).toBe('Kuwait');
    expect(getOfficeFromMetadata('unknown')).toBe('Egypt');
  });

  it('infers missing offices from role and the UAE community exceptions', () => {
    expect(getOfficeFromProfile({ name: 'Abdulrahman', role: 'community' })).toBe('UAE');
    expect(getOfficeFromProfile({ name: 'Khalid', role: 'community' })).toBe('UAE');
    expect(getOfficeFromProfile({ name: 'Nurhan', role: 'community' })).toBe('UAE');
    expect(getOfficeFromProfile({ name: 'Shahd', role: 'community' })).toBe('KSA');
    expect(getOfficeFromProfile({ name: 'Nada', role: 'operations' })).toBe('Egypt');
    expect(getOfficeFromProfile({ name: 'Anyone', role: 'community', office: 'Kuwait' })).toBe('Kuwait');
  });
});
