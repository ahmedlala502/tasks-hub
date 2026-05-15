import { supabase } from '../ops/lib/supabase';
import { Task, Handover, Office, Member, User, WorkspaceUser, PendingSignupRequest } from '../types';
import { WorkspaceSettings, AuditEvent } from './localStore';

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
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as WorkspaceUser[];
  }

  async saveUser(user: WorkspaceUser) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...user, workspace_id: this.workspaceId, updated_at: new Date().toISOString() })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUser(email: string, patch: Partial<WorkspaceUser>) {
    const { data, error } = await supabase
      .from('workspace_' as any)
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
      .from('workspace_' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('email', email);
    
    if (error) throw error;
  }

  // Tasks
  async getTasks() {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as Task[];
  }

  async saveTask(task: Task) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...task, workspace_id: this.workspaceId, updated_at: new Date().toISOString() })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteTasks(ids: string[]) {
    const { error } = await supabase
      .from('workspace_' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .in('id', ids);
    
    if (error) throw error;
  }

  // Handovers
  async getHandovers() {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as Handover[];
  }

  async saveHandover(handover: Handover) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...handover, workspace_id: this.workspaceId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateHandover(id: string, patch: Partial<Handover>) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .update(patch)
      .eq('workspace_id', this.workspaceId)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteHandover(id: string) {
    const { error } = await supabase
      .from('workspace_' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Offices
  async getOffices() {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as Office[];
  }

  async saveOffice(office: Office) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...office, workspace_id: this.workspaceId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateOffice(id: string, patch: Partial<Office>) {
    const { data, error } = await supabase
      .from('workspace_' as any)
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
      .from('workspace_' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Members
  async getMembers() {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId);
    
    if (error) throw error;
    return data as unknown as Member[];
  }

  async saveMember(member: Member) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...member, workspace_id: this.workspaceId, updated_at: new Date().toISOString() })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateMember(id: string, patch: Partial<Member>) {
    const { data, error } = await supabase
      .from('workspace_' as any)
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
      .from('workspace_' as any)
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('id', id);
    
    if (error) throw error;
  }

  // Settings
  async getSettings() {
    const { data, error } = await supabase
      .from('workspace_' as any)
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
      .from('workspace_' as any)
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
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as unknown as AuditEvent[];
  }

  async logAudit(event: AuditEvent) {
    const { error } = await supabase
      .from('workspace_' as any)
      .insert({ ...event, workspace_id: this.workspaceId });
    
    if (error) throw error;
  }

  // Signup Requests
  async getSignupRequests() {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('requested_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as PendingSignupRequest[];
  }

  async saveSignupRequest(request: PendingSignupRequest) {
    const { data, error } = await supabase
      .from('workspace_' as any)
      .upsert({ ...request, workspace_id: this.workspaceId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteSignupRequest(id: string) {
    const { error } = await supabase
      .from('workspace_' as any)
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
        callback
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
        callback
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
        supabase.from('workspace_' as any).upsert({ ...u, workspace_id: this.workspaceId })
      ),
      ...workspace.tasks.map((t: any) =>
        supabase.from('workspace_' as any).upsert({ ...t, workspace_id: this.workspaceId })
      ),
      ...workspace.handovers.map((h: any) =>
        supabase.from('workspace_' as any).upsert({ ...h, workspace_id: this.workspaceId })
      ),
      ...workspace.offices.map((o: any) =>
        supabase.from('workspace_' as any).upsert({ ...o, workspace_id: this.workspaceId })
      ),
      ...workspace.members.map((m: any) =>
        supabase.from('workspace_' as any).upsert({ ...m, workspace_id: this.workspaceId })
      ),
      workspace.settings && supabase.from('workspace_' as any).upsert({
        workspace_id: this.workspaceId,
        settings: workspace.settings,
      }),
      ...workspace.auditLogs.slice(0, 200).map((log: any) =>
        supabase.from('workspace_' as any).insert({ ...log, workspace_id: this.workspaceId })
      ),
      ...workspace.pendingSignups.map((s: any) =>
        supabase.from('workspace_' as any).upsert({ ...s, workspace_id: this.workspaceId })
      ),
    ]);
  }
}

export const cloudStore = CloudStore.getInstance();
