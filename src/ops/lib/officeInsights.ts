import type { OpsOffice, OpsRole, OpsUserStatus } from '../auth/types';
import { OPS_OFFICES } from '../auth/types';
import type { Blocker, Campaign, Handover, Task } from '../types';
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
  const activeUsers = input.users.filter((user) => user.status !== 'suspended');

  const agentRows = activeUsers
    .map((user) => {
      const tasks = input.tasks.filter((task) => sameName(task.ownerId, user.displayName));
      const done = tasks.filter((task) => task.completed).length;
      const handovers = input.handovers.filter((handover) => sameName(handover.outgoingLead, user.displayName) || sameName(handover.incomingLead, user.displayName));
      const blockers = input.blockers.filter((blocker) => sameName(blocker.ownerId, user.displayName) && blocker.status !== 'Resolved');
      const campaigns = input.campaigns.filter((campaign) =>
        sameName(campaign.currentOwner, user.displayName) ||
        campaign.internalOwners?.some((owner) => sameName(owner, user.displayName))
      );

      return {
        office: user.office,
        name: user.displayName,
        email: user.email,
        role: user.role,
        department: user.department,
        title: user.title,
        tasks: tasks.length,
        done,
        pending: tasks.length - done,
        handovers: handovers.length,
        blockers: blockers.length,
        campaigns: campaigns.length,
        completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      };
    })
    .sort((a, b) => a.office.localeCompare(b.office) || b.tasks - a.tasks || a.name.localeCompare(b.name));

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
