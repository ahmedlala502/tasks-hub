import { Status, Priority, Shift, Task, Handover, Office, User, Member, HandoverTemplate } from './types';

export const COUNTRY_FLAGS: Record<string, string> = {
  'KSA': '🇸🇦',
  'UAE': '🇦🇪',
  'KW': '🇰🇼',
  'EG': '🇪🇬',
  'BH': '🇧🇭',
  'QA': '🇶🇦',
  'OM': '🇴🇲',
};

export const DEFAULT_MASTER_ADMIN_EMAIL = import.meta.env.VITE_MASTER_ADMIN_EMAIL || 'admin@trygc.com';
export const MASTER_ADMIN_EMAIL = DEFAULT_MASTER_ADMIN_EMAIL;
export const MASTER_ADMIN_PASSWORD = '';
export const SUPER_ADMIN_PASSWORD = '';

export const APP_VERSION = '2.0.0';
export const APP_NAME = 'TryGC Hub Manager';

export const INITIAL_USER: User = {
  name: 'System Administrator',
  role: 'Super Admin',
  office: 'Cairo HQ',
  country: 'EG',
  email: MASTER_ADMIN_EMAIL,
  password: MASTER_ADMIN_PASSWORD,
  isSuperAdmin: true,
};

export const TEAMS: string[] = [
  'Operations Team',
  'Community Team',
];

export const OFFICES: Office[] = [
  {
    id: 'office-egypt',
    name: 'Egypt',
    country: 'EG',
    lead: 'Operations Lead',
    shift: Shift.MORNING,
    timezone: 'Africa/Cairo',
  },
  {
    id: 'office-ksa',
    name: 'KSA',
    country: 'KSA',
    lead: 'Community Lead',
    shift: Shift.MORNING,
    timezone: 'Asia/Riyadh',
  },
  {
    id: 'office-uae',
    name: 'UAE',
    country: 'UAE',
    lead: 'Community Lead',
    shift: Shift.MORNING,
    timezone: 'Asia/Dubai',
  },
  {
    id: 'office-kuwait',
    name: 'Kuwait',
    country: 'KW',
    lead: 'Operations Lead',
    shift: Shift.MORNING,
    timezone: 'Asia/Kuwait',
  },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'member-abdulrahman',
    name: 'Abdulrahman',
    team: 'Community Team',
    office: 'UAE',
    country: 'UAE',
    role: 'Community',
    tasksCompleted: 0,
    handoversOut: 0,
    onTime: 100,
    status: 'active',
  },
  {
    id: 'member-khalid',
    name: 'Khalid',
    team: 'Community Team',
    office: 'UAE',
    country: 'UAE',
    role: 'Community',
    tasksCompleted: 0,
    handoversOut: 0,
    onTime: 100,
    status: 'active',
  },
  {
    id: 'member-nurhan',
    name: 'Nurhan',
    team: 'Community Team',
    office: 'UAE',
    country: 'UAE',
    role: 'Community',
    tasksCompleted: 0,
    handoversOut: 0,
    onTime: 100,
    status: 'active',
  },
];

export const INITIAL_TASKS: Task[] = [];


export const INITIAL_HANDOVERS: Handover[] = [];


export const HANDOVER_TEMPLATES: HandoverTemplate[] = [
  {
    id: 'tpl-morning-mid',
    name: 'Morning → Mid Standard',
    description: 'Standard handover template for morning to mid shift transition',
    team: 'Operations Team',
    fromShift: Shift.MORNING,
    toShift: Shift.MID,
    defaultWatchouts: '1. Review all carry-over items from morning shift\n2. Check SLA compliance for active campaigns\n3. Verify all blocked items have escalation paths\n4. Confirm next shift lead availability',
    createdBy: 'system',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
  },
  {
    id: 'tpl-mid-night',
    name: 'Mid → Night Handover',
    description: 'Critical handover template for mid to night shift with emphasis on APAC clients',
    team: 'Operations Team',
    fromShift: Shift.MID,
    toShift: Shift.NIGHT,
    defaultWatchouts: '1. Flag all APAC client deliverables\n2. Ensure coverage reports are generated\n3. Check influencer posting schedules\n4. Verify emergency contact availability',
    createdBy: 'system',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
  },
];
