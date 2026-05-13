import { describe, expect, it } from 'vitest';
import csvRaw from '../data/community-done-tasks.csv?raw';
import workspaceExport from '../data/attached-workspace-export.json';
import {
  buildImportedCompletedTasks,
  deriveUsersFromCompletedTasks,
  extractUsersFromWorkspaceExport,
  parseCompletedTasksCsv,
} from './importedWorkspaceData';

describe('attached workspace imports', () => {
  it('detects that the attached JSON export does not contain users', () => {
    expect(extractUsersFromWorkspaceExport(workspaceExport)).toEqual([]);
  });

  it('derives user names from the completed-task CSV when JSON users are absent', () => {
    const rows = parseCompletedTasksCsv(csvRaw);
    const users = deriveUsersFromCompletedTasks(rows);

    expect(users).toContain('Aljazi');
    expect(users).toContain('Ahmed Elmahdi');
    expect(users).toContain('Sara Alkharashi');
    expect(users.length).toBeGreaterThan(10);
  });

  it('expands completed CSV rows into owner-specific completed tasks', () => {
    const rows = parseCompletedTasksCsv(csvRaw);
    const tasks = buildImportedCompletedTasks(rows);

    expect(tasks.length).toBeGreaterThan(rows.length);
    expect(tasks.every((task) => task.completed)).toBe(true);
    expect(tasks.some((task) => task.ownerId === 'Aljazi' && task.campaignId.toLowerCase().includes('advanced'))).toBe(true);
    expect(tasks.every((task) => task.completedAt && task.completedAt <= task.updatedAt)).toBe(true);
  });
});
