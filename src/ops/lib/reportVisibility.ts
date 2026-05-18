import type { OpsUser } from '../auth/types';

export const REPORT_HIDDEN_USER_NAMES = ['Adel Hammad'];
const REPORT_HIDDEN_IDENTIFIERS = new Set([
  ...REPORT_HIDDEN_USER_NAMES,
  'adel@grand-community.com',
].map(normalizeReportIdentity));

export function normalizeReportIdentity(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

export function isVisibleInReports(value: string | undefined | null) {
  const normalized = normalizeReportIdentity(value);
  return !normalized || !REPORT_HIDDEN_IDENTIFIERS.has(normalized);
}

export function isReportVisibleUser(user: Pick<OpsUser, 'displayName' | 'email'> | { name?: string; email?: string }) {
  const displayName = 'displayName' in user ? user.displayName : user.name;
  return isVisibleInReports(displayName) && isVisibleInReports(user.email);
}
