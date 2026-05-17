import { supabase } from '../lib/supabase';
import type { Blocker, Campaign, CampaignInfluencer, Handover, Task } from '../types';

export type WorkspaceRecordType = 'campaigns' | 'influencers' | 'blockers' | 'tasks' | 'handovers';

export type WorkspaceData = {
  campaigns: Campaign[];
  influencers: CampaignInfluencer[];
  blockers: Blocker[];
  tasks: Task[];
  handovers: Handover[];
};

export type UserActivityLog = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ActivityDraft = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

const RECORD_KEY_PREFIX = 'default:';
const RECORD_TYPES: WorkspaceRecordType[] = ['campaigns', 'influencers', 'blockers', 'tasks', 'handovers'];

function getRecordKey(recordType: WorkspaceRecordType) {
  return `${RECORD_KEY_PREFIX}${recordType}`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getProfileText(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapActivityRow(row: any): UserActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at,
  };
}

export const cloudWorkspaceService = {
  async loadWorkspace(): Promise<Partial<WorkspaceData>> {
    const { data, error } = await supabase
      .from('ops_workspace_records' as any)
      .select('record_type,payload');

    if (error) throw error;

    return (data || []).reduce<Partial<WorkspaceData>>((acc, row: any) => {
      if (RECORD_TYPES.includes(row.record_type)) {
        (acc as any)[row.record_type] = asArray(row.payload);
      }
      return acc;
    }, {});
  },

  async saveRecord(recordType: WorkspaceRecordType, payload: unknown[]): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const updatedBy = sessionData.session?.user?.id ?? null;
    const { error } = await supabase
      .from('ops_workspace_records' as any)
      .upsert({
        record_key: getRecordKey(recordType),
        record_type: recordType,
        payload,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  async saveWorkspace(data: WorkspaceData): Promise<void> {
    await Promise.all(RECORD_TYPES.map((recordType) => this.saveRecord(recordType, data[recordType])));
  },

  async logActivity(draft: ActivityDraft): Promise<UserActivityLog | null> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    const userMetadata = user?.user_metadata as Record<string, unknown> | undefined;
    const displayName =
      getProfileText(userMetadata, 'display_name') ||
      getProfileText(userMetadata, 'full_name') ||
      getProfileText(userMetadata, 'name') ||
      user?.email?.split('@')[0] ||
      null;

    const { data, error } = await supabase
      .from('ops_activity_logs' as any)
      .insert({
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        user_name: displayName,
        action: draft.action,
        entity_type: draft.entityType,
        entity_id: draft.entityId ?? null,
        summary: draft.summary,
        metadata: draft.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return data ? mapActivityRow(data) : null;
  },

  async listActivity(limit = 120): Promise<UserActivityLog[]> {
    const { data, error } = await supabase
      .from('ops_activity_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapActivityRow);
  },
};
