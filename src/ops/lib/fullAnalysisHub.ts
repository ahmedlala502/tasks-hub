import type { OpsOffice } from '../auth/types';
import type { Blocker, Campaign, Handover, Task } from '../types';
import { OFFICES, TEAMS } from '../../constants';
import { buildOfficeInsights, type OfficeUser } from './officeInsights';

export type AnalysisPillarKey =
  | 'employees'
  | 'tasks'
  | 'campaigns'
  | 'handovers'
  | 'blockers'
  | 'sla'
  | 'teams'
  | 'offices';

export type AnalysisFilters = {
  pillar: AnalysisPillarKey;
  employee: string;
  team: string;
  office: 'all' | OpsOffice;
  campaign: string;
  status: string;
  priority: string;
  search: string;
};

export type AnalysisDataRow = Record<string, string | number>;

export type AnalysisReport = {
  key: AnalysisPillarKey;
  label: string;
  description: string;
  value: string;
  insight: string;
  rows: AnalysisDataRow[];
  filteredRows: AnalysisDataRow[];
};

export type AnalysisOptions = {
  employees: string[];
  teams: string[];
  offices: Array<'all' | OpsOffice>;
  campaigns: string[];
  statuses: string[];
  priorities: string[];
};

export type EmployeePillarBreakdownCard = {
  key: Exclude<AnalysisPillarKey, 'employees'>;
  label: string;
  value: string;
  insight: string;
};

export type EmployeeDetailSection = {
  key: Exclude<AnalysisPillarKey, 'employees' | 'teams' | 'offices'>;
  label: string;
  rows: AnalysisDataRow[];
};

export type EmployeeBreakdown = {
  selectedEmployee: string;
  profile: AnalysisDataRow;
  pillarCards: EmployeePillarBreakdownCard[];
  detailSections: EmployeeDetailSection[];
};

export type FullAnalysisInput = {
  users: OfficeUser[];
  tasks: Task[];
  campaigns: Campaign[];
  handovers: Handover[];
  blockers: Blocker[];
  filters?: Partial<AnalysisFilters>;
  now?: number;
};

export type FullAnalysisResult = {
  filters: AnalysisFilters;
  reports: Record<AnalysisPillarKey, AnalysisReport>;
  pillarOrder: AnalysisPillarKey[];
  options: AnalysisOptions;
  globalMetrics: AnalysisDataRow[];
  exportSheets: Array<{ name: string; rows: AnalysisDataRow[] }>;
  employeeBreakdown: EmployeeBreakdown | null;
};

const PILLAR_ORDER: AnalysisPillarKey[] = [
  'employees',
  'tasks',
  'campaigns',
  'handovers',
  'blockers',
  'sla',
  'teams',
  'offices',
];

const PILLAR_LABELS: Record<AnalysisPillarKey, string> = {
  employees: 'Employees',
  tasks: 'Tasks',
  campaigns: 'Campaigns',
  handovers: 'Handovers',
  blockers: 'Blockers',
  sla: 'SLA',
  teams: 'Teams',
  offices: 'Offices',
};

const PILLAR_DESCRIPTIONS: Record<AnalysisPillarKey, string> = {
  employees: 'Per-employee workload, output, handovers, blockers, campaigns, and completion rate.',
  tasks: 'Task-level ownership, campaign context, priority, status, due pressure, and age.',
  campaigns: 'Campaign health, owner load, market, budget, coverage targets, and related work.',
  handovers: 'Shift relay continuity, acknowledgement state, linked workload, and campaign context.',
  blockers: 'Risk concentration by owner, campaign, severity, status, impact, and age.',
  sla: 'Owner-level due-soon, overdue, completed, and compliance pressure.',
  teams: 'Team workload, staffing, completion, handovers, blockers, campaigns, and productivity.',
  offices: 'Office staffing, role mix, workload, completion, handovers, blockers, campaigns, and SLA posture.',
};

export function defaultAnalysisFilters(pillar: AnalysisPillarKey = 'employees'): AnalysisFilters {
  return {
    pillar,
    employee: 'all',
    team: 'all',
    office: 'all',
    campaign: 'all',
    status: 'all',
    priority: 'all',
    search: '',
  };
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function sameValue(a: unknown, b: unknown): boolean {
  return normalizeLower(a) === normalizeLower(b) && normalizeLower(a).length > 0;
}

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function currency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function ageDays(createdAt: number, now: number): number {
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.floor((now - createdAt) / 86400000));
}

function isOverdue(task: Task, now: number): boolean {
  return !task.completed && Number.isFinite(task.dueDate) && task.dueDate < now;
}

