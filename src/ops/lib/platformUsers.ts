import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { adminApi } from '../services/adminApi';

const NON_PERSON_LABELS = new Set([
  'campaign manager',
  'community lead',
  'coordination lead',
  'coverage lead',
  'qa lead',
  'finance lead',
  'head of operations',
  'master admin',
  'ops team',
  'regional lead',
  'team lead',
]);

const HIDDEN_TEST_ACCOUNT_KEYS = new Set([
  'abdelfatah',
  'abdelfattah',
]);

const normalizeNameKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const compactNameKey = (value: string) => normalizeNameKey(value).replace(/[^a-z0-9]+/g, '');

export function isDisplayablePersonName(value: string | undefined | null) {
  const clean = value?.trim();
  if (!clean) return false;
  const key = normalizeNameKey(clean);
  if (NON_PERSON_LABELS.has(key)) return false;
  if (HIDDEN_TEST_ACCOUNT_KEYS.has(compactNameKey(clean))) return false;
  return true;
}

function addUserName(names: Map<string, string>, value: string | undefined | null) {
  const clean = value?.trim();
  if (!clean) return;
  if (!isDisplayablePersonName(clean)) return;
  const key = normalizeNameKey(clean);
  if (!names.has(key)) names.set(key, clean);
}

export function sortUniqueUserNames(values: Array<string | undefined | null>) {
  const names = new Map<string, string>();
  values.forEach((value) => addUserName(names, value));
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function getDefaultPlatformUserNames() {
  return sortUniqueUserNames(DEFAULT_ACCESS_USERS.map((user) => user.name));
}

export async function loadPlatformUserNames(includeInactive = false) {
  const [apiUsers, defaultNames] = await Promise.all([
    adminApi.listUsers(),
    Promise.resolve(getDefaultPlatformUserNames()),
  ]);
  const apiNames = apiUsers
    .filter((user) => includeInactive || user.status === 'active')
    .map((user) => user.displayName);
  return sortUniqueUserNames([...defaultNames, ...apiNames]);
}
