import { describe, expect, it } from 'vitest';
import { mergeWorkspaceRecordsById, parseWorkspaceRecordPayload } from './workspaceRecordMerge';

describe('workspace record merge', () => {
  it('preserves cloud records missing from a stale local snapshot', () => {
    const merged = mergeWorkspaceRecordsById(
      [{ id: 'cloud-only', title: 'Already in Supabase', updatedAt: 10 }],
      [{ id: 'local-new', title: 'Saved from this browser', updatedAt: 20 }],
    );

    expect(merged.map((item) => item.id).sort()).toEqual(['cloud-only', 'local-new']);
  });

  it('keeps the newest version when the same record is present on both sides', () => {
    const merged = mergeWorkspaceRecordsById(
      [{ id: 'task-1', title: 'Remote update', updatedAt: 50 }],
      [{ id: 'task-1', title: 'Stale local copy', updatedAt: 10 }],
    );

    expect(merged).toEqual([{ id: 'task-1', title: 'Remote update', updatedAt: 50 }]);
  });

  it('can remove an explicitly deleted id without dropping other remote records', () => {
    const merged = mergeWorkspaceRecordsById(
      [
        { id: 'keep-cloud', title: 'Remote task', updatedAt: 10 },
        { id: 'delete-me', title: 'Deleted task', updatedAt: 30 },
      ],
      [{ id: 'local-only', title: 'Local task', updatedAt: 20 }],
      ['delete-me'],
    );

    expect(merged.map((item) => item.id).sort()).toEqual(['keep-cloud', 'local-only']);
  });

  it('accepts only array payloads from workspace records', () => {
    expect(parseWorkspaceRecordPayload({ id: 'not-an-array' })).toEqual([]);
    expect(parseWorkspaceRecordPayload([{ id: 'task-1' }])).toEqual([{ id: 'task-1' }]);
  });
});
