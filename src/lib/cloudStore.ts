import { supabase } from '../ops/lib/supabase';
import { Task, Handover, Office, Member, User, WorkspaceUser, PendingSignupRequest } from '../types';
import { WorkspaceSettings, AuditEvent } from './localStore';

type TaskRow = {
  id: string;
  workspace_id?: string;
  title: string;
  country?: string | null;
  office?: string | null;
  team?: string | null;
  owner?: string | null;
  shift?: string | null;
  priority?: string | null;
  status?: string | null;
  due?: string | null;
  campaign?: string | null;
  details?: string | null;
  carry?: boolean | null;
  dod?: string[] | null;
  reminders?: Task['reminders'] | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator_id?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  dependencies?: string[] | null;
  tags?: string[] | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  blocked_reason?: string | null;
  blocked_since?: string | null;
  synced_at?: string | null;
  local_only?: boolean | null;
};

type HandoverRow = {
  id: string;
  workspace_id?: string;
  date?: string | null;
  from_shift?: string | null;
  to_shift?: string | null;
  from_office?: string | null;
  to_office?: string | null;
  team?: string | null;
  country?: string | null;
  outgoing?: string | null;
  incoming?: string | null;
  status?: Handover['status'] | null;
  watchouts?: string | null;
  task_ids?: string[] | null;
  created_at?: string | null;
  ack_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_comment?: string | null;
  review_history?: Handover['reviewHistory'] | null;
  creator_id?: string | null;
  template_id?: string | null;
  quality?: Handover['quality'] | null;
  issues?: string[] | null;
  synced_at?: string | null;
  local_only?: boolean | null;
};

function compactRow<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export function toTaskRow(task: Partial<Task>, workspaceId: string): Partial<TaskRow> {
  return compactRow({
    id: task.id,
    workspace_id: workspaceId,
    title: task.title,
    country: task.country,
    office: task.office,
    team: task.team,
    owner: task.owner,
    shift: task.shift,
    priority: task.priority,
    status: task.status,
    due: task.due,
    campaign: task.campaign,
    details: task.details,
    carry: task.carry,
    dod: task.dod,
    reminders: task.reminders,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    creator_id: task.creatorId,
    completed_at: task.completedAt,
    completed_by: task.completedBy,
    dependencies: task.dependencies,
    tags: task.tags,
    estimated_hours: task.estimatedHours,
    actual_hours: task.actualHours,
    blocked_reason: task.blockedReason,
    blocked_since: task.blockedSince,
    synced_at: task.syncedAt,
    local_only: task.localOnly,
  });
}

export function fromTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    country: row.country || '',
    office: row.office || '',
    team: row.team || '',
    owner: row.owner || '',
    shift: row.shift as Task['shift'],
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    due: row.due || '',
    campaign: row.campaign || undefined,
    details: row.details || undefined,
    carry: row.carry || false,
    dod: row.dod || undefined,
    reminders: row.reminders || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    creatorId: row.creator_id || '',
    completedAt: row.completed_at || undefined,
    completedBy: row.completed_by || undefined,
    dependencies: row.dependencies || undefined,
    tags: row.tags || undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    actualHours: row.actual_hours ?? undefined,
    blockedReason: row.blocked_reason || undefined,
    blockedSince: row.blocked_since || undefined,
    syncedAt: row.synced_at || undefined,
    localOnly: row.local_only ?? undefined,
  };
}

export function toHandoverRow(handover: Partial<Handover>, workspaceId: string): Partial<HandoverRow> {
  return compactRow({
    id: handover.id,
    workspace_id: workspaceId,
    date: handover.date,
    from_shift: handover.fromShift,
    to_shift: handover.toShift,
    from_office: handover.fromOffice,
    to_office: handover.toOffice,
    team: handover.team,
    country: handover.country,
    outgoing: handover.outgoing,
    incoming: handover.incoming,
    status: handover.status,
    watchouts: handover.watchouts,
    task_ids: handover.taskIds,
    created_at: handover.createdAt,
    ack_at: handover.ackAt,
    reviewed_by: handover.reviewedBy,
    reviewed_at: handover.reviewedAt,
    review_comment: handover.reviewComment,
    review_history: handover.reviewHistory,
    creator_id: handover.creatorId,
    template_id: handover.templateId,
    quality: handover.quality,
    issues: handover.issues,
    synced_at: handover.syncedAt,
    local_only: handover.localOnly,
  });
}

