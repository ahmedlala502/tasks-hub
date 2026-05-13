import { describe, expect, it } from 'vitest';
import type { Blocker, Campaign, Handover, Task } from '../types';
import { buildOfficeInsights } from './officeInsights';

const baseTask = (ownerId: string, completed = false): Task => ({
  id: `T-${ownerId}-${completed}`,
  title: 'Task',
  description: '',
  ownerId,
  dueDate: Date.now(),
  campaignId: 'Campaign',
  priority: 'Medium',
  completed,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

const campaign = (owner: string): Campaign => ({
  id: `C-${owner}`,
  name: 'Campaign',
  clientId: '',
  brandId: '',
  country: 'KSA',
  city: 'Riyadh',
  objective: '',
  platforms: [],
  type: '',
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
  internalOwners: [owner],
  clientOwners: [],
  influencerCriteria: '',
  currentOwner: owner,
  nextAction: '',
  stage: 1 as any,
  status: 'Active',
  recordHealth: 'Healthy',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

const handover = (outgoingLead: string, incomingLead: string): Handover => ({
  id: `H-${outgoingLead}`,
  handoffDate: '2026-05-13',
  fromShift: 'Morning',
  toShift: 'Mid',
  team: 'Operations',
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

const blocker = (ownerId: string): Blocker => ({
  id: `B-${ownerId}`,
  campaignId: 'Campaign',
  summary: 'Issue',
  impact: 'Slowdown',
  status: 'Open',
  severity: 'High',
  ownerId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'test',
});

describe('officeInsights', () => {
  it('breaks down work by required office and by agents inside that office', () => {
    const insights = buildOfficeInsights({
      users: [
        { displayName: 'Community KSA', email: 'ksa@test.com', role: 'community', office: 'KSA', department: 'Coordination', title: 'Community', status: 'active' },
        { displayName: 'Nurhan', email: 'nurhan@test.com', role: 'community', office: 'UAE', department: 'Coordination', title: 'Community', status: 'active' },
        { displayName: 'Ops Egypt', email: 'ops@test.com', role: 'operations', office: 'Egypt', department: 'Operations', title: 'Ops', status: 'active' },
      ],
      tasks: [baseTask('Community KSA', true), baseTask('Community KSA'), baseTask('Nurhan')],
      handovers: [handover('Community KSA', 'Nurhan')],
      blockers: [blocker('Nurhan')],
      campaigns: [campaign('Community KSA'), campaign('Nurhan')],
    });

    expect(insights.officeRows.find((row) => row.office === 'KSA')).toMatchObject({
      agents: 1,
      communityAgents: 1,
      tasks: 2,
      done: 1,
      campaigns: 1,
    });
    expect(insights.officeRows.find((row) => row.office === 'UAE')).toMatchObject({
      agents: 1,
      tasks: 1,
      handovers: 1,
      blockers: 1,
    });
    expect(insights.agentRows.map((row) => [row.office, row.name])).toContainEqual(['Egypt', 'Ops Egypt']);
  });
});
