export const TASK_MANAGER_PATH = '/tasks';
export const TASK_MANAGER_LABEL = 'Tasks Manager';
export const LEGACY_TASK_PATHS = ['/tasks-daily-routines', '/daily-routines', '/my-dashboard', '/priority-board'] as const;

export type LegacyTaskPath = typeof LEGACY_TASK_PATHS[number];

export function getTaskManagerPath() {
  return TASK_MANAGER_PATH;
}

export function getTaskBucketPath(bucket: string) {
  return `${TASK_MANAGER_PATH}/${encodeURIComponent(bucket)}`;
}

export function getTaskRecordPath(taskId: string) {
  const params = new URLSearchParams({ task: taskId });
  return `${TASK_MANAGER_PATH}?${params.toString()}`;
}

export function getUserTaskManagerPath(userName: string) {
  const params = new URLSearchParams({ user: userName });
  return `${TASK_MANAGER_PATH}?${params.toString()}`;
}

export function getLegacyTaskRedirectPath(_path: LegacyTaskPath) {
  return TASK_MANAGER_PATH;
}