export function fromHandoverRow(row: HandoverRow): Handover {
  return {
    id: row.id,
    date: row.date || '',
    fromShift: row.from_shift as Handover['fromShift'],
    toShift: row.to_shift as Handover['toShift'],
    fromOffice: row.from_office || '',
    toOffice: row.to_office || '',
    team: row.team || undefined,
    country: row.country || undefined,
    outgoing: row.outgoing || '',
    incoming: row.incoming || '',
    status: row.status || 'Pending',
    watchouts: row.watchouts || undefined,
    taskIds: row.task_ids || [],
    createdAt: row.created_at || new Date().toISOString(),
    ackAt: row.ack_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewComment: row.review_comment || undefined,
    reviewHistory: row.review_history || undefined,
    creatorId: row.creator_id || '',
    templateId: row.template_id || undefined,
    quality: row.quality || undefined,
    issues: row.issues || undefined,
    syncedAt: row.synced_at || undefined,
    localOnly: row.local_only ?? undefined,
  };
}

export interface CloudWorkspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class CloudStore {
  private static instance: CloudStore;
  private workspaceId: string = 'default';
  private subscriptions: any[] = [];

  static getInstance(): CloudStore {
    if (!CloudStore.instance) {
      CloudStore.instance = new CloudStore();
    }
    return CloudStore.instance;
  }

  setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  async init() {
    const { data: workspace, error } = await supabase
      .from('workspaces' as any)
      .select('id')
      .eq('id', this.workspaceId)
      .single();
    
    if (error || !workspace) {
      await supabase
        .from('workspaces' as any)
        .insert({
          id: this.workspaceId,
          name: 'TryGC Hub Workspace',
        });
    }
  }

