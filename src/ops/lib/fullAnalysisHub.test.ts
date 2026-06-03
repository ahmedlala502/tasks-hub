import { describe, expect, it } from 'vitest';
import type { OpsOffice } from '../auth/types';
import type { Blocker, Campaign, Handover, Task } from '../types';
import { buildFullAnalysisHub, defaultAnalysisFilters } from './fullAnalysisHub';
import type { OfficeUser } from './officeInsights';

const now = new Date('2026-05-27T10:00:00Z').getTime();

function user(name: string, office: OpsOffice, department = 'Operations'): OfficeUser {
  return {
    displayName: name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@trygc.test`,
    role: department === 'Coordination' ? 'community' : 'operations',
    office,
    department,
    title: `${department} Owner`,
    status: 'active',
  };
}

function task(id: string, ownerId: string, campaignId: string, completed = false): Task {
  return {
    id,
    title: `${campaignId} task`,
    description: '',
    ownerId,
    dueDate: now + 86400000,
    campaignId,
    priority: ownerId === 'Mona' ? 'High' : 'Medium',
    completed,
    createdAt: now - 86400000,
    updatedAt: now,
    createdBy: 'test',
  };
}

function campaign(name: string, currentOwner: string): Campaign {
  return {
    id: name,
    name,
    clientId: '',
    brandId: '',
    country: 'KSA',
    city: 'Riyadh',
    objective: '',
    platforms: ['Instagram'],
    type: 'Activation',
    budget: 1500,
    budgetType: 'USD',
    targetInfluencers: 12,
    targetPostingCoverage: 10,
    startDate: '2026-05-20',
    endDate: '2026-05-30',
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
    createdAt: now - 86400000,
    updatedAt: now,
    createdBy: 'test',
  };
}

function handover(id: string, outgoingLead: string, incomingLead: string, taskIds: string[]): Handover {
  return {
    id,
    handoffDate: '2026-05-27',
    fromShift: 'Morning',
    toShift: 'Mid',
    team: 'Operations',
    region: 'KSA',
    outgoingLead,
    incomingLead,
    notes: 'Follow up today',
    taskIds,
    status: 'Pending',
    createdAt: now - 3600000,
    updatedAt: now,
    createdBy: 'test',
  };
}

function blocker(ownerId: string, campaignId: string): Blocker {
  return {
    id: `B-${ownerId}`,
    campaignId,
    summary: 'Missing approval',
    impact: 'Blocks posting',
    status: 'Open',
    severity: 'High',
    ownerId,
    createdAt: now - 86400000,
    updatedAt: now,
    createdBy: 'test',
  };
}

describe('fullAnalysisHub', () => {
  it('filters pillar rows by employee and campaign while keeping all pillars exportable', () => {
    const result = buildFullAnalysisHub({
      users: [user('Mona', 'KSA', 'Coordination'), user('Omar', 'Egypt')],
      tasks: [task('T-1', 'Mona', 'Launch A', true), task('T-2', 'Omar', 'Launch B')],
      campaigns: [campaign('Launch A', 'Mona'), campaign('Launch B', 'Omar')],
      handovers: [handover('H-1', 'Mona', 'Omar', ['T-1'])],
      blockers: [blocker('Mona', 'Launch A')],
      now,
      filters: {
        ...defaultAnalysisFilters('tasks'),
        employee: 'Mona',
        campaign: 'Launch A',
      },
    });

    expect(result.reports.tasks.filteredRows).toHaveLength(1);
    expect(result.reports.tasks.filteredRows[0]).toMatchObject({ Owner: 'Mona', Campaign: 'Launch A' });
    expect(result.reports.campaigns.filteredRows).toHaveLength(1);
    expect(result.reports.handovers.filteredRows).toHaveLength(1);
    expect(result.exportSheets.map((sheet) => sheet.name)).toEqual([
      'Employees',
      'Tasks',
      'Campaigns',
      'Handovers',
      'Blockers',
      'SLA',
      'Teams',
      'Offices',
    ]);
    expect(result.exportSheets.every((sheet) => Array.isArray(sheet.rows))).toBe(true);
  });

  it('applies status, priority, office, and search filters to relevant pillars', () => {
    const result = buildFullAnalysisHub({
      users: [user('Mona', 'KSA', 'Coordination'), user('Omar', 'Egypt')],
      tasks: [task('T-1', 'Mona', 'Launch A'), task('T-2', 'Omar', 'Launch B', true)],
      campaigns: [campaign('Launch A', 'Mona'), { ...campaign('Launch B', 'Omar'), status: 'Closed' }],
      handovers: [handover('H-1', 'Mona', 'Omar', ['T-1'])],
      blockers: [blocker('Mona', 'Launch A')],
      now,
      filters: {
        ...defaultAnalysisFilters('tasks'),
        office: 'KSA',
        status: 'Open',
        priority: 'High',
        search: 'launch a',
      },
    });

    expect(result.reports.tasks.filteredRows).toHaveLength(1);
    expect(result.reports.tasks.filteredRows[0]).toMatchObject({ Owner: 'Mona', Priority: 'High', Status: 'Due Soon' });
    expect(result.reports.employees.filteredRows.map((row) => row.Employee)).toEqual(['Mona']);
    expect(result.reports.campaigns.filteredRows.map((row) => row.Campaign)).toEqual(['Launch A']);
  });

  it('builds a cross-pillar breakdown when one employee is selected', () => {
    const result = buildFullAnalysisHub({
      users: [user('Mona', 'KSA', 'Coordination'), user('Omar', 'Egypt')],
      tasks: [task('T-1', 'Mona', 'Launch A', true), task('T-2', 'Omar', 'Launch B')],
      campaigns: [campaign('Launch A', 'Mona'), campaign('Launch B', 'Omar')],
      handovers: [handover('H-1', 'Mona', 'Omar', ['T-1'])],
      blockers: [blocker('Mona', 'Launch A')],
      now,
      filters: {
        ...defaultAnalysisFilters('employees'),
        employee: 'Mona',
      },
    });

    expect(result.employeeBreakdown?.selectedEmployee).toBe('Mona');
    expect(result.employeeBreakdown?.profile).toMatchObject({ Employee: 'Mona', Team: 'Coordination', Office: 'KSA' });
    expect(result.employeeBreakdown?.pillarCards.map((card) => [card.key, card.value])).toEqual([
      ['tasks', '1'],
      ['campaigns', '1'],
      ['handovers', '1'],
      ['blockers', '1'],
      ['sla', '1'],
      ['teams', 'Coordination'],
      ['offices', 'KSA'],
    ]);
    expect(result.employeeBreakdown?.detailSections.map((section) => [section.key, section.rows.length])).toEqual([
      ['tasks', 1],
      ['campaigns', 1],
      ['handovers', 1],
      ['blockers', 1],
      ['sla', 1],
    ]);
  });
});
