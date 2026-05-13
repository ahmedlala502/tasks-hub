import type { OpsRole } from '../auth/types';
import type { Blocker, Campaign, CampaignInfluencer, Handover, Task } from '../types';

export type WorkspaceScope = 'all' | 'operations' | 'community';

const COMMUNITY_HINTS = ['community', 'mona'];

export function getWorkspaceScope(role: OpsRole | null): WorkspaceScope {
  if (role === 'master') return 'all';
  if (role === 'community') return 'community';
  return 'operations';
}

export function normalizeWorkspaceText(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

function isCommunityText(value: string | undefined | null): boolean {
  const normalized = normalizeWorkspaceText(value);
  return COMMUNITY_HINTS.some((hint) => normalized.includes(hint));
}

function isCommunityTask(task: Task): boolean {
  return isCommunityText(task.ownerId) || isCommunityText(task.campaignId) || isCommunityText(task.title);
}

function isCommunityBlocker(blocker: Blocker): boolean {
  return isCommunityText(blocker.ownerId) || isCommunityText(blocker.summary) || isCommunityText(blocker.impact);
}

function isCommunityHandover(handover: Handover): boolean {
  return (
    isCommunityText(handover.team) ||
    isCommunityText(handover.outgoingLead) ||
    isCommunityText(handover.incomingLead) ||
    isCommunityText(handover.notes)
  );
}

function isCommunityCampaign(campaign: Campaign): boolean {
  return (
    isCommunityText(campaign.currentOwner) ||
    campaign.internalOwners?.some((owner) => isCommunityText(owner)) ||
    campaign.clientOwners?.some((owner) => isCommunityText(owner))
  );
}

function isCommunityInfluencer(influencer: CampaignInfluencer): boolean {
  return isCommunityText(influencer.ownerId) || isCommunityText(influencer.username) || isCommunityText(influencer.niche);
}

export function filterTasksByRole(role: OpsRole | null, tasks: Task[]): Task[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return tasks;
  return tasks.filter((task) => (scope === 'community' ? isCommunityTask(task) : !isCommunityTask(task)));
}

export function filterBlockersByRole(role: OpsRole | null, blockers: Blocker[]): Blocker[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return blockers;
  return blockers.filter((blocker) => (scope === 'community' ? isCommunityBlocker(blocker) : !isCommunityBlocker(blocker)));
}

export function filterHandoversByRole(role: OpsRole | null, handovers: Handover[]): Handover[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return handovers;
  return handovers.filter((handover) => (scope === 'community' ? isCommunityHandover(handover) : !isCommunityHandover(handover)));
}

export function filterCampaignsByRole(role: OpsRole | null, campaigns: Campaign[]): Campaign[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return campaigns;
  return campaigns.filter((campaign) => (scope === 'community' ? isCommunityCampaign(campaign) : !isCommunityCampaign(campaign)));
}

export function filterInfluencersByRole(role: OpsRole | null, influencers: CampaignInfluencer[]): CampaignInfluencer[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return influencers;
  return influencers.filter((influencer) => (scope === 'community' ? isCommunityInfluencer(influencer) : !isCommunityInfluencer(influencer)));
}

// Team-role names that should always be available regardless of workspace scope.
// The community-hint filter must NOT strip these predefined roles.
const ALWAYS_VISIBLE_OWNERS = new Set([
  'campaign manager', 'community lead', 'coordination lead',
  'coverage lead', 'qa lead', 'finance lead', 'head of operations',
]);

export function filterOwnerOptionsByRole(role: OpsRole | null, owners: string[]): string[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return owners;
  return owners.filter((owner) => {
    // Never filter out predefined team-role names
    if (ALWAYS_VISIBLE_OWNERS.has(owner.toLowerCase())) return true;
    return scope === 'community' ? isCommunityText(owner) : !isCommunityText(owner);
  });
}

export function filterTeamOptionsByRole(role: OpsRole | null, teams: string[]): string[] {
  const scope = getWorkspaceScope(role);
  if (scope === 'all') return teams;
  return teams.filter((team) => (scope === 'community' ? isCommunityText(team) : !isCommunityText(team)));
}

export function getWorkspaceLabel(role: OpsRole | null): string {
  const scope = getWorkspaceScope(role);
  if (scope === 'community') return 'Community Workspace';
  if (scope === 'operations') return 'Operations Workspace';
  return 'All Workspaces';
}