  // Users
  async getUsers() {
    const { data, error } = await supabase
      .from('workspace_users' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as WorkspaceUser[];
  }

  async saveUser(user: WorkspaceUser) {
    const { data, error } = await supabase
      .from('workspace_users' as any)
      .upsert({ ...user, workspace_id: this.workspaceId, updated_at: new Date().toISOString() })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUser(email: string, patch: Partial<WorkspaceUser>) {
    const { data, error } = await supabase
      .from('workspace_users' as any)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', this.workspaceId)
      .eq('email', email)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteUser(email: string) {
    const { error } = await supabase
      .from('workspace_users' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('email', email);
    
    if (error) throw error;
  }

  // Tasks
  async getTasks() {
    const { data, error } = await supabase
      .from('workspace_tasks' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return ((data || []) as unknown as TaskRow[]).map(fromTaskRow);
  }

  async saveTask(task: Task) {
    const { data, error } = await supabase
      .from('workspace_tasks' as any)
      .upsert(toTaskRow({ ...task, updatedAt: task.updatedAt || new Date().toISOString() }, this.workspaceId))
      .select()
      .single();
    
    if (error) throw error;
    return fromTaskRow(data as unknown as TaskRow);
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const { data, error } = await supabase
      .from('workspace_tasks' as any)
      .update(toTaskRow({ ...patch, updatedAt: new Date().toISOString() }, this.workspaceId))
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return fromTaskRow(data as unknown as TaskRow);
  }

  async deleteTasks(ids: string[]) {
    const { error } = await supabase
      .from('workspace_tasks' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .in('id', ids);
    
    if (error) throw error;
  }

  // Handovers
  async getHandovers() {
    const { data, error } = await supabase
      .from('workspace_handovers' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return ((data || []) as unknown as HandoverRow[]).map(fromHandoverRow);
  }

  async saveHandover(handover: Handover) {
    const { data, error } = await supabase
      .from('workspace_handovers' as any)
      .upsert(toHandoverRow(handover, this.workspaceId))
      .select()
      .single();
    
    if (error) throw error;
    return fromHandoverRow(data as unknown as HandoverRow);
  }

  async updateHandover(id: string, patch: Partial<Handover>) {
    const { data, error } = await supabase
      .from('workspace_handovers' as any)
      .update(toHandoverRow(patch, this.workspaceId))
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return fromHandoverRow(data as unknown as HandoverRow);
  }

  async deleteHandover(id: string) {
    const { error } = await supabase
      .from('workspace_handovers' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Offices
  async getOffices() {
    const { data, error } = await supabase
      .from('workspace_offices' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as Office[];
  }

  async saveOffice(office: Office) {
    const { data, error } = await supabase
      .from('workspace_offices' as any)
      .upsert({ ...office, workspace_id: this.workspaceId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateOffice(id: string, patch: Partial<Office>) {
    const { data, error } = await supabase
      .from('workspace_offices' as any)
      .update(patch)
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteOffice(id: string) {
    const { error } = await supabase
      .from('workspace_offices' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Members
  async getMembers() {
    const { data, error } = await supabase
      .from('workspace_members' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as Member[];
  }

  async saveMember(member: Member) {
    const { data, error } = await supabase
      .from('workspace_members' as any)
      .upsert({ ...member, workspace_id: this.workspaceId, updated_at: new Date().toISOString() })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateMember(id: string, patch: Partial<Member>) {
    const { data, error } = await supabase
      .from('workspace_members' as any)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteMember(id: string) {
    const { error } = await supabase
      .from('workspace_members' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Settings
  async getSettings() {
    const { data, error } = await supabase
      .from('workspace_settings' as any)
      .select('settings')
      .eq('workspace_id', this.workspaceId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return (data as unknown as any)?.settings as WorkspaceSettings | null;
  }

  async saveSettings(settings: WorkspaceSettings) {
    const { data, error } = await supabase
      .from('workspace_settings' as any)
      .upsert({
        workspace_id: this.workspaceId,
        settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Audit Logs
  async getAuditLogs(limit = 200) {
    const { data, error } = await supabase
      .from('workspace_audit_logs' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as unknown as AuditEvent[];
  }

  async logAudit(event: AuditEvent) {
    const { error } = await supabase
      .from('workspace_audit_logs' as any)
      .insert({ ...event, workspace_id: this.workspaceId });
    
    if (error) throw error;
  }

  // Signup Requests
  async getSignupRequests() {
    const { data, error } = await supabase
      .from('workspace_signup_requests' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data as unknown as PendingSignupRequest[];
  }

  async saveSignupRequest(request: PendingSignupRequest) {
    const { data, error } = await supabase
      .from('workspace_signup_requests' as any)
      .upsert({ ...request, workspace_id: this.workspaceId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteSignupRequest(id: string) {
    const { error } = await supabase
      .from('workspace_signup_requests' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Real-time subscriptions
  subscribeToTasks(callback: (payload: any) => void) {
    const sub = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_tasks', filter: `workspace_id=eq.${this.workspaceId}` },
        payload => callback({
          ...payload,
          new: payload.new ? fromTaskRow(payload.new as TaskRow) : payload.new,
          old: payload.old ? fromTaskRow(payload.old as TaskRow) : payload.old,
        })
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToHandovers(callback: (payload: any) => void) {
    const sub = supabase
      .channel('handovers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_handovers', filter: `workspace_id=eq.${this.workspaceId}` },
        payload => callback({
          ...payload,
          new: payload.new ? fromHandoverRow(payload.new as HandoverRow) : payload.new,
          old: payload.old ? fromHandoverRow(payload.old as HandoverRow) : payload.old,
        })
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToUsers(callback: (payload: any) => void) {
    const sub = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_users', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToMembers(callback: (payload: any) => void) {
    const sub = supabase
      .channel('members-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToOffices(callback: (payload: any) => void) {
    const sub = supabase
      .channel('offices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_offices', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToSettings(callback: (payload: any) => void) {
    const sub = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_settings', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToAuditLogs(callback: (payload: any) => void) {
    const sub = supabase
      .channel('audit-logs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_audit_logs', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();

    this.subscriptions.push(sub);
    return sub;
  }

  subscribeToSignupRequests(callback: (payload: any) => void) {
    const sub = supabase
      .channel('signups-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_signup_requests', filter: `workspace_id=eq.${this.workspaceId}` },
        callback
      )
      .subscribe();
    
    this.subscriptions.push(sub);
    return sub;
  }

  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  // Migration helper: import from localStorage format
  async migrateFromLocal(workspace: any) {
    await Promise.all([
      supabase.from('workspaces' as any).upsert({
        id: this.workspaceId,
        name: workspace.settings?.name || 'TryGC Hub Workspace',
      }),
      ...workspace.users.map((u: any) =>
        supabase.from('workspace_users' as any).upsert({ ...u, workspace_id: this.workspaceId })
      ),
      ...workspace.tasks.map((t: any) =>
        supabase.from('workspace_tasks' as any).upsert(toTaskRow(t, this.workspaceId))
      ),
      ...workspace.handovers.map((h: any) =>
        supabase.from('workspace_handovers' as any).upsert(toHandoverRow(h, this.workspaceId))
      ),
      ...workspace.offices.map((o: any) =>
        supabase.from('workspace_offices' as any).upsert({ ...o, workspace_id: this.workspaceId })
      ),
      ...workspace.members.map((m: any) =>
        supabase.from('workspace_members' as any).upsert({ ...m, workspace_id: this.workspaceId })
      ),
      workspace.settings && supabase.from('workspace_settings' as any).upsert({
        workspace_id: this.workspaceId,
        settings: workspace.settings,
      }),
      ...workspace.auditLogs.slice(0, 200).map((log: any) =>
        supabase.from('workspace_audit_logs' as any).insert({ ...log, workspace_id: this.workspaceId })
      ),
      ...workspace.pendingSignups.map((s: any) =>
        supabase.from('workspace_signup_requests' as any).upsert({ ...s, workspace_id: this.workspaceId })
      ),
    ]);
  }
}

export const cloudStore = CloudStore.getInstance();
