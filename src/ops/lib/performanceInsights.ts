import type { OpsOffice, OpsRole } from '../auth/types';
import type { Blocker, Campaign, CampaignInfluencer, Handover, Task } from '../types';
import { getTaskBucket } from './taskInsights';
import { normalizeWorkspaceText } from './workspace';

export type PerformanceUser = {
  name: string;
  role: OpsRole;
  office: OpsOffice;
  department: string;
  title: string;
};

export type PerformanceSummary = {
  tasks: number;
  done: number;
  inProgress: number;
  pending: number;
  blocked: number;
  completionRate: number;
  campaigns: number;
  creators: number;
  handovers: number;
};

export type PerformanceRow = {
  name: string;
  role?: OpsRole;
  office?: OpsOffice;
  team?: string;
  title?: string;
  scope?: 'all' | 'operations' | 'community';
  summary: PerformanceSummary;
};

export type PerformanceInsights = {
  currentUser: PerformanceRow | null;
  workspaceRows: PerformanceRow[];
  teamRows: PerformanceRow[];
  agentRows: PerformanceRow[];
};

type BuildPerformanceInput = {
  users: PerformanceUser[];
  tasks: Task[];
  blockers: Blocker[];
  campaigns: Campaign[];
  influencers: CampaignInfluencer[];
  handovers: Handover[];
  viewerName: string;
  viewerRole: OpsRole;
  now?: number;
};

const communityHints = ['community', 'coordination', 'mona'];

function sameName(a: string | undefined | null, b: string | undefined | null): boolean {
  return normalizeWorkspaceText(a) === normalizeWorkspaceText(b);
}

function belongsToCommunityText(value: string | undefined | null): boolean {
  const text = normalizeWorkspaceText(value);
  return communityHints.some((hint) => text.includes(hint));
}

function userScope(user: PerformanceUser): 'operations' | 'community' {
  if (user.role === 'community' || belongsToCommunityText(user.name) || belongsToCommunityText(user.department)) return 'community';
  return 'operations';
}

function taskScope(task: Task, usersByName: Map<string, PerformanceUser>): 'operations' | 'community' {
  const owner = usersByName.get(normalizeWorkspaceText(task.ownerId));
  if (owner) return userScope(owner);
  return belongsToCommunityText(`${task.ownerId} ${task.campaignId} ${task.title}`) ? 'community' : 'operations';
}

function emptySummary(): PerformanceSummary {
  return {
    tasks: 0,
    done: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0,
    completionRate: 0,
    campaigns: 0,
    creators: 0,
    handovers: 0,
  };
}

function summarize({
  tasks,
  blockers,
  campaigns,
  influencers,
  handovers,
  now,
}: Pick<BuildPerformanceInput, 'tasks' | 'blockers' | 'campaigns' | 'influencers' | 'handovers'> & { now: number }): PerformanceSummary {
  const taskBuckets = tasks.map((task) => getTaskBucket(task, now));
  const done = taskBuckets.filter((bucket) => bucket === 'done').length;
  const summary = emptySummary();

  summary.tasks = tasks.length;
  summary.done = done;
  summary.inProgress = taskBuckets.filter((bucket) => bucket === 'in-progress').length;
  summary.pending = taskBuckets.filter((bucket) => bucket === 'pending').length;
  summary.blocked = taskBuckets.filter((bucket) => bucket === 'blocked').length + blockers.filter((blocker) => blocker.status !== 'Resolved').length;
  summary.completionRate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  summary.campaigns = campaigns.length;
  summary.creators = influencers.length;
  summary.handovers = handovers.length;
  return summary;
}

function agentSummary(name: string, input: BuildPerformanceInput): PerformanceSummary {
  return summarize({
    tasks: input.tasks.filter((task) => sameName(task.ownerId, name)),
    blockers: input.blockers.filter((blocker) => sameName(blocker.ownerId, name)),
    campaigns: input.campaigns.filter((campaign) =>
      sameName(campaign.currentOwner, name) ||
      campaign.internalOwners?.some((owner) => sameName(owner, name))
    ),
    influencers: input.influencers.filter((influencer) => sameName(influencer.ownerId, name)),
    handovers: input.handovers.filter((handover) => sameName(handover.outgoingLead, name) || sameName(handover.incomingLead, name)),
    now: input.now || Date.now(),
  });
}

