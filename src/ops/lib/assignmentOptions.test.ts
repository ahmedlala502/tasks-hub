import { describe, expect, it } from 'vitest';
import type { Campaign, Handover, Task } from '../types';
import { CampaignStage } from '../constants';
import { buildAssignmentOptions } from './assignmentOptions';

const now = new Date('2026-05-14T10:00:00Z').getTime();

function task(overrides: Partial<Task>): Task {
  return {
    id: 'T-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'test',
    title: 'Task',
    description: '',
    ownerId: 'Mona K.',
    dueDate: now,
    campaignId: 'Launch',
    priority: 'Medium',
    completed: false,
    ...overrides,
  };
}

function campaign(overrides: Partial<Campaign>): Campaign {
  return {
    id: 'C-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'test',
    name: 'Launch',
    clientId: '',
    brandId: '',
    country: '',
    city: '',
    objective: '',
    platforms: [],
    type: '',
    budget: 0,
    budgetType: '',
    targetInfluencers: 0,
    targetPostingCoverage: 0,
    startDate: '',
    endDate: '',
    deliverables: '',
    tags: '',
    mentions: '',
    links: '',
    visitRequired: false,
    productDetails: '',
    approvalFlow: '',
    reportingCadence: '',
    restrictions: '',
    internalOwners: ['Sarah A.'],
    clientOwners: [],
    influencerCriteria: '',
    currentOwner: 'Omar S.',
    nextAction: '',
    stage: CampaignStage.INTAKE,
    status: 'Active',
    recordHealth: 'Healthy',
    ...overrides,
  };
}

function handover(overrides: Partial<Handover>): Handover {
  return {
    id: 'H-1',
    handoffDate: '2026-05-14',
    fromShift: 'Morning',
    toShift: 'Mid',
    team: 'Operations',
    region: 'Regional',
    outgoingLead: 'Ahmed E.',
    incomingLead: 'Mona K.',
    assignFrom: ['Ahmed E.'],
    assignTo: ['Nurhan M.'],
    notes: '',
    taskIds: [],
    status: 'Pending',
    createdAt: now,
    updatedAt: now,
    createdBy: 'test',
    ...overrides,
  };
}

describe('assignment options', () => {
  it('builds a unique sorted assignment dropdown from tasks, campaigns, handovers, and explicit users', () => {
    const options = buildAssignmentOptions({
      users: ['Mona K.', ' ', 'Admin User'],
      tasks: [task({ ownerId: 'mona k.' }), task({ ownerId: 'Coverage Lead' })],
      campaigns: [campaign({})],
      handovers: [handover({})],
    });

    expect(options).toEqual([
      'Admin User',
      'Ahmed E.',
      'Coverage Lead',
      'Mona K.',
      'Nurhan M.',
      'Omar S.',
      'Sarah A.',
    ]);
  });
});
