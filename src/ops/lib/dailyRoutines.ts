export type DailyRoutineOverviewView = 'widgets' | 'list';

export type DailyRoutineOverviewFilter =
  | 'all'
  | 'with-tasks'
  | 'done'
  | 'in-progress'
  | 'pending'
  | 'blocked'
  | 'handovers'
  | 'overdue';

export type DailyRoutineUserStats = {
  name: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  handoversAsTo: number;
  handoversAsFrom: number;
  totalHandovers: number;
  completionRate: number;
};

export function matchesDailyRoutineFilter(stats: DailyRoutineUserStats, filter: DailyRoutineOverviewFilter): boolean {
  switch (filter) {
    case 'with-tasks':
      return stats.totalTasks > 0;
    case 'done':
      return stats.doneTasks > 0;
    case 'in-progress':
      return stats.inProgressTasks > 0;
    case 'pending':
      return stats.pendingTasks > 0;
    case 'blocked':
      return stats.blockedTasks > 0;
    case 'handovers':
      return stats.totalHandovers > 0;
    case 'overdue':
      return stats.overdueTasks > 0;
    case 'all':
    default:
      return true;
  }
}

export function filterDailyRoutineStats(
  stats: DailyRoutineUserStats[],
  query: string,
  filter: DailyRoutineOverviewFilter,
): DailyRoutineUserStats[] {
  const normalizedQuery = query.trim().toLowerCase();

  return stats
    .filter((row) => matchesDailyRoutineFilter(row, filter))
    .filter((row) => !normalizedQuery || row.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => b.totalTasks - a.totalTasks || b.totalHandovers - a.totalHandovers || a.name.localeCompare(b.name));
}