function isDueSoon(task: Task, now: number): boolean {
  if (task.completed || !Number.isFinite(task.dueDate)) return false;
  const diff = task.dueDate - now;
  return diff >= 0 && diff <= 86400000;
}

function taskStatus(task: Task, now: number): string {
  if (task.completed) return 'Completed';
  if (task.status === 'Blocked' || isOverdue(task, now)) return 'Overdue';
  if (isDueSoon(task, now)) return 'Due Soon';
  return task.status || 'Open';
}

function cleanStatus(status: string): string {
  return status === 'Pending' || status === 'In Progress' || status === 'Due Soon' || status === 'Active' ? 'Open' : status;
}

function rowMatchesSearch(row: AnalysisDataRow, search: string): boolean {
  const query = normalizeLower(search);
  if (!query) return true;
  return Object.values(row).some((value) => normalizeLower(value).includes(query));
}

function filterByRowValue(row: AnalysisDataRow, keys: string[], selected: string): boolean {
  if (!selected || selected === 'all') return true;
  return keys.some((key) => sameValue(row[key], selected));
}

function filterRows(rows: AnalysisDataRow[], filters: AnalysisFilters, keys: {
  employee?: string[];
  team?: string[];
  office?: string[];
  campaign?: string[];
  status?: string[];
  priority?: string[];
}): AnalysisDataRow[] {
  return rows.filter((row) => {
    if (keys.employee && !filterByRowValue(row, keys.employee, filters.employee)) return false;
    if (keys.team && !filterByRowValue(row, keys.team, filters.team)) return false;
    if (keys.office && filters.office !== 'all' && !filterByRowValue(row, keys.office, filters.office)) return false;
    if (keys.campaign && !filterByRowValue(row, keys.campaign, filters.campaign)) return false;
    if (keys.status && filters.status !== 'all') {
      const selected = cleanStatus(filters.status);
      if (!keys.status.some((key) => cleanStatus(String(row[key] || '')) === selected)) return false;
    }
    if (keys.priority && !filterByRowValue(row, keys.priority, filters.priority)) return false;
    return rowMatchesSearch(row, filters.search);
  });
}

