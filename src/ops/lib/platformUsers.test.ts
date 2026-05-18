import { describe, expect, it } from 'vitest';
import { isDisplayablePersonName, sortUniqueUserNames } from './platformUsers';

describe('platform user names', () => {
  it('removes role labels and IT test accounts from people pickers', () => {
    expect(sortUniqueUserNames([
      'Community Lead',
      'Coordination Lead',
      'Abdelfatah',
      'Abdel Fattah',
      'Nada Seliman',
      'nada seliman',
    ])).toEqual(['Nada Seliman']);
  });

  it('exposes the same person-name guard for task and handover derived names', () => {
    expect(isDisplayablePersonName('Community Lead')).toBe(false);
    expect(isDisplayablePersonName('Abdelfatah')).toBe(false);
    expect(isDisplayablePersonName('Nada Seliman')).toBe(true);
  });
});
