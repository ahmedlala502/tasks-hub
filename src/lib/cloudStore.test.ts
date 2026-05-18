import { describe, expect, it } from 'vitest';
import { Priority, Shift, Status, type Handover, type Task } from '../types';
import {
  fromHandoverRow,
  fromTaskRow,
  toHandoverRow,
  toTaskRow,
} from './cloudStore';

describe('cloudStore row mapping', () => {
  it('writes tasks with Supabase column names and reads them back as app tasks', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Follow campaign handover',
      country: 'SA',
      office: 'Riyadh',
      team: 'Operations',
      owner: 'Sara',
      shift: Shift.MORNING,
      priority: Priority.HIGH,
      status: Status.IN_PROGRESS,
      due: '2026-05-19T08:00:00.000Z',
      campaign: 'May Launch',
      details: 'Prepare all updates before shift change.',
      carry: true,
      dod: ['Update sheet'],
      reminders: [],
      createdAt: '2026-05-18T08:00:00.000Z',
      updatedAt: '2026-05-18T09:00:00.000Z',
      creatorId: 'owner@trygc.com',
      completedAt: '2026-05-18T10:00:00.000Z',
      completedBy: 'Sara',
      dependencies: ['task-0'],
      tags: ['handover'],
      estimatedHours: 2,
      actualHours: 1.5,
      blockedReason: 'Waiting approval',
      blockedSince: '2026-05-18T09:30:00.000Z',
      syncedAt: '2026-05-18T10:05:00.000Z',
      localOnly: false,
    };

    const row = toTaskRow(task, 'default');

    expect(row).toMatchObject({
      id: 'task-1',
      workspace_id: 'default',
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      creator_id: task.creatorId,
      completed_at: task.completedAt,
      completed_by: task.completedBy,
      estimated_hours: task.estimatedHours,
      actual_hours: task.actualHours,
      blocked_reason: task.blockedReason,
      blocked_since: task.blockedSince,
      synced_at: task.syncedAt,
      local_only: task.localOnly,
    });
    expect(row).not.toHaveProperty('createdAt');
    expect(row).not.toHaveProperty('creatorId');

    expect(fromTaskRow(row as any)).toMatchObject(task);
  });

  it('writes handovers with Supabase column names and reads them back as app handovers', () => {
    const handover: Handover = {
      id: 'handover-1',
      date: '2026-05-18',
      fromShift: Shift.MORNING,
      toShift: Shift.MID,
      fromOffice: 'Riyadh',
      toOffice: 'Jeddah',
      team: 'Operations',
      country: 'SA',
      outgoing: 'Sara',
      incoming: 'Omar',
      status: 'Acknowledged',
      watchouts: 'Check client approval.',
      taskIds: ['task-1'],
      createdAt: '2026-05-18T08:00:00.000Z',
      ackAt: '2026-05-18T12:00:00.000Z',
      reviewedBy: 'Omar',
      reviewedAt: '2026-05-18T12:05:00.000Z',
      reviewComment: 'Ready.',
      reviewHistory: [{ id: 'review-1', reviewer: 'Omar', reviewedAt: '2026-05-18T12:05:00.000Z', comment: 'Ready.', action: 'Acknowledged' }],
      creatorId: 'owner@trygc.com',
      templateId: 'template-1',
      quality: 'good',
      issues: ['none'],
      syncedAt: '2026-05-18T12:06:00.000Z',
      localOnly: false,
    };

    const row = toHandoverRow(handover, 'default');

    expect(row).toMatchObject({
      id: 'handover-1',
      workspace_id: 'default',
      from_shift: handover.fromShift,
      to_shift: handover.toShift,
      from_office: handover.fromOffice,
      to_office: handover.toOffice,
      task_ids: handover.taskIds,
      created_at: handover.createdAt,
      ack_at: handover.ackAt,
      reviewed_by: handover.reviewedBy,
      reviewed_at: handover.reviewedAt,
      review_comment: handover.reviewComment,
      review_history: handover.reviewHistory,
      creator_id: handover.creatorId,
      template_id: handover.templateId,
      synced_at: handover.syncedAt,
      local_only: handover.localOnly,
    });
    expect(row).not.toHaveProperty('fromShift');
    expect(row).not.toHaveProperty('taskIds');

    expect(fromHandoverRow(row as any)).toMatchObject(handover);
  });
});