export function buildPerformanceInsights(input: BuildPerformanceInput): PerformanceInsights {
  const now = input.now || Date.now();
  const usersByName = new Map(input.users.map((user) => [normalizeWorkspaceText(user.name), user]));
  const currentUserInfo = input.users.find((user) => sameName(user.name, input.viewerName));

  const currentUser = input.viewerName
    ? {
        name: input.viewerName,
        role: currentUserInfo?.role || input.viewerRole,
        office: currentUserInfo?.office,
        team: currentUserInfo?.department || 'Workspace',
        title: currentUserInfo?.title || 'Team Member',
        summary: agentSummary(input.viewerName, { ...input, now }),
      }
    : null;

  const workspaceRows: PerformanceRow[] = (['all', 'operations', 'community'] as const).map((scope) => {
    const scopedTasks = scope === 'all' ? input.tasks : input.tasks.filter((task) => taskScope(task, usersByName) === scope);
    const scopedUsers = scope === 'all' ? input.users : input.users.filter((user) => userScope(user) === scope);
    const scopedNames = new Set(scopedUsers.map((user) => normalizeWorkspaceText(user.name)));
    const includesScopedName = (value: string) => scopedNames.has(normalizeWorkspaceText(value));

    return {
      name: scope === 'all' ? 'All Workspaces' : scope === 'community' ? 'Community' : 'Operations',
      scope,
      summary: summarize({
        tasks: scopedTasks,
        blockers: scope === 'all' ? input.blockers : input.blockers.filter((blocker) => includesScopedName(blocker.ownerId)),
        campaigns: scope === 'all' ? input.campaigns : input.campaigns.filter((campaign) => includesScopedName(campaign.currentOwner)),
        influencers: scope === 'all' ? input.influencers : input.influencers.filter((influencer) => includesScopedName(influencer.ownerId)),
        handovers: scope === 'all' ? input.handovers : input.handovers.filter((handover) => belongsToCommunityText(handover.team) === (scope === 'community')),
        now,
      }),
    };
  });

  const teamRows: PerformanceRow[] = [...new Set(input.users.map((user) => user.department || 'Workspace'))]
    .sort((a, b) => a.localeCompare(b))
    .map((team) => {
      const teamUsers = input.users.filter((user) => user.department === team);
      const names = new Set(teamUsers.map((user) => normalizeWorkspaceText(user.name)));
      return {
        name: team,
        team,
        summary: summarize({
          tasks: input.tasks.filter((task) => names.has(normalizeWorkspaceText(task.ownerId))),
          blockers: input.blockers.filter((blocker) => names.has(normalizeWorkspaceText(blocker.ownerId))),
          campaigns: input.campaigns.filter((campaign) => names.has(normalizeWorkspaceText(campaign.currentOwner))),
          influencers: input.influencers.filter((influencer) => names.has(normalizeWorkspaceText(influencer.ownerId))),
          handovers: input.handovers.filter((handover) => belongsToCommunityText(handover.team) === belongsToCommunityText(team)),
          now,
        }),
      };
    });

  const agentRows: PerformanceRow[] = input.users
    .filter((user) => typeof user?.name === 'string' && user.name.trim().length > 0)
    .map((user) => ({
      name: user.name,
      role: user.role,
      office: user.office,
      team: user.department,
      title: user.title,
      summary: agentSummary(user.name, { ...input, now }),
    }))
    .filter((row) => row.summary.tasks || row.summary.campaigns || row.summary.creators || row.summary.handovers || row.summary.blocked)
    .sort((a, b) => b.summary.tasks - a.summary.tasks || String(a.name || '').localeCompare(String(b.name || '')));

  return {
    currentUser,
    workspaceRows,
    teamRows,
    agentRows,
  };
}
