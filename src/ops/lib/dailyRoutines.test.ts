import { describe, expect, it } from 'vitest';
import { filterDailyRoutineStats, type DailyRoutineUserStats } from './dailyRoutines';

const rows: DailyRoutineUserStats[] = [
  {
    name: 'Nour Zein',
    totalTasks: 6,
    doneTasks: 4,
    inProgressTasks: 1,
    pendingTasks: 1,
    blockedTasks: 0,
    overdueTasks: 0,
    handoversAsTo: 2,
    handoversAsFrom: 1,
    totalHandovers: 3,
    completionRate: 67,
  },
  {
    name: 'Ahmed Maher',
    totalTasks: 3,
    doneTasks: 0,
    inProgressTasks: 1,
    pendingTasks: 0,
    blockedTasks: 2,
    overdueTasks: 1,
    handoversAsTo: 0,
    handoversAsFrom: 0,
    totalHandovers: 0,
    completionRate: 0,
  },
  {
    name: 'Lamia',
    totalTasks: 0,
    doneTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    blockedTasks: 0,
    overdueTasks: 0,
    handoversAsTo: 0,
    handoversAsFrom: 1,
    totalHandovers: 1,
    completionRate: 0,
  },
];

describe('daily routine overview filters', () => {
  it('filters people by operational status without losing the default task-volume sort', () => {
    expect(filterDailyRoutineStats(rows, '', 'blocked').map((row) => row.name)).toEqual(['Ahmed Maher']);
    expect(filterDailyRoutineStats(rows, '', 'handovers').map((row) => row.name)).toEqual(['Nour Zein', 'Lamia']);
    expect(filterDailyRoutineStats(rows, '', 'with-tasks').map((row) => row.name)).toEqual(['Nour Zein', 'Ahmed Maher']);
  });

  it('combines search text with the selected status filter', () => {
    expect(filterDailyRoutineStats(rows, 'ahmed', 'blocked').map((row) => row.name)).toEqual(['Ahmed Maher']);
    expect(filterDailyRoutineStats(rows, 'lam', 'with-tasks')).toEqual([]);
  });
});
