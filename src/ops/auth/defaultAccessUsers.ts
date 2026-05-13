import type { OpsDepartment, OpsOffice, OpsRole } from './types';

export const DEFAULT_ACCESS_PASSWORD = 'Admin123';

export type DefaultAccessUser = {
  name: string;
  email: string;
  role: OpsRole;
  office: OpsOffice;
  department: OpsDepartment;
  title: string;
};

export const DEFAULT_ACCESS_USERS: DefaultAccessUser[] = [
  { name: 'shouq_ksa', email: 'shouq_ksa@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'sara_ksa', email: 'sara_ksa@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'aljazi_ksa', email: 'aljazi_ksa@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'Lamia', email: 'lamiaa@trygc.com', role: 'master', office: 'Egypt', department: 'Operations', title: 'Master Admin' },
  { name: 'M.Tarek', email: 'm.tarek@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'Ahmed Mahdi', email: 'mahdi@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'Adel Hammad', email: 'adel@grand-community.com', role: 'master', office: 'Egypt', department: 'Operations', title: 'Master Admin' },
  { name: 'Sabry', email: 'sabry@trygc.com', role: 'master', office: 'Egypt', department: 'Operations', title: 'Master Admin' },
  { name: 'Ismail', email: 'a.ismail@trygc.com', role: 'master', office: 'Egypt', department: 'Operations', title: 'Master Admin' },
  { name: 'Shahd', email: 'shahd@trygc.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community Access' },
  { name: 'Nada Seliman', email: 'nada@trygc.com', role: 'operations', office: 'Egypt', department: 'Operations', title: 'Operations Access' },
  { name: 'Atia', email: 'm.atia@trygc.com', role: 'operations', office: 'Egypt', department: 'Operations', title: 'Operations Access' },
  { name: 'admin', email: 'admin@trygc.com', role: 'master', office: 'Egypt', department: 'Operations', title: 'Master Admin' },
];
