import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { dataService } from '../services/dataService';
import type { UserActivityLog } from '../services/cloudWorkspaceService';
import { cn } from '../lib/utils';

const ACTION_TONES: Record<string, string> = {
  created: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  updated: 'border-orange-200 bg-orange-50 text-gc-orange dark:border-orange-900/40 dark:bg-orange-900/20',
  deleted: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300',
  imported: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/40 dark:bg-purple-900/20 dark:text-purple-300',
  viewed: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<UserActivityLog[]>(() => dataService.getActivityLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshLogs = async () => {
    setLoading(true);
    await dataService.initializeCloudWorkspace();
    setLogs(await dataService.refreshActivityLogs(250));
    setLoading(false);
  };

  useEffect(() => {
    void refreshLogs();
  }, []);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) => [
      log.userName,
      log.userEmail,
      log.action,
      log.entityType,
      log.entityId,
      log.summary,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [logs, searchTerm]);

  const dataEvents = logs.filter((log) => ['created', 'updated', 'deleted', 'imported', 'exported'].some((key) => log.action.includes(key))).length;
  const userEvents = logs.filter((log) => log.entityType === 'user').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Master Audit</div>
          <h1 className="font-condensed text-[24px] font-extrabold tracking-tight uppercase">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every captured tool action, data change, page visit, export, and account event saved in Supabase.</p>
        </div>
        <button
          onClick={refreshLogs}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-extrabold uppercase tracking-wide text-foreground hover:border-gc-orange hover:text-gc-orange disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AuditMetric icon={Activity} label="Captured Events" value={logs.length.toString()} />
        <AuditMetric icon={Database} label="Data Actions" value={dataEvents.toString()} tone="orange" />
        <AuditMetric icon={ShieldCheck} label="User Events" value={userEvents.toString()} tone="purple" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search activity..."
            className="h-9 border-border bg-card pl-10 text-[12.5px]"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="py-3 font-condensed text-[10px] uppercase tracking-[1px] text-muted-foreground/60">Timestamp</TableHead>
              <TableHead className="py-3 font-condensed text-[10px] uppercase tracking-[1px] text-muted-foreground/60">User</TableHead>
              <TableHead className="py-3 font-condensed text-[10px] uppercase tracking-[1px] text-muted-foreground/60">Action</TableHead>
              <TableHead className="py-3 font-condensed text-[10px] uppercase tracking-[1px] text-muted-foreground/60">Resource</TableHead>
              <TableHead className="py-3 font-condensed text-[10px] uppercase tracking-[1px] text-muted-foreground/60">Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center font-mono text-[11px] text-muted-foreground/40">
                  NO AUDIT ACTIVITY FOUND
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id} className="group border-border transition-colors hover:bg-secondary/30">
                  <TableCell>
                    <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(log.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[12px] font-bold font-condensed uppercase tracking-tight">{log.userName || log.userEmail || 'System'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', getActionTone(log.action))}>
                      {formatAction(log.action)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] font-mono uppercase tracking-tight text-muted-foreground">
                      {log.entityType}{log.entityId ? ` / ${log.entityId}` : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-xl truncate text-[12px] font-semibold text-foreground">{log.summary}</p>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AuditMetric({ icon: Icon, label, value, tone = 'green' }: { icon: React.ElementType; label: string; value: string; tone?: 'green' | 'orange' | 'purple' }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
    orange: 'border-orange-200 bg-orange-50 text-gc-orange dark:border-orange-900/40 dark:bg-orange-900/20',
    purple: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/40 dark:bg-purple-900/20 dark:text-purple-300',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', tones[tone])}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-black text-foreground">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function formatAction(action: string) {
  return action.split('.').map((part) => part.replace(/_/g, ' ')).join(' ');
}

function getActionTone(action: string) {
  const key = Object.keys(ACTION_TONES).find((item) => action.includes(item));
  return ACTION_TONES[key || 'viewed'];
}
