import { supabase } from '../lib/supabase';
import type { Campaign } from '../types';
import type { Json } from '../../types/supabase';

type CampaignRow = {
  id: string;
  name: string;
  country: string;
  city: string;
  status: Campaign['status'];
  stage: number;
  current_owner: string;
  record_health: Campaign['recordHealth'];
  payload: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const toTimestamp = (value?: string | number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return Date.now();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const fromRow = (row: CampaignRow): Campaign => {
  const payload = (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {}) as Partial<Campaign>;

  return {
    ...(payload as Campaign),
    id: row.id,
    name: row.name,
    country: row.country,
    city: row.city,
    status: row.status,
    stage: row.stage as Campaign['stage'],
    currentOwner: row.current_owner,
    recordHealth: row.record_health,
    createdAt: toTimestamp(payload.createdAt ?? row.created_at),
    updatedAt: toTimestamp(payload.updatedAt ?? row.updated_at),
    createdBy: String(payload.createdBy || 'online'),
  };
};

const toRow = (campaign: Campaign, userId?: string | null) => ({
  id: campaign.id,
  name: campaign.name || 'Untitled Campaign',
  country: campaign.country || '',
  city: campaign.city || '',
  status: campaign.status || 'Active',
  stage: Number(campaign.stage || 1),
  current_owner: campaign.currentOwner || '',
  record_health: campaign.recordHealth || 'Healthy',
  payload: campaign as unknown as Json,
  created_by: userId || null,
});

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export const opsCampaignsService = {
  async list(): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('ops_campaigns')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as CampaignRow[]).map(fromRow);
  },

  async upsert(items: Campaign[]) {
    if (!items.length) return { campaigns: await this.list(), inserted: 0, updated: 0 };

    const userId = await currentUserId();
    const ids = items.map((item) => item.id);
    const { data: existing, error: existingError } = await supabase
      .from('ops_campaigns')
      .select('id')
      .in('id', ids);

    if (existingError) throw existingError;

    const existingIds = new Set((existing || []).map((row) => row.id));
    const { error } = await supabase
      .from('ops_campaigns')
      .upsert(items.map((item) => toRow(item, userId)), { onConflict: 'id' });

    if (error) throw error;

    return {
      campaigns: await this.list(),
      inserted: items.filter((item) => !existingIds.has(item.id)).length,
      updated: items.filter((item) => existingIds.has(item.id)).length,
    };
  },

  async create(campaign: Campaign) {
    const result = await this.upsert([campaign]);
    return result.campaigns;
  },

  async update(id: string, updates: Partial<Campaign>) {
    const campaigns = await this.list();
    const existing = campaigns.find((campaign) => campaign.id === id);
    if (!existing) return campaigns;
    return (await this.upsert([{ ...existing, ...updates, updatedAt: Date.now() } as Campaign])).campaigns;
  },

  async remove(id: string) {
    const { error } = await supabase.from('ops_campaigns').delete().eq('id', id);
    if (error) throw error;
    return this.list();
  },
};
