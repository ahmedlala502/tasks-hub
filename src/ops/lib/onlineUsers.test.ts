import { describe, expect, it } from 'vitest';
import type { Handover, Task } from '../types';
import { buildOnlineUserRoster } from './onlineUsers';

const now = new Date('2026-05-13T12:00:00Z').getTime();

const task = (ownerId: string, updatedAt: number): Task => ({
  id: `T-${ownerId}`,
  title: 'Task',
  description: '',
  ownerId,
  dueDate: now,
  campaignId: 'Campaign',
  priority: 'Medium',
  completed: false,
  createdAt: updatedAt,
  updatedAt,
  createdBy: 'test',
});

const handover = (outgoingLead: string, incomingLead: string, updatedAt: number): Handover => ({
  id: `H-${outgoingLead}`,
  handoffDate: '2026-05-13',
  fromShift: 'Morning',
  toShift: 'Mid',
  team: 'Operations',
  region: 'KSA',
  outgoingLead,
  incomingLead,
  status: 'Acknowledged',
  notes: '',
  taskIds: [],
  createdAt: updatedAt,
  updatedAt,
  acknowledgedAt: updatedAt,
  createdBy: 'test',
});

describe('onlineUsers', () => {
  it('builds a real activity roster from cloud users, tasks, and handovers', () => {
    const roster = buildOnlineUserRoster({
      now,
      users: [
        {
          uid: '1',
          email: 'nada@test.com',
          displayName: 'Nada',
          role: 'operations',
          status: 'active',
          office: 'Egypt',
          department: 'Operations',
          title: 'Ops',
          timezone: 'Africa/Cairo',
          lastSignInAt: new Date(now - 1000 * 60 * 30).toISOString(),
        },
      ],
      tasks: [
        task('Nada', now - 1000 * 60 * 20),
        task('Nurhan', now - 1000 * 60 * 60 * 18),
      ],
      handovers: [handover('Nada', 'Nurhan', now - 1000 * 60 * 15)],
    });

    expect(roster.map((row) => [row.name, row.status])).toContainEqual(['Nada', 'online']);
    expect(roster.map((row) => [row.name, row.status])).toContainEqual(['Nurhan', 'online']);
    expect(roster.find((row) => row.name === 'Nada')?.source).toBe('cloud');
  });
});
