export function normalizeDashboardName(name: unknown, fallback = 'Unassigned'): string {
  const value = typeof name === 'string' ? name : '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || fallback;
}
