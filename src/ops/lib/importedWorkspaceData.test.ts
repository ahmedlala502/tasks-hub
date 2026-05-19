import { describe, expect, it } from 'vitest';
import workspaceExport from '../data/attached-workspace-export.json';
import {
  buildImportedCompletedTasks,
  deriveUsersFromCompletedTasks,
  extractUsersFromWorkspaceExport,
  parseCompletedTasksCsv,
} from './importedWorkspaceData';

const MOCK_CSV = [
  '✅  COMPLETED TASKS  |  3 Tasks Done,,,,,,',
  'TASK DESCRIPTION,CAMPAIGN NAME,PRIORITY,NAME,STATUS,DEADLINE,NOTE',
  'Follow up confirmations,Advanced KSA,High,"Aljazi, Ahmed Elmahdi",Done,09:00,',
  'Send coverage report,Launch UAE,Medium,Sara Alkharashi,Done,10:30,',
  'Confirm influencer list,Advanced KSA,Critical,Ahmed Elmahdi,Done,,Good work',
].join('\n');

describe('attached workspace imports', () => {
  it('detects that the attached JSON export does not contain users', () => {
    expect(extractUsersFromWorkspaceExport(workspaceExport)).toEqual([]);
  });

  it('derives user names from the completed-task CSV when JSON users are absent', () => {
    const rows = parseCompletedTasksCsv(MOCK_CSV);
    const users = deriveUsersFromCompletedTasks(rows);

    expect(users).toContain('Aljazi');
    expect(users).toContain('Ahmed Elmahdi');
    expect(users).toContain('Sara Alkharashi');
    expect(users.length).toBeGreaterThan(2);
  });

  it('expands completed CSV rows into owner-specific completed tasks', () => {
    const rows = parseCompletedTasksCsv(MOCK_CSV);
    const tasks = buildImportedCompletedTasks(rows);

    expect(tasks.length).toBeGreaterThan(rows.length);
    expect(tasks.every((task) => task.completed)).toBe(true);
    expect(tasks.some((task) => task.ownerId === 'Aljazi' && task.campaignId.toLowerCase().includes('advanced'))).toBe(true);
    expect(tasks.every((task) => task.completedAt && task.completedAt <= task.updatedAt)).toBe(true);
  });
});
