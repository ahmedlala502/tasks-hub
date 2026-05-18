import { getOperationalTaskStatus } from './opsPageInsights';
import type { Handover, Task } from '../types';

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

export function isPersonMatch(personName: string | undefined | null, candidate: string | undefined | null): boolean {
  const person = normalize(personName);
  const other = normalize(candidate);
  if (!person || !other) return false;
  return person === other || person.includes(other) || other.includes(person);
}

export function isTaskAssignedToUser(task: Task, displayName: string): boolean {
  return isPersonMatch(task.ownerId, displayName);
}

export function isTaskCreatedByUser(task: Task, displayName: string): boolean {
  return isPersonMatch(task.createdBy, displayName);
}

export function isHandoverForUser(handover: Handover, displayName: string): boolean {
  return [
    ...(handover.assignFrom || []),
    ...(handover.assignTo || []),
    handover.outgoingLead || '',
    handover.incomingLead || '',
  ].some((name) => isPersonMatch(name, displayName));
}

export function getTaskAssignmentRecipient(previous: Task | undefined, next: Task): string | null {
  const owner = next.ownerId?.trim();
  if (!owner) return null;
  if (!previous) return owner;
  return isPersonMatch(previous.ownerId, owner) ? null : owner;
}

export function getNewHandoverRecipients(previous: Handover | undefined, next: Handover): string[] {
  const previousRecipients = new Set((previous?.assignTo || []).map(normalize).filter(Boolean));
  return (next.assignTo || [])
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((item) => isPersonMatch(item, name)) === index)
    .filter((name) => !previousRecipients.has(normalize(name)));
}

export function getPersonalWork(displayName: string, tasks: Task[], handovers: Handover[]) {
  const assignedTasks = tasks
    .filter((task) => isTaskAssignedToUser(task, displayName) && getOperationalTaskStatus(task) !== 'Done')
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

  const completedTasks = tasks
    .filter((task) => isTaskAssignedToUser(task, displayName) && getOperationalTaskStatus(task) === 'Done')
    .sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt) - (a.completedAt || a.updatedAt || a.createdAt));

  const createdTasks = tasks
    .filter((task) => isTaskCreatedByUser(task, displayName) && !isTaskAssignedToUser(task, displayName))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  const userHandovers = handovers
    .filter((handover) => isHandoverForUser(handover, displayName))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  return {
    assignedTasks,
    completedTasks,
    createdTasks,
    handovers: userHandovers,
  };
}
