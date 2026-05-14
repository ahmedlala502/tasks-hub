import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Edit3,
  Megaphone,
  PauseCircle,
  Pin,
  RadioTower,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { buildUpdatesFeed, type UpdateFeedItem } from '../lib/opsPageInsights';
import { dataService } from '../services/dataService';
import {
  opsUpdatesService,
  type OpsUpdate,
  type OpsUpdateDraft,
  type OpsUpdateTone,
  type TickerDirection,
  toFeedItem,
} from '../services/opsUpdatesService';

type DraftState = OpsUpdateDraft;

const blankDraft = (owner = 'Workspace'): DraftState => ({
  title: '',
  detail: '',
  tone: 'orange',
  surfaceNotification: true,
  surfaceTicker: true,
  active: true,
  pinned: false,
  tickerDirection: 'left',
  tickerSpeedSeconds: 70,
  owner,
});

const toneOptions: Array<{ value: OpsUpdateTone; label: string }> = [
  { value: 'orange', label: 'Review' },
  { value: 'red', label: 'Urgent' },
  { value: 'purple', label: 'Event' },
  { value: 'green', label: 'Done' },
];

export default function Updates() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [updates, setUpdates] = useState<OpsUpdate[]>([]);
  const [draft, setDraft] = useState<DraftState>(() => blankDraft(user?.displayName || 'Workspace'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const generatedFeed = useMemo(() => buildUpdatesFeed(
    dataService.getCampaigns(),
    dataService.getTasks(),
    dataService.getBlockers(),
    dataService.getHandovers(),
  ), []);

  const loadUpdates = async () => {
    setLoading(true);
    try {
      setUpdates(await opsUpdatesService.list());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load online updates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUpdates();
  }, []);

  const onlineFeed = updates.filter((item) => item.active).map(toFeedItem);
  const feed = [...onlineFeed, ...generatedFeed]
    .filter((item) => `${item.title} ${item.detail} ${item.owner}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.at - a.at);

  const sliderCount = updates.filter((item) => item.active && item.surfaceTicker).length;
  const notificationCount = updates.filter((item) => item.active && item.surfaceNotification).length;

  const submitUpdate = async () => {
    if (!draft.title.trim() || !draft.detail.trim()) {
      setMessage('Title and update details are required.');
      return;
    }

    if (!draft.surfaceNotification && !draft.surfaceTicker) {
      setMessage('Choose notification, moving slider, or both.');
      return;
    }

    setSaving(true);
    try {
      const saved = editingId
        ? await opsUpdatesService.update(editingId, draft)
        : await opsUpdatesService.create(draft);
      setUpdates((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        return [saved, ...withoutSaved].sort(sortUpdates);
      });
      setDraft(blankDraft(user?.displayName || 'Workspace'));
      setEditingId(null);
      setMessage(editingId ? 'Online update saved.' : 'Online update published.');
      window.dispatchEvent(new CustomEvent('gc-online-updates-refresh'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save online update.');
    } finally {
      setSaving(false);
    }
  };

  const editUpdate = (item: OpsUpdate) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      detail: item.detail,
      tone: item.tone,
      surfaceNotification: item.surfaceNotification,
      surfaceTicker: item.surfaceTicker,
      active: item.active,
      pinned: item.pinned,
      tickerDirection: item.tickerDirection,
      tickerSpeedSeconds: item.tickerSpeedSeconds,
      owner: item.owner,
    });
    setMessage('');
  };

  const quickPatch = async (item: OpsUpdate, patch: Partial<DraftState>) => {
    try {
      const saved = await opsUpdatesService.update(item.id, patch);
      setUpdates((current) => current.map((row) => row.id === saved.id ? saved : row).sort(sortUpdates));
      window.dispatchEvent(new CustomEvent('gc-online-updates-refresh'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update online item.');
    }
  };

  const deleteUpdate = async (item: OpsUpdate) => {
    try {
      await opsUpdatesService.remove(item.id);
      setUpdates((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) {
        setEditingId(null);
        setDraft(blankDraft(user?.displayName || 'Workspace'));
      }
      window.dispatchEvent(new CustomEvent('gc-online-updates-refresh'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete online item.');
    }
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Updates</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Publish Center</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create online announcements for the notification drawer, moving slider, or both.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[280px]">
            <Stat label="Slider" value={sliderCount} icon={RadioTower} />
            <Stat label="Notifications" value={notificationCount} icon={Bell} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-foreground">Publish Update</h3>
              <p className="mt-1 text-xs text-muted-foreground">Choose whether this appears in notifications, the moving slider, or both.</p>
            </div>
            <span className="rounded-full border border-gc-orange/20 bg-gc-orange/10 px-2.5 py-1 text-[10px] font-bold uppercase text-gc-orange">
              {editingId ? 'Editing' : 'New'}
            </span>
          </div>

          <div className="space-y-3">
            <input className="settings-input font-bold" placeholder="Update title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <textarea className="settings-input min-h-24 resize-none" placeholder="What should everyone know?" value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tone</span>
                <select className="settings-input" value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value as OpsUpdateTone })}>
                  {toneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Owner</span>
                <input className="settings-input" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleTile icon={Bell} title="Notification" desc="Show inside alerts panel." active={draft.surfaceNotification} onClick={() => setDraft({ ...draft, surfaceNotification: !draft.surfaceNotification })} />
              <ToggleTile icon={RadioTower} title="Moving Slider" desc="Show in dashboard ticker." active={draft.surfaceTicker} onClick={() => setDraft({ ...draft, surfaceTicker: !draft.surfaceTicker })} />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
              <ToggleTile icon={Pin} title="Pinned" desc="Prioritize first." active={draft.pinned} onClick={() => setDraft({ ...draft, pinned: !draft.pinned })} compact />
              <ToggleTile icon={PauseCircle} title="Active" desc="Visible online." active={draft.active} onClick={() => setDraft({ ...draft, active: !draft.active })} compact />
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Slider Direction</span>
                <select className="settings-input" value={draft.tickerDirection} onChange={(event) => setDraft({ ...draft, tickerDirection: event.target.value as TickerDirection })}>
                  <option value="left">Right to left</option>
                  <option value="right">Left to right</option>
                </select>
              </label>
            </div>

            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Slider Speed</span>
                <span className="text-xs font-bold text-foreground">{draft.tickerSpeedSeconds}s</span>
              </div>
              <input
                type="range"
                min={20}
                max={160}
                step={5}
                value={draft.tickerSpeedSeconds}
                onChange={(event) => setDraft({ ...draft, tickerSpeedSeconds: Number(event.target.value) })}
                className="w-full accent-gc-orange"
              />
            </label>

            {message && <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground">{message}</div>}

            <div className="flex flex-wrap gap-2">
              <button onClick={submitUpdate} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90 disabled:opacity-60">
                {editingId ? <Check size={15} /> : <Send size={15} />}
                {saving ? 'Saving...' : editingId ? 'Save Update' : 'Publish Online'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setDraft(blankDraft(user?.displayName || 'Workspace')); }} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                  Cancel edit
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-extrabold text-foreground">Manage Online Updates</h3>
              <p className="mt-1 text-xs text-muted-foreground">Edit routing, pinning, and visibility without redeploying.</p>
            </div>
            <div className="relative min-w-[240px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="settings-input pl-9" placeholder="Search updates..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="rounded-lg border border-border bg-background p-4 text-sm font-bold text-muted-foreground">Loading online updates...</div>
            ) : updates.length === 0 ? (
              <div className="rounded-lg border border-border bg-background p-4 text-sm font-bold text-muted-foreground">No online updates yet.</div>
            ) : (
              updates
                .filter((item) => `${item.title} ${item.detail} ${item.owner}`.toLowerCase().includes(query.toLowerCase()))
                .map((item) => (
                  <div key={item.id} className={cn('rounded-lg border border-border bg-background p-3', !item.active && 'opacity-60')}>
                    <div className="flex items-start gap-3">
                      <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border', toneClass(item.tone))}>
                        <Megaphone size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-extrabold text-foreground">{item.title}</p>
                          {item.pinned && <Badge label="Pinned" />}
                          {item.surfaceNotification && <Badge label="Notification" />}
                          {item.surfaceTicker && <Badge label="Slider" />}
                          {!item.active && <Badge label="Paused" />}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.owner} - {new Date(item.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="mini-action" onClick={() => editUpdate(item)}><Edit3 size={13} /> Edit</button>
                      <button className="mini-action" onClick={() => quickPatch(item, { active: !item.active })}>{item.active ? 'Pause' : 'Activate'}</button>
                      <button className="mini-action" onClick={() => quickPatch(item, { pinned: !item.pinned })}>{item.pinned ? 'Unpin' : 'Pin'}</button>
                      <button className="mini-action" onClick={() => quickPatch(item, { surfaceNotification: !item.surfaceNotification })}>Notification</button>
                      <button className="mini-action" onClick={() => quickPatch(item, { surfaceTicker: !item.surfaceTicker })}>Slider</button>
                      <button className="mini-action text-red-600 hover:border-red-300 hover:text-red-700" onClick={() => deleteUpdate(item)}><Trash2 size={13} /> Delete</button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-foreground">Combined Feed</h3>
            <p className="mt-1 text-xs text-muted-foreground">Online announcements plus automatic activity updates.</p>
          </div>
          <span className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground">{feed.length} updates</span>
        </div>
        <div className="space-y-3">
          {feed.slice(0, 18).map((item) => <FeedCard key={item.id} item={item} />)}
        </div>
      </section>
    </div>
  );
}

function sortUpdates(a: OpsUpdate, b: OpsUpdate) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <Icon size={15} className="mx-auto mb-1 text-gc-orange" />
      <p className="text-lg font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ToggleTile({ icon: Icon, title, desc, active, compact, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; desc: string; active: boolean; compact?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-gc-orange bg-gc-orange/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground',
        compact && 'p-2.5'
      )}
    >
      <Icon size={16} className={active ? 'text-gc-orange' : 'text-muted-foreground'} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold">{title}</span>
        <span className="block text-[10px] font-semibold text-muted-foreground">{desc}</span>
      </span>
      {active && <Check size={14} className="text-gc-orange" />}
    </button>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{label}</span>;
}

function FeedCard({ item }: { item: UpdateFeedItem }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border', toneClass(item.tone))}>
          <Megaphone size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">{item.title}</p>
            <Badge label={item.kind} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{new Date(item.at).toLocaleString()} - {item.owner}</p>
        </div>
      </div>
    </div>
  );
}

function toneClass(tone: UpdateFeedItem['tone']) {
  if (tone === 'green') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600';
  if (tone === 'red') return 'border-red-500/20 bg-red-500/10 text-red-600';
  if (tone === 'purple') return 'border-gc-purple/20 bg-gc-purple/10 text-gc-purple';
  return 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange';
}
