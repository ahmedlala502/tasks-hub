import { Task, Status, Priority, Shift } from '../types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Validate task data before saving
 */
export function validateTask(task: Partial<Task>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Title validation
  if (!task.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Task title is required',
      severity: 'error',
    });
  } else if (task.title.trim().length < 3) {
    errors.push({
      field: 'title',
      message: 'Task title must be at least 3 characters',
      severity: 'error',
    });
  } else if (task.title.length > 200) {
    errors.push({
      field: 'title',
      message: 'Task title must not exceed 200 characters',
      severity: 'error',
    });
  }

  // Owner validation
  if (!task.owner?.trim()) {
    errors.push({
      field: 'owner',
      message: 'Task owner/assignee is required',
      severity: 'error',
    });
  }

  // Priority validation
  if (task.priority && !Object.values(Priority).includes(task.priority)) {
    errors.push({
      field: 'priority',
      message: 'Invalid priority level',
      severity: 'error',
    });
  }

  // Status validation
  if (task.status && !Object.values(Status).includes(task.status)) {
    errors.push({
      field: 'status',
      message: 'Invalid status',
      severity: 'error',
    });
  }

  // Shift validation
  if (task.shift && !Object.values(Shift).includes(task.shift)) {
    errors.push({
      field: 'shift',
      message: 'Invalid shift',
      severity: 'error',
    });
  }

  // Office validation
  if (!task.office?.trim()) {
    errors.push({
      field: 'office',
      message: 'Office is required',
      severity: 'error',
    });
  }

  // Team validation
  if (!task.team?.trim()) {
    errors.push({
      field: 'team',
      message: 'Team is required',
      severity: 'error',
    });
  }

  // Due date validation
  if (task.due) {
    try {
      const dueDate = new Date(task.due);
      if (isNaN(dueDate.getTime())) {
        errors.push({
          field: 'due',
          message: 'Invalid due date',
          severity: 'error',
        });
      } else {
        const now = new Date();
        if (dueDate < now && task.status !== Status.DONE) {
          errors.push({
            field: 'due',
            message: 'Due date is in the past',
            severity: 'warning',
          });
        }
      }
    } catch {
      errors.push({
        field: 'due',
        message: 'Invalid due date format',
        severity: 'error',
      });
    }
  }

  // Details validation
  if (task.details && task.details.length > 2000) {
    errors.push({
      field: 'details',
      message: 'Task description must not exceed 2000 characters',
      severity: 'warning',
    });
  }

  // DOD (Definition of Done) validation
  if (task.dod && Array.isArray(task.dod)) {
    if (task.dod.length > 0 && task.dod.some(d => !d?.trim())) {
      errors.push({
        field: 'dod',
        message: 'Remove empty definition of done items',
        severity: 'warning',
      });
    }
    if (task.dod.length > 10) {
      errors.push({
        field: 'dod',
        message: 'Consider limiting DOD items to 10 or fewer',
        severity: 'info',
      });
    }
  }

  // Estimated hours validation
  if (task.estimatedHours !== undefined) {
    if (typeof task.estimatedHours !== 'number' || task.estimatedHours < 0) {
      errors.push({
        field: 'estimatedHours',
        message: 'Estimated hours must be a positive number',
        severity: 'warning',
      });
    }
    if (task.estimatedHours > 480) {
      errors.push({
        field: 'estimatedHours',
        message: 'Consider breaking down tasks requiring more than 60 working days',
        severity: 'info',
      });
    }
  }

  return errors;
}

/**
 * Suggest improvements for task
 */
export function getTaskSuggestions(task: Partial<Task>): string[] {
  const suggestions: string[] = [];

  // Missing details
  if (!task.details?.trim()) {
    suggestions.push('Add detailed description to clarify task scope');
  } else if (task.details.trim().length < 20) {
    suggestions.push('Provide more detail to ensure clear understanding');
  }

  // Missing DOD
  if (!task.dod || task.dod.length === 0) {
    suggestions.push('Add Definition of Done criteria for clear acceptance');
  }

  // No estimated time
  if (!task.estimatedHours) {
    suggestions.push('Estimate task duration for better planning');
  }

  // High priority but far due
  if (task.priority === Priority.HIGH && task.due) {
    try {
      const dueDate = new Date(task.due);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue > 14) {
        suggestions.push('High priority task with distant due date - consider adjusting priority or due date');
      }
    } catch {
      // Ignore date parsing errors
    }
  }

  // Low priority but near due
  if (task.priority === Priority.LOW && task.due) {
    try {
      const dueDate = new Date(task.due);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 3) {
        suggestions.push('Low priority task with near due date - consider increasing priority');
      }
    } catch {
      // Ignore date parsing errors
    }
  }

  return suggestions;
}

/**
 * Auto-complete task based on similar tasks
 */
export function suggestTaskCompletions(
  partialTitle: string,
  existingTasks: Task[]
): Task[] {
  if (!partialTitle.trim()) return [];

  const searchTerms = partialTitle.toLowerCase().trim();
  return existingTasks
    .filter(t => 
      t.title.toLowerCase().includes(searchTerms) &&
      t.id !== partialTitle // Exclude exact matches
    )
    .slice(0, 5);
}

/**
 * Calculate task complexity
 */
export function getTaskComplexity(task: Partial<Task>): 'low' | 'medium' | 'high' {
  let score = 0;

  // Priority adds complexity
  if (task.priority === Priority.HIGH) score += 2;
  if (task.priority === Priority.MEDIUM) score += 1;

  // Detailed specs add complexity
  if (task.dod && task.dod.length > 3) score += 1;
  if (task.details && task.details.length > 100) score += 1;

  // Estimated hours
  if (task.estimatedHours && task.estimatedHours > 8) score += 1;

  // Dependencies
  if (task.dependencies && task.dependencies.length > 0) score += 1;

  // Blocked status
  if (task.status === Status.BLOCKED) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * Get task status color
 */
export function getTaskStatusColor(status: Status): string {
  switch (status) {
    case Status.DONE:
      return 'bg-emerald/10 text-emerald';
    case Status.IN_PROGRESS:
      return 'bg-sky/10 text-sky';
    case Status.BLOCKED:
      return 'bg-red/10 text-red';
    case Status.WAITING:
      return 'bg-amber/10 text-amber';
    case Status.BACKLOG:
    default:
      return 'bg-stone text-muted';
  }
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case Priority.HIGH:
      return 'bg-red/10 text-red';
    case Priority.MEDIUM:
      return 'bg-amber/10 text-amber';
    case Priority.LOW:
    default:
      return 'bg-blue/10 text-blue';
  }
}

/**
 * Format task for display
 */
export function formatTaskSummary(task: Task): string {
  const parts: string[] = [];
  
  parts.push(`📋 ${task.title}`);
  parts.push(`👤 ${task.owner}`);
  parts.push(`🎯 ${task.priority}`);
  parts.push(`📍 ${task.office}`);
  
  if (task.due) {
    const dueDate = new Date(task.due);
    parts.push(`📅 ${dueDate.toLocaleDateString()}`);
  }

  return parts.join(' • ');
}
