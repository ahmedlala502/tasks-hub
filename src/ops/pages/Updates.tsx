import React, { useMemo, useState } from 'react';
import { Calendar, Megaphone, Plus, Search, Trophy } from 'lucide-react';
import { dataService } from '../services/dataService';
import { buildUpdatesFeed, type UpdateFeedItem } from '../lib/opsPageInsights';
import { cn } from '../lib/utils';

type ManualUpdate = UpdateFeedItem;

function loadManualUpdates(): ManualUpdate[] {
  try {
    return JSON.parse(localStorage.getItem('trygc-manual-updates') || '[]');
  } catch {
    return [];
  }
}

export default function Updates() {
  const [query, setQuery] = useState('');
  const [manualUpdates, setManualUpdates] = useState<ManualUpdate[]>(loadManualUpdates);
  const [draft, setDraft] = useState({ title: '', detail: '' });
  const generatedFeed = useMemo(() => buildUpdatesFeed(
    dataService.getCampaigns(),
    dataService.getTasks(),
    dataService.getBlockers(),
    dataService.getHandovers(),
  ), []);
  const feed = [...manualUpdates, ...generatedFeed]
    .filter((item) => `${item.title} ${item.detail} ${item.owner}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.at - a.at);

  const addUpdate = () => {
    if (!draft.title.trim() || !draft.detail.trim()) return;
    const next = [{
      id: `manual-${Date.now()}`,
      kind: 'campaign' as const,
      title: draft.title.trim(),
      detail: draft.detail.trim(),
      owner: 'Workspace',
      at: Date.now(),
      tone: 'purple' as const,
    }, ...manualUpdates];
    setManualUpdates(next);
    localStorage.setItem('trygc-manual-updates', JSON.stringify(next));
    setDraft({ title: '', detail: '' });
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Updates</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Workspace Updates Feed</h2>
            <p className="mt-1 text-sm text-muted-foreground">Campaign, task, blocker, handover, and manual update stream.</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gc-orange/10 text-gc-orange">
            <Trophy size={22} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="settings-input pl-9" placeholder="Search updates..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground">
            {feed.length} updates
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
          <input className="settings-input" placeholder="Update title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <div className="flex gap-2">
            <input className="settings-input" placeholder="What changed?" value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} />
            <button onClick={addUpdate} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-3 text-xs font-bold text-white hover:bg-gc-orange/90">
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {feed.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border', toneClass(item.tone))}>
                <Megaphone size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{item.kind}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                  <Calendar size={12} />
                  {new Date(item.at).toLocaleString()} - {item.owner}
                </div>
              </div>
            </div>
          </div>
        ))}
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
