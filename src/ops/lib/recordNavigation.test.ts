import { describe, expect, it } from 'vitest';
import { clearRecordParam } from './recordNavigation';

describe('record navigation params', () => {
  it('removes the direct record param after closing an editor', () => {
    const params = clearRecordParam(new URLSearchParams('task=TSK-1&view=list&bucket=blocked'), 'task');

    expect(params.toString()).toBe('view=list&bucket=blocked');
  });

  it('returns empty params when only the direct record was present', () => {
    const params = clearRecordParam(new URLSearchParams('handover=HO-1'), 'handover');

    expect(params.toString()).toBe('');
  });
});
