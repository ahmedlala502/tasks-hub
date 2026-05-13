export type OpsRole = 'master' | 'operations' | 'community';

export type OpsUserStatus = 'active' | 'suspended';

export type OpsDepartment =
  | 'Operations'
  | 'Onboarding'
  | 'WhatsApp / Live Chat'
  | 'Coverage & Monitoring'
  | 'Coordination'
  | 'Quality & Training'
  | 'Systems & Automation'
  | 'Activation'
  | 'Account Managers'
  | 'Data Analysis';

export type OpsUser = {
  uid: string;
  email: string;
  displayName: string;
  role: OpsRole;
  status: OpsUserStatus;
  department: OpsDepartment;
  title: string;
  timezone: string;
  createdAt?: string | null;
  lastSignInAt?: string | null;
};

export function isOpsRole(value: unknown): value is OpsRole {
  return value === 'master' || value === 'operations' || value === 'community';
}

export function getRoleFromMetadata(value: unknown): OpsRole {
  return isOpsRole(value) ? value : 'operations';
}

const DEPARTMENTS: OpsDepartment[] = [
  'Operations',
  'Onboarding',
  'WhatsApp / Live Chat',
  'Coverage & Monitoring',
  'Coordination',
  'Quality & Training',
  'Systems & Automation',
  'Activation',
  'Account Managers',
  'Data Analysis',
];

const DEPARTMENT_ALIASES: Record<string, OpsDepartment> = {
  operations: 'Operations',
  onboarding: 'Onboarding',
  whatsapp: 'WhatsApp / Live Chat',
  'whatsapp-live-chat': 'WhatsApp / Live Chat',
  'live-chat': 'WhatsApp / Live Chat',
  coverage: 'Coverage & Monitoring',
  monitoring: 'Coverage & Monitoring',
  'coverage-monitoring': 'Coverage & Monitoring',
  coordination: 'Coordination',
  quality: 'Quality & Training',
  training: 'Quality & Training',
  systems: 'Systems & Automation',
  automation: 'Systems & Automation',
  activation: 'Activation',
  accounts: 'Account Managers',
  'account-managers': 'Account Managers',
  data: 'Data Analysis',
  analytics: 'Data Analysis',
  'data-analysis': 'Data Analysis',
};

function normalizeMetadataText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getDepartmentFromMetadata(value: unknown): OpsDepartment {
  if (DEPARTMENTS.includes(value as OpsDepartment)) return value as OpsDepartment;
  return DEPARTMENT_ALIASES[normalizeMetadataText(value)] || 'Operations';
}
