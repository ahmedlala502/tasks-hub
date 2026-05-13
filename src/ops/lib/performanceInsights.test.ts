import { describe, expect, it } from 'vitest';
import type { Blocker, Campaign, CampaignInfluencer, Handover, Task } from '../types';
import { buildPerformanceInsights } from './performanceInsights';

const task = (overrides: Partial<Task>): Task => ({
  id: overrides.id || `T-${Math.random()}`,
  title: overrides.title || 'Task',
  description: '',
  ownerId: overrides.ownerId || 'Nada',
  dueDate: overrides.dueDate ?? Date.now() + 86400000,
  campaignId: overrides.campaignId || 'Campaign A',
  priority: overrides.priority || 'Medium',
  completed: overrides.completed ?? false,
  createdAt: overrides.createdAt ?? Date.now() - 86400000,
  updatedAt: overrides.updatedAt ?? Date.now(),
  createdBy: 'test',
});

const blocker = (ownerId: string): Blocker => ({
  id: `B-${ownerId}`,
  campaignId: 'Campaign A',
  summary: 'Blocked item',
  impact: 'Slows work',
  status: 'Open',
  severity: 'High',
  ownerId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

const campaign = (currentOwner: string): Campaign => ({
  id: `C-${currentOwner}`,
  name: 'Campaign',
  clientId: 'client',
  brandId: 'brand',
  country: 'KSA',
  city: 'Riyadh',
  objective: 'Awareness',
  platforms: [],
  type: 'Ops',
  budget: 0,
  budgetType: 'USD',
  targetInfluencers: 0,
  targetPostingCoverage: 0,
  startDate: '2026-05-13',
  endDate: '2026-05-14',
  deliverables: '',
  tags: '',
  mentions: '',
  links: '',
  visitRequired: false,
  productDetails: '',
  approvalFlow: '',
  reportingCadence: '',
  restrictions: '',
  internalOwners: [currentOwner],
  clientOwners: [],
  influencerCriteria: '',
  currentOwner,
  nextAction: '',
  stage: 1 as any,
  status: 'Active',
  recordHealth: 'Healthy',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

const influencer = (ownerId: string): CampaignInfluencer => ({
  id: `I-${ownerId}`,
  campaignId: 'Campaign A',
  influencerId: 'INF',
  username: '@creator',
  platform: 'Instagram',
  status: 'Pending',
  invitationWave: 1,
  reminder1Sent: false,
  reminder2Sent: false,
  visitCompleted: false,
  coverageReceived: false,
  qaStatus: 'Pending',
  ownerId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

const handover = (team: string, outgoingLead: string, incomingLead: string): Handover => ({
  id: `H-${team}`,
  handoffDate: '2026-05-13',
  fromShift: 'Morning',
  toShift: 'Mid',
  team,
  region: 'KSA',
  outgoingLead,
  incomingLead,
  status: 'Pending',
  notes: '',
  taskIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

describe('performanceInsights', () => {
  it('rolls up personal tool performance for one agent', () => {
    const insights = buildPerformanceInsights({
      users: [{ name: 'Nada', role: 'operations', office: 'Egypt', department: 'Operations', title: 'Ops' }],
      tasks: [task({ ownerId: 'Nada', completed: true }), task({ ownerId: 'Nada', completed: false })],
      blockers: [blocker('Nada')],
      campaigns: [campaign('Nada')],
      influencers: [influencer('Nada')],
      handovers: [handover('Operations', 'Nada', 'Atia')],
      viewerName: 'Nada',
      viewerRole: 'operations',
    });

    expect(insights.currentUser?.summary).toMatchObject({
      tasks: 2,
      done: 1,
      pending: 0,
      inProgress: 1,
      blocked: 1,
      campaigns: 1,
      creators: 1,
      handovers: 1,
    });
  });

  it('lets master inspect community, operations, teams, and agent performance', () => {
    const insights = buildPerformanceInsights({
      users: [
        { name: 'Nada', role: 'operations', office: 'Egypt', department: 'Operations', title: 'Ops' },
        { name: 'Mona Community', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community' },
      ],
      tasks: [
        task({ ownerId: 'Nada', completed: true }),
        task({ ownerId: 'Mona Community', completed: false, campaignId: 'Community Campaign' }),
      ],
      blockers: [],
      campaigns: [campaign('Nada'), campaign('Mona Community')],
      influencers: [influencer('Mona Community')],
      handovers: [handover('Community', 'Mona Community', 'Nada')],
      viewerName: 'admin',
      viewerRole: 'master',
    });

    expect(insights.workspaceRows.map((row) => [row.scope, row.summary.tasks])).toEqual([
      ['all', 2],
      ['operations', 1],
      ['community', 1],
    ]);
    expect(insights.teamRows.map((row) => [row.team, row.summary.tasks])).toContainEqual(['Coordination', 1]);
    expect(insights.agentRows.map((row) => [row.name, row.summary.tasks])).toContainEqual(['Mona Community', 1]);
  });
});
