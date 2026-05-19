import { describe, expect, it } from 'vitest';
import { buildPersonalPerformanceLinks, buildUserProfileHeader, getPrimaryProfileMetrics } from './userProfileView';

const summary = {
  tasks: 18,
  done: 11,
  inProgress: 4,
  pending: 2,
  blocked: 1,
  completionRate: 61,
  campaigns: 3,
  creators: 5,
  handovers: 2,
};

describe('user profile view model', () => {
  it('keeps the top profile metrics focused on everyday work', () => {
    expect(getPrimaryProfileMetrics(summary).map((item) => item.label)).toEqual([
      'Done',
      'In Progress',
      'Pending',
      'Blocked',
    ]);
  });

  it('uses simple titles for performance and profile contexts', () => {
    expect(buildUserProfileHeader({
      viewedName: 'Shahd',
      isPerformancePage: true,
      isTargetUser: true,
      role: 'community',
      office: 'KSA',
      email: 'shahd@trygc.com',
    })).toMatchObject({
      eyebrow: 'Performance',
      title: 'Shahd',
      detail: 'community - KSA',
    });

    expect(buildUserProfileHeader({
      viewedName: 'Admin User',
      isPerformancePage: false,
      isTargetUser: false,
      role: 'master',
      office: 'Egypt',
      email: 'admin@trygc.com',
    })).toMatchObject({
      eyebrow: 'My Profile',
      title: 'Admin User',
      detail: 'admin@trygc.com',
    });
  });

  it('builds clickable personal performance destinations', () => {
    expect(buildPersonalPerformanceLinks('Shahd', {
      assignedTo: 5,
      assignedBy: 3,
      completed: 2,
      blocked: 1,
      handovers: 4,
      total: 8,
    })).toEqual([
      { label: 'Assigned To', value: 5, to: '/tasks?user=Shahd&work=assigned', tone: 'orange' },
      { label: 'Assigned By', value: 3, to: '/tasks?user=Shahd&work=created', tone: 'purple' },
      { label: 'Completed', value: 2, to: '/tasks?user=Shahd&work=done', tone: 'green' },
      { label: 'Blocked', value: 1, to: '/tasks?user=Shahd&work=blocked', tone: 'red' },
      { label: 'Handovers', value: 4, to: '/handover?person=Shahd', tone: 'indigo' },
      { label: 'Total Work', value: 8, to: '/tasks?user=Shahd&work=all', tone: 'neutral' },
    ]);
  });
});
