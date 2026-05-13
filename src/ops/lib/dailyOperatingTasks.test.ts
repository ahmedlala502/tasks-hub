import { describe, expect, it } from 'vitest';
import {
  DAILY_OPERATING_TASK_TEMPLATES,
  completeDailyTask,
  ensureDailyOperatingTasks,
  getDailyTaskDateKey,
  getDueReminderCandidates,
} from './dailyOperatingTasks';
import type { Task } from '../types';

const morning = new Date('2026-05-13T08:30:00+02:00').getTime();

describe('daily operating tasks', () => {
  it('covers the GC operating rhythm and all department task groups', () => {
    const departments = new Set(DAILY_OPERATING_TASK_TEMPLATES.map((task) => task.department));

    expect(departments).toEqual(expect.any(Set));
    expect(departments).toContain('Operating Rhythm');
    expect(departments).toContain('Onboarding');
    expect(departments).toContain('WhatsApp / Live Chat');
    expect(departments).toContain('Coverage & Monitoring');
    expect(departments).toContain('Coordination');
    expect(departments).toContain('Quality & Training');
    expect(departments).toContain('Systems & Automation');
    expect(departments).toContain('Activation');
    expect(departments).toContain('Account Managers');
    expect(departments).toContain('Data Analysis');
    expect(departments).toContain('Campaign Launch Checklist');
    expect(departments).toContain('Management Follow-Up');
    expect(departments).toContain('End-of-Day Report');

    expect(
      DAILY_OPERATING_TASK_TEMPLATES.some((task) =>
        task.title.includes('Assign or redistribute tasks') &&
        task.reminderTimes.join('|').includes('05:00') &&
        task.reminderTimes.join('|').includes('22:00'),
      ),
    ).toBe(true);
    expect(
      DAILY_OPERATING_TASK_TEMPLATES.some((task) =>
        task.title.includes('Reschedule missed visits') &&
        task.reminderTimes.includes('23:00'),
      ),
    ).toBe(true);
  });

  it('creates one daily instance per template and is idempotent for the same date', () => {
    const firstRun = ensureDailyOperatingTasks([], morning);
    const secondRun = ensureDailyOperatingTasks(firstRun.tasks, morning);

    expect(firstRun.createdCount).toBe(DAILY_OPERATING_TASK_TEMPLATES.length);
    expect(secondRun.createdCount).toBe(0);
    expect(secondRun.tasks).toHaveLength(firstRun.tasks.length);
    expect(firstRun.tasks.every((task) => task.dailyTaskDate === '2026-05-13')).toBe(true);
    expect(firstRun.tasks.every((task) => task.reminders && task.reminders.length > 0)).toBe(true);
    expect(firstRun.tasks.every((task) => task.flags && task.flags.length > 0)).toBe(true);
  });

  it('creates a fresh set on the next operating date', () => {
    const firstRun = ensureDailyOperatingTasks([], morning);
    const nextMorning = new Date('2026-05-14T08:30:00+02:00').getTime();
    const secondDay = ensureDailyOperatingTasks(firstRun.tasks, nextMorning);

    expect(getDailyTaskDateKey(nextMorning)).toBe('2026-05-14');
    expect(secondDay.createdCount).toBe(DAILY_OPERATING_TASK_TEMPLATES.length);
    expect(secondDay.tasks.filter((task) => task.dailyTaskDate === '2026-05-14')).toHaveLength(
      DAILY_OPERATING_TASK_TEMPLATES.length,
    );
  });

  it('marks completion with completed flags and a timestamp', () => {
    const task = ensureDailyOperatingTasks([], morning).tasks[0];
    const completed = completeDailyTask(task, morning + 1000);

    expect(completed.completed).toBe(true);
    expect(completed.completedAt).toBe(morning + 1000);
    expect(completed.flags?.every((flag) => flag.resolved)).toBe(true);
  });

  it('returns due reminder candidates without repeating already notified reminders', () => {
    const { tasks } = ensureDailyOperatingTasks([], morning);
    const assignmentTask = tasks.find((task) => task.title.includes('Assign or redistribute tasks')) as Task;
    const dueAtEight = assignmentTask.reminders?.find((reminder) => reminder.label.includes('08:00'))?.dueAt;

    const candidates = getDueReminderCandidates([assignmentTask], morning, new Set());
    const skipped = getDueReminderCandidates([assignmentTask], morning, new Set([`${assignmentTask.id}:${dueAtEight}`]));

    expect(dueAtEight).toEqual(expect.any(Number));
    expect(candidates.some((item) => item.reminder.dueAt === dueAtEight)).toBe(true);
    expect(skipped.some((item) => item.reminder.dueAt === dueAtEight)).toBe(false);
  });
});
