export type OpsRole = 'master' | 'operations' | 'community';

export type OpsUserStatus = 'active' | 'suspended';

export type OpsOffice = 'Egypt' | 'KSA' | 'UAE' | 'Kuwait';

export const OPS_OFFICES: OpsOffice[] = ['Egypt', 'KSA', 'UAE', 'Kuwait'];

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
  office: OpsOffice;
  department: OpsDepartment;
  title: string;
  timezone: string;
  createdAt?: string | null;
  lastSignInAt?: string | null;
};

export function isOpsRole(value: unknown): value is OpsRole {
  return value === 'master' || value === 'operations' || value === 'community';
}

export function isOpsOffice(value: unknown): value is OpsOffice {
  return OPS_OFFICES.includes(value as OpsOffice);
}

export function getRoleFromMetadata(value: unknown): OpsRole {
  return isOpsRole(value) ? value : 'operations';
}

const OFFICE_ALIASES: Record<string, OpsOffice> = {
  egypt: 'Egypt',
  eg: 'Egypt',
  cairo: 'Egypt',
  'cairo-hq': 'Egypt',
  ksa: 'KSA',
  saudi: 'KSA',
  'saudi-arabia': 'KSA',
  riyadh: 'KSA',
  jeddah: 'KSA',
  uae: 'UAE',
  'united-arab-emirates': 'UAE',
  dubai: 'UAE',
  'abu-dhabi': 'UAE',
  kuwait: 'Kuwait',
  kw: 'Kuwait',
};

const UAE_COMMUNITY_NAMES = ['abdulrahman', 'khalid', 'nurhan'];

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

export function normalizeMetadataText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveOfficeFromMetadata(value: unknown): OpsOffice | undefined {
  if (isOpsOffice(value)) return value;
  return OFFICE_ALIASES[normalizeMetadataText(value)];
}

export function getOfficeFromMetadata(value: unknown): OpsOffice {
  return resolveOfficeFromMetadata(value) || 'Egypt';
}

export function getOfficeFromProfile(input: { name?: unknown; role?: unknown; office?: unknown }): OpsOffice {
  const explicitOffice = resolveOfficeFromMetadata(input.office);
  if (explicitOffice) return explicitOffice;

  const normalizedName = normalizeMetadataText(input.name);
  if (UAE_COMMUNITY_NAMES.some((name) => normalizedName.includes(name))) return 'UAE';
  if (input.role === 'community') return 'KSA';
  return 'Egypt';
}

export function getDepartmentFromMetadata(value: unknown): OpsDepartment {
  if (DEPARTMENTS.includes(value as OpsDepartment)) return value as OpsDepartment;
  return DEPARTMENT_ALIASES[normalizeMetadataText(value)] || 'Operations';
}
