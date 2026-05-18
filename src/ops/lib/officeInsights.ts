import type { OpsOffice, OpsRole, OpsUserStatus } from '../auth/types';
import { OPS_OFFICES } from '../auth/types';
import type { Blocker, Campaign, Handover, Task } from '../types';
import { isReportVisibleUser, isVisibleInReports } from './reportVisibility';
import { normalizeWorkspaceText } from './workspace';

export type OfficeUser = {
  displayName: string;
  email?: string;
  role: OpsRole;
  office: OpsOffice;
  department: string;
  title: string;
  status: OpsUserStatus;
};

export type OfficeMetricRow = {
  office: OpsOffice;
  agents: number;
  communityAgents: number;
  operationsAgents: number;
  tasks: number;
  done: number;
  pending: number;
  handovers: number;
  blockers: number;
  campaigns: number;
  completionRate: number;
};

export type OfficeAgentRow = {
  office: OpsOffice;
  name: string;
  email?: string;
  role: OpsRole;
  department: string;
  title: string;
  tasks: number;
  done: number;
  pending: number;
  handovers: number;
  blockers: number;
  campaigns: number;
  completionRate: number;
};

export type OfficeInsights = {
  officeRows: OfficeMetricRow[];
  agentRows: OfficeAgentRow[];
};

interface OfficeInsightsInput {
  users: OfficeUser[];
  tasks: Task[];
  handovers: Handover[];
  blockers: Blocker[];
  campaigns: Campaign[];
}

function sameName(a: string | undefined | null, b: string | undefined | null): boolean {
  return normalizeWorkspaceText(a) === normalizeWorkspaceText(b);
}

export function buildOfficeInsights(input: OfficeInsightsInput): OfficeInsights {
  const activeUsers = input.users.filter(
    (user) => user && user.status !== 'suspended' && typeof user.displayName === 'string' && user.displayName.trim().length > 0 && isReportVisibleUser(user),
  );

  const agentRows = activeUsers
    .map((user) => {
      const tasks = input.tasks.filter((task) => isVisibleInReports(task.ownerId) && sameName(task.ownerId, user.displayName));
      const done = tasks.filter((task) => task.completed).length;
      const handovers = input.handovers.filter((handover) =>
        isVisibleInReports(handover.outgoingLead) &&
        isVisibleInReports(handover.incomingLead) &&
        (sameName(handover.outgoingLead, user.displayName) || sameName(handover.incomingLead, user.displayName))
      );
      const blockers = input.blockers.filter((blocker) => isVisibleInReports(blocker.ownerId) && sameName(blocker.ownerId, user.displayName) && blocker.status !== 'Resolved');
      const campaigns = input.campaigns.filter((campaign) =>
        isVisibleInReports(campaign.currentOwner) &&
        (sameName(campaign.currentOwner, user.displayName) ||
          campaign.internalOwners?.some((owner) => isVisibleInReports(owner) && sameName(owner, user.displayName)))
      );

      return {
        office: (user.office || 'Egypt') as OpsOffice,
        name: user.displayName,
        email: user.email,
        role: user.role || 'operations',
        department: user.department || 'Operations',
        title: user.title || '',
        tasks: tasks.length,
        done,
        pending: tasks.length - done,
        handovers: handovers.length,
        blockers: blockers.length,
        campaigns: campaigns.length,
        completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      };
    })
    .sort((a, b) => {
      const officeCompare = String(a.office || '').localeCompare(String(b.office || ''));
      if (officeCompare !== 0) return officeCompare;
      if (a.tasks !== b.tasks) return b.tasks - a.tasks;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  const officeRows = OPS_OFFICES.map((office) => {
    const users = activeUsers.filter((user) => user.office === office);
    const rows = agentRows.filter((row) => row.office === office);
    const tasks = rows.reduce((sum, row) => sum + row.tasks, 0);
    const done = rows.reduce((sum, row) => sum + row.done, 0);

    return {
      office,
      agents: users.length,
      communityAgents: users.filter((user) => user.role === 'community').length,
      operationsAgents: users.filter((user) => user.role !== 'community').length,
      tasks,
      done,
      pending: rows.reduce((sum, row) => sum + row.pending, 0),
      handovers: rows.reduce((sum, row) => sum + row.handovers, 0),
      blockers: rows.reduce((sum, row) => sum + row.blockers, 0),
      campaigns: rows.reduce((sum, row) => sum + row.campaigns, 0),
      completionRate: tasks ? Math.round((done / tasks) * 100) : 0,
    };
  });

  return { officeRows, agentRows };
}
