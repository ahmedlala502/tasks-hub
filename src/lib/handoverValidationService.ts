import { Handover, Task } from '../types';

export interface HandoverValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Validate handover data
 */
export function validateHandover(handover: Partial<Handover>, tasks: Task[]): HandoverValidationError[] {
  const errors: HandoverValidationError[] = [];

  // Required fields
  if (!handover.outgoing?.trim()) {
    errors.push({
      field: 'outgoing',
      message: 'Outgoing team member required',
      severity: 'error',
    });
  }

  if (!handover.incoming?.trim()) {
    errors.push({
      field: 'incoming',
      message: 'Incoming team member required',
      severity: 'error',
    });
  }

  if (!handover.date) {
    errors.push({
      field: 'date',
      message: 'Handover date is required',
      severity: 'error',
    });
  }

  if (!handover.fromOffice?.trim()) {
    errors.push({
      field: 'fromOffice',
      message: 'From office is required',
      severity: 'error',
    });
  }

  if (!handover.toOffice?.trim()) {
    errors.push({
      field: 'toOffice',
      message: 'To office is required',
      severity: 'error',
    });
  }

  // Shift validation
  if (!handover.fromShift) {
    errors.push({
      field: 'fromShift',
      message: 'From shift is required',
      severity: 'error',
    });
  }

  if (!handover.toShift) {
    errors.push({
      field: 'toShift',
      message: 'To shift is required',
      severity: 'error',
    });
  }

  // Task validation
  if (!handover.taskIds || handover.taskIds.length === 0) {
    errors.push({
      field: 'taskIds',
      message: 'At least one task must be included in handover',
      severity: 'warning',
    });
  } else {
    const invalidTaskIds = handover.taskIds.filter(
      id => !tasks.find(t => t.id === id)
    );
    if (invalidTaskIds.length > 0) {
      errors.push({
        field: 'taskIds',
        message: `${invalidTaskIds.length} invalid task reference(s)`,
        severity: 'error',
      });
    }
  }

  // Same person check
  if (handover.outgoing === handover.incoming) {
    errors.push({
      field: 'incoming',
      message: 'Outgoing and incoming cannot be the same person',
      severity: 'error',
    });
  }

  // Watchouts validation
  if (handover.watchouts && handover.watchouts.length > 1000) {
    errors.push({
      field: 'watchouts',
      message: 'Watchouts must not exceed 1000 characters',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Get handover readiness score (0-100)
 */
export function getHandoverReadiness(handover: Partial<Handover>, tasks: Task[]): number {
  let score = 0;

  // Has required fields
  if (handover.outgoing?.trim()) score += 15;
  if (handover.incoming?.trim()) score += 15;
  if (handover.date) score += 15;
  if (handover.fromShift && handover.toShift) score += 15;

  // Has tasks
  if (handover.taskIds && handover.taskIds.length > 0) score += 15;

  // Has watchouts/notes
  if (handover.watchouts?.trim()) score += 10;

  // Validate tasks are in completion state
  if (handover.taskIds && handover.taskIds.length > 0) {
    const handoverTasks = tasks.filter(t => handover.taskIds?.includes(t.id));
    const completedOrInProgress = handoverTasks.filter(
      t => t.status === 'Done' || t.status === 'In Progress'
    );
    if (handoverTasks.length > 0 && completedOrInProgress.length === handoverTasks.length) {
      score += 5;
    }
  }

  return Math.min(100, score);
}

/**
 * Get handover quality suggestions
 */
export function getHandoverSuggestions(handover: Partial<Handover>, tasks: Task[]): string[] {
  const suggestions: string[] = [];
  const readiness = getHandoverReadiness(handover, tasks);

  if (!handover.watchouts?.trim()) {
    suggestions.push('Add watchouts/notes to highlight critical issues');
  } else if (handover.watchouts.trim().length < 20) {
    suggestions.push('Provide more detail in watchouts for clarity');
  }

  // Check task states
  if (handover.taskIds && handover.taskIds.length > 0) {
    const handoverTasks = tasks.filter(t => handover.taskIds?.includes(t.id));
    const blockedTasks = handoverTasks.filter(t => t.status === 'Blocked');
    if (blockedTasks.length > 0) {
      suggestions.push(`⚠️ ${blockedTasks.length} blocked task(s) in handover - ensure incoming knows resolution plan`);
    }

    const highPriorityTasks = handoverTasks.filter(t => t.priority === 'High');
    if (highPriorityTasks.length > 0) {
      suggestions.push(`⚡ ${highPriorityTasks.length} high-priority task(s) - incoming should prioritize`);
    }

    const backlogTasks = handoverTasks.filter(t => t.status === 'Backlog');
    if (backlogTasks.length > 0) {
      suggestions.push(`Consider if backlog tasks belong in this handover`);
    }
  }

  if (readiness < 50) {
    suggestions.push('Handover readiness is low - complete more fields before submission');
  }

  return suggestions;
}

/**
 * Check for potential handover issues
 */
export function checkHandoverIssues(
  handover: Partial<Handover>,
  tasks: Task[],
  allHandovers: Handover[]
): string[] {
  const issues: string[] = [];

  // Check for duplicate handovers
  const duplicates = allHandovers.filter(h =>
    h.outgoing === handover.outgoing &&
    h.incoming === handover.incoming &&
    h.date === handover.date &&
    h.status === 'Pending' &&
    h.id !== handover.id
  );
  if (duplicates.length > 0) {
    issues.push('⚠️ Similar pending handover already exists');
  }

  // Check task conflicts
  if (handover.taskIds && handover.taskIds.length > 0) {
    const handoverTasks = tasks.filter(t => handover.taskIds?.includes(t.id));
    const tasksInOtherHandovers = allHandovers
      .filter(h => h.id !== handover.id && h.status === 'Pending')
      .flatMap(h => h.taskIds);

    const conflicting = handoverTasks.filter(t => tasksInOtherHandovers.includes(t.id));
    if (conflicting.length > 0) {
      issues.push(`⚠️ ${conflicting.length} task(s) already in other pending handovers`);
    }
  }

  return issues;
}

/**
 * Get suggested tasks for handover based on current team activity
 */
export function suggestHandoverTasks(
  outgoingMember: string,
  tasks: Task[]
): Task[] {
  return tasks
    .filter(t => t.owner === outgoingMember && t.status !== 'Done')
    .sort((a, b) => {
      // Prioritize by: high priority, in progress, near due date
      if (a.priority !== b.priority) {
        return a.priority === 'High' ? -1 : 1;
      }
      if (a.status !== b.status) {
        return a.status === 'In Progress' ? -1 : 1;
      }
      if (a.due && b.due) {
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      }
      return 0;
    })
    .slice(0, 10);
}

/**
 * Format handover for display/print
 */
export function formatHandoverSummary(handover: Handover, tasks: Task[]): string {
  const handoverTasks = tasks.filter(t => handover.taskIds.includes(t.id));
  const date = new Date(handover.date);

  return `
Handover: ${handover.outgoing} → ${handover.incoming}
Date: ${date.toLocaleDateString()} | ${handover.fromShift} → ${handover.toShift}
From: ${handover.fromOffice} → To: ${handover.toOffice}
Tasks: ${handoverTasks.length}
Status: ${handover.status}
${handover.watchouts ? `Watchouts: ${handover.watchouts}` : ''}
  `.trim();
}

/**
 * Calculate handover completion time estimate
 */
export function estimateHandoverTime(handover: Partial<Handover>, tasks: Task[]): number {
  if (!handover.taskIds || handover.taskIds.length === 0) return 15;

  const handoverTasks = tasks.filter(t => handover.taskIds?.includes(t.id));
  const estimatedMinutes = Math.max(
    15, // Minimum 15 minutes
    Math.ceil(
      handoverTasks.reduce((sum, t) => {
        // Base time per task
        let time = 5;
        // Add time for complex tasks
        if (t.priority === 'High') time += 5;
        if (t.dod && t.dod.length > 3) time += 3;
        if (t.details && t.details.length > 100) time += 3;
        return sum + time;
      }, 0)
    ),
    120 // Max 120 minutes
  );

  return estimatedMinutes;
}
