import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Search, UsersRound } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../App';
import type { OpsUser } from '../auth/types';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { ATTACHED_EXPORT_USERS, dataService } from '../services/dataService';
import { buildOnlineUserRoster, type OnlineUserRow, type OnlineUserStatus } from '../lib/onlineUsers';
import { filterHandoversByRole, filterTasksByRole } from '../lib/workspace';
import { cn } from '../utils';

function uniqueUsers(users: OpsUser[]): OpsUser[] {
  const byName = new Map<string, OpsUser>();
  users.forEach((user) => {
    const key = user.displayName.trim().toLowerCase();
    if (!key || byName.has(key)) return;
    byName.set(key, user);
  });
  return [...byName.values()];
}

function statusTone(status: OnlineUserStatus) {
  if (status === 'online') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-300 dark:border-emerald-900/30';
  if (status === 'idle') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-900/30';
  return 'bg-muted text-muted-foreground border-border';
}

function lastSeen(row: OnlineUserRow) {
  if (!row.lastActiveAt) return 'No activity yet';
  return format(new Date(row.lastActiveAt), 'MMM d, yyyy h:mm a');
}

export default function OnlineUsers() {
  const { role, user } = useAuth();
  const [cloudUsers, setCloudUsers] = useState<OpsUser[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (role !== 'master') return;
    let alive = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers()
        .then((users) => {
          if (alive) setCloudUsers(users);
        })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [role]);

  const users = useMemo(() => uniqueUsers([
    ...DEFAULT_ACCESS_USERS.map((item) => ({
      uid: `seed-${item.email}`,
      email: item.email,
      displayName: item.name,
      role: item.role,
      status: 'active' as const,
      office: item.office,
      department: item.department,
      title: item.title,
      timezone: 'Africa/Cairo',
    })),
    ...ATTACHED_EXPORT_USERS,
    ...cloudUsers,
    ...(user ? [user] : []),
  ]), [cloudUsers, user]);

  const roster = useMemo(() => buildOnlineUserRoster({
    users,
    tasks: filterTasksByRole(role, dataService.getTasks()),
    handovers: filterHandoversByRole(role, dataService.getHandovers()),
  }), [role, users]);

  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return roster;
    return roster.filter((row) =>
      [row.name, row.email, row.office, row.department, row.role, row.status]
        .some((item) => String(item || '').toLowerCase().includes(value)),
    );
  }, [query, roster]);

  const onlineCount = roster.filter((row) => row.status === 'online').length;
  const idleCount = roster.filter((row) => row.status === 'idle').length;

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Live Activity</p>
            <h1 className="font-condensed text-[28px] font-extrabold uppercase tracking-tight">Online Users</h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
              People are marked online from recent cloud login, task, or handover activity inside the active workspace window.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Online" value={onlineCount} tone="text-emerald-600" />
            <Metric label="Idle" value={idleCount} tone="text-amber-600" />
            <Metric label="Tracked" value={roster.length} tone="text-gc-orange" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-gc-orange" />
            <h2 className="text-sm font-extrabold text-foreground">People Active Now</h2>
          </div>
          <label className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="settings-input pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, office, team..."
            />
          </label>
        </div>

        <div className="divide-y divide-border">
          {visibleRows.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Activity className="h-9 w-9 text-gc-orange/60" />
              <p className="text-sm font-semibold">No online activity matches this filter.</p>
            </div>
          ) : visibleRows.map((row) => (
            <div key={row.name} className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', row.status === 'online' ? 'bg-emerald-500' : row.status === 'idle' ? 'bg-amber-500' : 'bg-muted-foreground/40')} />
                  <p className="truncate text-sm font-extrabold text-foreground">{row.name}</p>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{row.email || 'Workspace activity only'}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Office / Team</p>
                <p className="mt-1 text-sm font-bold text-foreground">{row.office || 'Unassigned'} - {row.department || 'Workspace'}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Last Activity</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-gc-orange" />
                  {lastSeen(row)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className={cn('rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest', statusTone(row.status))}>
                  {row.status}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">{row.tasksTouched} tasks / {row.handoversTouched} relays</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
