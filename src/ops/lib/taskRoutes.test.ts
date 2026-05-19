import { describe, expect, it } from 'vitest';
import {
  LEGACY_TASK_PATHS,
  TASK_MANAGER_LABEL,
  TASK_MANAGER_PATH,
  getLegacyTaskRedirectPath,
  getTaskBucketPath,
  getTaskManagerPath,
  getTaskRecordPath,
  getUserTaskManagerPath,
} from './taskRoutes';

describe('task route consolidation', () => {
  it('uses Tasks Manager as the single canonical task entry point', () => {
    expect(TASK_MANAGER_LABEL).toBe('Tasks Manager');
    expect(TASK_MANAGER_PATH).toBe('/tasks');
    expect(getTaskManagerPath()).toBe('/tasks');
  });

  it('redirects old task surfaces into the Tasks Manager page', () => {
    expect(LEGACY_TASK_PATHS).toEqual(['/tasks-daily-routines', '/daily-routines', '/my-dashboard', '/priority-board']);
    expect(getLegacyTaskRedirectPath('/tasks-daily-routines')).toBe('/tasks');
    expect(getLegacyTaskRedirectPath('/daily-routines')).toBe('/tasks');
    expect(getLegacyTaskRedirectPath('/my-dashboard')).toBe('/tasks');
    expect(getLegacyTaskRedirectPath('/priority-board')).toBe('/tasks');
  });

  it('keeps task buckets and record links under the canonical page', () => {
    expect(getTaskBucketPath('done')).toBe('/tasks/done');
    expect(getTaskRecordPath('daily-task-1')).toBe('/tasks?task=daily-task-1');
    expect(getUserTaskManagerPath('Mona Essam')).toBe('/tasks?user=Mona+Essam');
  });
});
