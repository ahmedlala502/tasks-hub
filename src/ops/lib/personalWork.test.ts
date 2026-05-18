import { describe, expect, it } from 'vitest';
import { getPersonalWork, getTaskAssignmentRecipient, isPersonMatch } from './personalWork';
import type { Handover, Task } from '../types';

const baseTask: Task = {
  id: 't-1',
  title: 'Send brief',
  description: '',
  ownerId: 'Nour Zein',
  dueDate: Date.now(),
  campaignId: 'Campaign A',
  priority: 'Medium',
  completed: false,
  status: 'In Progress',
  createdAt: 1,
  updatedAt: 1,
  createdBy: 'Ahmed Maher',
};

const baseHandover: Handover = {
  id: 'h-1',
  handoffDate: '2026-05-18',
  fromShift: 'Morning',
  toShift: 'Mid',
  team: 'Operations',
  region: 'Regional',
  outgoingLead: 'Ahmed Maher',
  incomingLead: 'Nour Zein',
  assignFrom: ['Ahmed Maher'],
  assignTo: ['Nour Zein'],
  notes: '',
  taskIds: ['t-1'],
  status: 'Pending',
  createdAt: 1,
  updatedAt: 1,
  createdBy: 'Ahmed Maher',
};

describe('personal work helpers', () => {
  it('matches display names safely across abbreviated owner strings', () => {
    expect(isPersonMatch('Nour Zein', 'nour')).toBe(true);
    expect(isPersonMatch('Nour Zein', 'Ahmed Maher')).toBe(false);
  });

  it('splits assigned, completed, created, and handover work for a user', () => {
    const completed = { ...baseTask, id: 't-2', completed: true, status: 'Done' as const, completedAt: 10, updatedAt: 10 };
    const createdForOther = { ...baseTask, id: 't-3', ownerId: 'Lamia', createdBy: 'Nour Zein' };
    const work = getPersonalWork('Nour Zein', [baseTask, completed, createdForOther], [baseHandover]);

    expect(work.assignedTasks.map((task) => task.id)).toEqual(['t-1']);
    expect(work.completedTasks.map((task) => task.id)).toEqual(['t-2']);
    expect(work.createdTasks.map((task) => task.id)).toEqual(['t-3']);
    expect(work.handovers.map((handover) => handover.id)).toEqual(['h-1']);
  });

  it('detects new or changed task assignment recipients', () => {
    expect(getTaskAssignmentRecipient(undefined, baseTask)).toBe('Nour Zein');
    expect(getTaskAssignmentRecipient({ ...baseTask, ownerId: 'Ahmed Maher' }, baseTask)).toBe('Nour Zein');
    expect(getTaskAssignmentRecipient({ ...baseTask }, baseTask)).toBeNull();
  });
});