function uniqueSorted(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildReport(
  key: AnalysisPillarKey,
  rows: AnalysisDataRow[],
  filteredRows: AnalysisDataRow[],
  insight: string,
): AnalysisReport {
  return {
    key,
    label: PILLAR_LABELS[key],
    description: PILLAR_DESCRIPTIONS[key],
    value: String(filteredRows.length),
    insight,
    rows,
    filteredRows,
  };
}

function buildEmployeeBreakdown(filters: AnalysisFilters, reports: Record<AnalysisPillarKey, AnalysisReport>): EmployeeBreakdown | null {
  if (!filters.employee || filters.employee === 'all') return null;
  const profile = reports.employees.filteredRows.find((row) => sameValue(row.Employee, filters.employee));
  if (!profile) return null;

  const tasks = reports.tasks.filteredRows;
  const campaigns = reports.campaigns.filteredRows;
  const handovers = reports.handovers.filteredRows;
  const blockers = reports.blockers.filteredRows;
  const sla = reports.sla.filteredRows;

  return {
    selectedEmployee: filters.employee,
    profile,
    pillarCards: [
      { key: 'tasks', label: 'Tasks', value: String(tasks.length), insight: `${tasks.filter((row) => row.Status === 'Completed').length} completed` },
      { key: 'campaigns', label: 'Campaigns', value: String(campaigns.length), insight: `${campaigns.filter((row) => row.Status === 'Active').length} active` },
      { key: 'handovers', label: 'Handovers', value: String(handovers.length), insight: `${handovers.filter((row) => row.Status !== 'Pending').length} acknowledged/reviewed` },
      { key: 'blockers', label: 'Blockers', value: String(blockers.length), insight: `${blockers.filter((row) => row.Status !== 'Resolved').length} open` },
      { key: 'sla', label: 'SLA', value: String(sla.length), insight: `${sla.reduce((sum, row) => sum + Number(row.Overdue || 0), 0)} overdue` },
      { key: 'teams', label: 'Team', value: String(profile.Team || 'N/A'), insight: String(profile.Title || profile.Role || 'Workspace member') },
      { key: 'offices', label: 'Office', value: String(profile.Office || 'N/A'), insight: String(profile.Role || 'Role not set') },
    ],
    detailSections: [
      { key: 'tasks', label: 'Task Flow', rows: tasks },
      { key: 'campaigns', label: 'Campaign Ownership', rows: campaigns },
      { key: 'handovers', label: 'Handovers', rows: handovers },
      { key: 'blockers', label: 'Blockers', rows: blockers },
      { key: 'sla', label: 'SLA Pressure', rows: sla },
    ],
  };
}

export function buildFullAnalysisHub(input: FullAnalysisInput): FullAnalysisResult {
  const now = input.now || Date.now();
  const filters = { ...defaultAnalysisFilters(input.filters?.pillar), ...input.filters };
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const tasksByOwner = new Map<string, Task[]>();
  const blockersByOwner = new Map<string, Blocker[]>();
  const campaignsByOwner = new Map<string, Campaign[]>();

  input.tasks.forEach((task) => {
    const key = normalizeLower(task.ownerId);
    tasksByOwner.set(key, [...(tasksByOwner.get(key) || []), task]);
  });
  input.blockers.forEach((blocker) => {
    const key = normalizeLower(blocker.ownerId);
    blockersByOwner.set(key, [...(blockersByOwner.get(key) || []), blocker]);
  });
  input.campaigns.forEach((campaign) => {
    const owners = [campaign.currentOwner, ...(campaign.internalOwners || [])];
    uniqueSorted(owners).forEach((owner) => {
      const key = normalizeLower(owner);
      campaignsByOwner.set(key, [...(campaignsByOwner.get(key) || []), campaign]);
    });
  });

  const officeInsights = buildOfficeInsights({
    users: input.users,
    tasks: input.tasks,
    handovers: input.handovers,
    blockers: input.blockers,
    campaigns: input.campaigns,
  });

  const employeeRows: AnalysisDataRow[] = officeInsights.agentRows.map((row) => {
    const key = normalizeLower(row.name);
    const done = row.done;
    const tasks = tasksByOwner.get(key) || [];
    const handovers = input.handovers.filter((handover) => sameValue(handover.outgoingLead, row.name) || sameValue(handover.incomingLead, row.name));
    const blockers = blockersByOwner.get(key) || [];
    const campaigns = campaignsByOwner.get(key) || [];
    const score = done * 10 + handovers.length * 4 + campaigns.length * 3 - blockers.filter((blocker) => blocker.status !== 'Resolved').length * 5;
    return {
      Employee: row.name,
      Team: row.department,
      Office: row.office,
      Role: row.role,
      Title: row.title || 'Team Member',
      Tasks: tasks.length,
      Done: done,
      Pending: Math.max(0, tasks.length - done),
      Handovers: handovers.length,
      Blockers: blockers.filter((blocker) => blocker.status !== 'Resolved').length,
      Campaigns: campaigns.length,
      CampaignNames: campaigns.map((campaign) => campaign.name).join(', ') || 'N/A',
      Score: score,
      Completion: percent(row.completionRate),
    };
  });

  const taskRows: AnalysisDataRow[] = input.tasks.map((task) => {
    const owner = input.users.find((user) => sameValue(user.displayName, task.ownerId));
    return {
      Task: task.title,
      Owner: normalize(task.ownerId) || 'Unassigned',
      Team: owner?.department || task.department || 'Unassigned',
      Office: owner?.office || 'N/A',
      Campaign: normalize(task.campaignId) || 'Unassigned',
      Priority: task.priority,
      Status: taskStatus(task, now),
      DueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A',
      AgeDays: ageDays(task.createdAt, now),
    };
  });

  const campaignRows: AnalysisDataRow[] = input.campaigns.map((campaign) => {
    const campaignTasks = input.tasks.filter((task) => sameValue(task.campaignId, campaign.id) || sameValue(task.campaignId, campaign.name));
    const campaignBlockers = input.blockers.filter((blocker) => sameValue(blocker.campaignId, campaign.id) || sameValue(blocker.campaignId, campaign.name));
    const owner = input.users.find((user) => sameValue(user.displayName, campaign.currentOwner));
    return {
      Campaign: campaign.name,
      Owner: campaign.currentOwner || 'Unassigned',
      Team: owner?.department || 'Unassigned',
      Office: owner?.office || 'N/A',
      Market: `${campaign.country} / ${campaign.city}`,
      Status: campaign.status,
      Health: campaign.recordHealth,
      Budget: campaign.budget,
      Targets: campaign.targetInfluencers,
      CoverageTarget: campaign.targetPostingCoverage,
      Tasks: campaignTasks.length,
      Blockers: campaignBlockers.filter((blocker) => blocker.status !== 'Resolved').length,
      Platforms: campaign.platforms.join(', '),
    };
  });

  const handoverRows: AnalysisDataRow[] = input.handovers.map((handover) => {
    const linkedTasks = handover.taskIds.map((id) => tasksById.get(id)).filter(Boolean) as Task[];
    const campaigns = uniqueSorted(linkedTasks.map((task) => task.campaignId));
    const outgoing = input.users.find((user) => sameValue(user.displayName, handover.outgoingLead));
    const incoming = input.users.find((user) => sameValue(user.displayName, handover.incomingLead));
    return {
      Handover: handover.id,
      Date: handover.handoffDate,
      Team: handover.team,
      Office: outgoing?.office || incoming?.office || 'N/A',
      Campaign: campaigns.join(', ') || 'N/A',
      From: handover.outgoingLead || '',
      To: handover.incomingLead || '',
      Status: handover.status,
      LinkedTasks: handover.taskIds.length,
      NotesSize: handover.notes.length,
    };
  });

  const blockerRows: AnalysisDataRow[] = input.blockers.map((blocker) => {
    const owner = input.users.find((user) => sameValue(user.displayName, blocker.ownerId));
    return {
      Blocker: blocker.summary,
      Owner: blocker.ownerId || 'Unassigned',
      Team: owner?.department || 'Unassigned',
      Office: owner?.office || 'N/A',
      Campaign: blocker.campaignId || 'Unassigned',
      Severity: blocker.severity,
      Status: blocker.status,
      AgeDays: ageDays(blocker.createdAt, now),
      Impact: blocker.impact,
    };
  });

  const slaRows: AnalysisDataRow[] = employeeRows.map((employeeRow) => {
    const ownerTasks = tasksByOwner.get(normalizeLower(employeeRow.Employee)) || [];
    const total = ownerTasks.length;
    const completed = ownerTasks.filter((task) => task.completed).length;
    const overdue = ownerTasks.filter((task) => isOverdue(task, now)).length;
    const dueSoon = ownerTasks.filter((task) => isDueSoon(task, now)).length;
    const compliance = total ? ((total - overdue) / total) * 100 : 100;
    return {
      Owner: employeeRow.Employee,
      Team: employeeRow.Team,
      Office: employeeRow.Office,
      TotalTasks: total,
      Completed: completed,
      DueSoon: dueSoon,
      Overdue: overdue,
      Status: overdue > 0 ? 'Overdue' : dueSoon > 0 ? 'Due Soon' : 'Healthy',
      Compliance: percent(compliance),
    };
  }).filter((row) => Number(row.TotalTasks) > 0);

  const teamRows: AnalysisDataRow[] = TEAMS.map((team) => {
    const teamEmployees = employeeRows.filter((row) => sameValue(row.Team, team) || normalizeLower(row.Team).includes(normalizeLower(team.replace(' Team', ''))));
    return {
      Team: team,
      Agents: teamEmployees.length,
      Offices: new Set(teamEmployees.map((row) => row.Office)).size,
      Tasks: teamEmployees.reduce((sum, row) => sum + Number(row.Tasks || 0), 0),
      Completed: teamEmployees.reduce((sum, row) => sum + Number(row.Done || 0), 0),
      Pending: teamEmployees.reduce((sum, row) => sum + Number(row.Pending || 0), 0),
      Handovers: teamEmployees.reduce((sum, row) => sum + Number(row.Handovers || 0), 0),
      Blockers: teamEmployees.reduce((sum, row) => sum + Number(row.Blockers || 0), 0),
      Campaigns: teamEmployees.reduce((sum, row) => sum + Number(row.Campaigns || 0), 0),
      Productivity: percent(teamEmployees.length ? teamEmployees.reduce((sum, row) => sum + Number(row.Score || 0), 0) / teamEmployees.length : 0),
    };
  }).filter((row) => Number(row.Agents) > 0 || Number(row.Tasks) > 0);

  const officeRows: AnalysisDataRow[] = officeInsights.officeRows.map((row) => ({
    Office: row.office,
    Country: OFFICES.find((office) => office.name === row.office)?.country || row.office,
    Agents: row.agents,
    Community: row.communityAgents,
    Operations: row.operationsAgents,
    Tasks: row.tasks,
    Completed: row.done,
    Pending: row.pending,
    Handovers: row.handovers,
    Blockers: row.blockers,
    Campaigns: row.campaigns,
    SLA: percent(row.completionRate),
  }));

  const filtered = {
    employees: filterRows(employeeRows, filters, { employee: ['Employee'], team: ['Team'], office: ['Office'] }),
    tasks: filterRows(taskRows, filters, { employee: ['Owner'], team: ['Team'], office: ['Office'], campaign: ['Campaign'], status: ['Status'], priority: ['Priority'] }),
    campaigns: filterRows(campaignRows, filters, { employee: ['Owner'], team: ['Team'], office: ['Office'], campaign: ['Campaign'], status: ['Status'] }),
    handovers: filterRows(handoverRows, filters, { employee: ['From', 'To'], team: ['Team'], office: ['Office'], campaign: ['Campaign'], status: ['Status'] }),
    blockers: filterRows(blockerRows, filters, { employee: ['Owner'], team: ['Team'], office: ['Office'], campaign: ['Campaign'], status: ['Status'], priority: ['Severity'] }),
    sla: filterRows(slaRows, filters, { employee: ['Owner'], team: ['Team'], office: ['Office'], status: ['Status'] }),
    teams: filterRows(teamRows, filters, { team: ['Team'] }),
    offices: filterRows(officeRows, filters, { office: ['Office'] }),
  };

  const reports: Record<AnalysisPillarKey, AnalysisReport> = {
    employees: buildReport('employees', employeeRows, filtered.employees, `${filtered.employees.reduce((sum, row) => sum + Number(row.Done || 0), 0)} completed tasks by selected employees`),
    tasks: buildReport('tasks', taskRows, filtered.tasks, `${filtered.tasks.filter((row) => row.Status === 'Completed').length} done / ${filtered.tasks.filter((row) => row.Status !== 'Completed').length} open tasks`),
    campaigns: buildReport('campaigns', campaignRows, filtered.campaigns, `${currency(filtered.campaigns.reduce((sum, row) => sum + Number(row.Budget || 0), 0))} filtered campaign budget`),
    handovers: buildReport('handovers', handoverRows, filtered.handovers, `${filtered.handovers.filter((row) => row.Status !== 'Pending').length} acknowledged or reviewed handovers`),
    blockers: buildReport('blockers', blockerRows, filtered.blockers, `${filtered.blockers.filter((row) => row.Severity === 'Critical' || row.Severity === 'High').length} high-priority risks visible`),
    sla: buildReport('sla', slaRows, filtered.sla, `${filtered.sla.reduce((sum, row) => sum + Number(row.Overdue || 0), 0)} overdue tasks in filtered scope`),
    teams: buildReport('teams', teamRows, filtered.teams, `${filtered.teams.reduce((sum, row) => sum + Number(row.Completed || 0), 0)} completed tasks by selected teams`),
    offices: buildReport('offices', officeRows, filtered.offices, `${filtered.offices.reduce((sum, row) => sum + Number(row.Tasks || 0), 0)} tasks across selected offices`),
  };

  const options: AnalysisOptions = {
    employees: uniqueSorted(employeeRows.map((row) => String(row.Employee))),
    teams: uniqueSorted([...employeeRows.map((row) => String(row.Team)), ...teamRows.map((row) => String(row.Team))]),
    offices: ['all', ...OFFICES.map((office) => office.name as OpsOffice)],
    campaigns: uniqueSorted(campaignRows.map((row) => String(row.Campaign))),
    statuses: uniqueSorted([
      ...taskRows.map((row) => String(row.Status)),
      ...campaignRows.map((row) => String(row.Status)),
      ...handoverRows.map((row) => String(row.Status)),
      ...blockerRows.map((row) => String(row.Status)),
      ...slaRows.map((row) => String(row.Status)),
    ]),
    priorities: uniqueSorted([...taskRows.map((row) => String(row.Priority)), ...blockerRows.map((row) => String(row.Severity))]),
  };

  const globalMetrics: AnalysisDataRow[] = [
    { Label: 'Employees', Value: employeeRows.length },
    { Label: 'Tasks', Value: taskRows.length },
    { Label: 'Campaigns', Value: campaignRows.length },
    { Label: 'Handovers', Value: handoverRows.length },
    { Label: 'Blockers', Value: blockerRows.filter((row) => row.Status !== 'Resolved').length },
    { Label: 'SLA', Value: reports.sla.value },
    { Label: 'Teams', Value: teamRows.length },
    { Label: 'Offices', Value: officeRows.filter((row) => Number(row.Agents || 0) > 0 || Number(row.Tasks || 0) > 0).length },
  ];

  return {
    filters,
    reports,
    pillarOrder: PILLAR_ORDER,
    options,
    globalMetrics,
    exportSheets: PILLAR_ORDER.map((key) => ({ name: PILLAR_LABELS[key], rows: reports[key].filteredRows })),
    employeeBreakdown: buildEmployeeBreakdown(filters, reports),
  };
}
