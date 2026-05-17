export enum ActionType {
  TASK_CREATE = 'TASK_CREATE',
  TASK_UPDATE = 'TASK_UPDATE',
  TASK_DELETE = 'TASK_DELETE',
  HANDOVER_INITIATE = 'HANDOVER_INITIATE',
  HANDOVER_ACKNOWLEDGE = 'HANDOVER_ACKNOWLEDGE',
  OFFICE_REGISTER = 'OFFICE_REGISTER',
  OFFICE_UPDATE = 'OFFICE_UPDATE',
  OFFICE_DELETE = 'OFFICE_DELETE',
  MEMBER_CREATE = 'MEMBER_CREATE',
  MEMBER_UPDATE = 'MEMBER_UPDATE',
  MEMBER_DELETE = 'MEMBER_DELETE',
  SYSTEM_RESET = 'SYSTEM_RESET',
  AI_INTERACTION = 'AI_INTERACTION'
}

export async function logAction(action: ActionType, details: any) {
  const raw = localStorage.getItem('trygc_flowos_audit_fallback');
  const events = raw ? JSON.parse(raw) : [];
  events.unshift({ action, details, timestamp: new Date().toISOString() });
  localStorage.setItem('trygc_flowos_audit_fallback', JSON.stringify(events.slice(0, 100)));
}
