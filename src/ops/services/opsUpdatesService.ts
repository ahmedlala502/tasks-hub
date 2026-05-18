import type { UpdateFeedItem } from '../lib/opsPageInsights';
import { supabase } from '../lib/supabase';
import type { NotificationTone } from './notificationService';
import type { TablesUpdate } from '../../types/supabase';

export type OpsUpdateTone = NotificationTone;
export type TickerDirection = 'left' | 'right';

export type OpsUpdate = {
  id: string;
  title: string;
  detail: string;
  campaignId: string | null;
  campaignName: string | null;
  tone: OpsUpdateTone;
  surfaceNotification: boolean;
  surfaceTicker: boolean;
  active: boolean;
  pinned: boolean;
  tickerDirection: TickerDirection;
  tickerSpeedSeconds: number;
  owner: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpsUpdateDraft = {
  title: string;
  detail: string;
  campaignId?: string;
  campaignName?: string;
  tone: OpsUpdateTone;
  surfaceNotification: boolean;
  surfaceTicker: boolean;
  active: boolean;
  pinned: boolean;
  tickerDirection: TickerDirection;
  tickerSpeedSeconds: number;
  owner: string;
};

const DEFAULT_LIMIT = 80;

function asTone(value: string | null | undefined): OpsUpdateTone {
  return value === 'red' || value === 'purple' || value === 'green' ? value : 'orange';
}

function asDirection(value: string | null | undefined): TickerDirection {
  return value === 'right' ? 'right' : 'left';
}

function mapRow(row: {
  id: string;
  title: string;
  detail: string;
  campaign_id?: string | null;
  campaign_name?: string | null;
  tone: string;
  surface_notification: boolean;
  surface_ticker: boolean;
  active: boolean;
  pinned: boolean;
  ticker_direction: string;
  ticker_speed_seconds: number;
  owner: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): OpsUpdate {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    campaignId: row.campaign_id ?? null,
    campaignName: row.campaign_name ?? null,
    tone: asTone(row.tone),
    surfaceNotification: row.surface_notification,
    surfaceTicker: row.surface_ticker,
    active: row.active,
    pinned: row.pinned,
    tickerDirection: asDirection(row.ticker_direction),
    tickerSpeedSeconds: row.ticker_speed_seconds,
    owner: row.owner,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPayload(draft: OpsUpdateDraft, createdBy?: string | null) {
  return {
    title: draft.title.trim(),
    detail: draft.detail.trim(),
    campaign_id: draft.campaignId?.trim() || null,
    campaign_name: draft.campaignName?.trim() || null,
    tone: draft.tone,
    surface_notification: draft.surfaceNotification,
    surface_ticker: draft.surfaceTicker,
    active: draft.active,
    pinned: draft.pinned,
    ticker_direction: draft.tickerDirection,
    ticker_speed_seconds: draft.tickerSpeedSeconds,
    owner: draft.owner.trim() || 'Workspace',
    ...(createdBy !== undefined ? { created_by: createdBy } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function toFeedItem(update: OpsUpdate): UpdateFeedItem {
  return {
    id: `ops-update-${update.id}`,
    kind: 'blocker',
    title: update.pinned ? `Pinned: ${update.title}` : update.title,
    detail: update.detail,
    campaignId: update.campaignId,
    campaignName: update.campaignName,
    owner: update.owner,
    at: new Date(update.updatedAt || update.createdAt).getTime(),
    tone: update.tone,
  };
}

export const opsUpdatesService = {
  async list(limit = DEFAULT_LIMIT): Promise<OpsUpdate[]> {
    const { data, error } = await supabase
      .from('ops_updates')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async listActive(limit = DEFAULT_LIMIT): Promise<OpsUpdate[]> {
    const { data, error } = await supabase
      .from('ops_updates')
      .select('*')
      .eq('active', true)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async create(draft: OpsUpdateDraft): Promise<OpsUpdate> {
    const { data: sessionData } = await supabase.auth.getSession();
    const createdBy = sessionData.session?.user?.id ?? null;
    const { data, error } = await supabase
      .from('ops_updates')
      .insert(toPayload(draft, createdBy))
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  async update(id: string, draft: Partial<OpsUpdateDraft>): Promise<OpsUpdate> {
    const payload: TablesUpdate<'ops_updates'> = {
      updated_at: new Date().toISOString(),
    };

    if (draft.title !== undefined) payload.title = draft.title.trim();
    if (draft.detail !== undefined) payload.detail = draft.detail.trim();
    if (draft.campaignId !== undefined) payload.campaign_id = draft.campaignId.trim() || null;
    if (draft.campaignName !== undefined) payload.campaign_name = draft.campaignName.trim() || null;
    if (draft.tone !== undefined) payload.tone = draft.tone;
    if (draft.surfaceNotification !== undefined) payload.surface_notification = draft.surfaceNotification;
    if (draft.surfaceTicker !== undefined) payload.surface_ticker = draft.surfaceTicker;
    if (draft.active !== undefined) payload.active = draft.active;
    if (draft.pinned !== undefined) payload.pinned = draft.pinned;
    if (draft.tickerDirection !== undefined) payload.ticker_direction = draft.tickerDirection;
    if (draft.tickerSpeedSeconds !== undefined) payload.ticker_speed_seconds = draft.tickerSpeedSeconds;
    if (draft.owner !== undefined) payload.owner = draft.owner.trim() || 'Workspace';

    const { data, error } = await supabase
      .from('ops_updates')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('ops_updates').delete().eq('id', id);
    if (error) throw error;
  },
};
