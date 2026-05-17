import React, { useState, useRef } from 'react';
import {
  Download, Upload, FileJson, FileSpreadsheet, ChevronDown,
  X, Loader2, Shield, CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Handover, Member, Office } from '../types';
import { useLocalData } from './LocalDataContext';
import { exportWorkspaceAsJSON } from '../lib/localStore';
import { addToast } from '../lib/toast';

// ── tiny CSV helper ──────────────────────────────────────────────────────────
function toCSV(headers: string[], rows: (string | number | boolean | undefined | null)[][]): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

function downloadBlob(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Export definitions per page ──────────────────────────────────────────────
type ExportEntry = {
  label: string;
  icon: React.ElementType;
  run: (ctx: ReturnType<typeof useLocalData>) => void;
};

function buildExports(activePage: string): ExportEntry[] {
  const shared: ExportEntry[] = [
    {
      label: 'Full Workspace (JSON)',
      icon: FileJson,
      run: (ctx) => {
        const json = exportWorkspaceAsJSON(ctx.exportWorkspace());
        downloadBlob(json, `trygc-workspace-${today()}.json`, 'application/json');
        ctx.logAction('EXPORT_WORKSPACE_JSON', { page: activePage });
        addToast('Workspace exported as JSON.', 'success', 3000);
      },
    },
    {
      label: 'Tasks CSV',
      icon: FileSpreadsheet,
      run: (ctx) => {
        const ws = ctx.exportWorkspace();
        const csv = toCSV(
          ['ID', 'Title', 'Status', 'Priority', 'Owner', 'Team', 'Office', 'Country', 'Shift', 'Due', 'Carry', 'Created', 'Completed'],
          ws.tasks.map(t => [t.id, t.title, t.status, t.priority, t.owner, t.team, t.office, t.country, t.shift, t.due, t.carry, t.createdAt, t.completedAt ?? ''])
        );
        downloadBlob(csv, `trygc-tasks-${today()}.csv`, 'text/csv');
        ctx.logAction('EXPORT_TASKS_CSV', { count: ws.tasks.length, page: activePage });
        addToast(`${ws.tasks.length} tasks exported.`, 'success', 3000);
      },
    },
    {
      label: 'Handovers CSV',
      icon: FileSpreadsheet,
      run: (ctx) => {
        const ws = ctx.exportWorkspace();
        const csv = toCSV(
          ['ID', 'Date', 'From Shift', 'To Shift', 'From Office', 'To Office', 'Team', 'Country', 'Outgoing', 'Incoming', 'Status', 'Created'],
          ws.handovers.map(h => [h.id, h.date, h.fromShift, h.toShift, h.fromOffice, h.toOffice, h.team ?? '', h.country ?? '', h.outgoing, h.incoming, h.status, h.createdAt])
        );
        downloadBlob(csv, `trygc-handovers-${today()}.csv`, 'text/csv');
        ctx.logAction('EXPORT_HANDOVERS_CSV', { count: ws.handovers.length, page: activePage });
        addToast(`${ws.handovers.length} handovers exported.`, 'success', 3000);
      },
    },
    {
      label: 'Members CSV',
      icon: FileSpreadsheet,
      run: (ctx) => {
        const ws = ctx.exportWorkspace();
        const csv = toCSV(
          ['ID', 'Name', 'Role', 'Team', 'Office', 'Country', 'Status', 'Tasks Completed', 'Handovers Out', 'On Time'],
          ws.members.map(m => [m.id, m.name, m.role ?? '', m.team, m.office, m.country, m.status ?? 'active', m.tasksCompleted, m.handoversOut, m.onTime])
        );
        downloadBlob(csv, `trygc-members-${today()}.csv`, 'text/csv');
        ctx.logAction('EXPORT_MEMBERS_CSV', { count: ws.members.length, page: activePage });
        addToast(`${ws.members.length} members exported.`, 'success', 3000);
      },
    },
    {
      label: 'Offices CSV',
      icon: FileSpreadsheet,
      run: (ctx) => {
        const ws = ctx.exportWorkspace();
        const csv = toCSV(
          ['ID', 'Name', 'Country', 'Lead', 'Shift', 'Timezone', 'Address', 'Phone'],
          ws.offices.map(o => [o.id, o.name, o.country, o.lead, o.shift, o.timezone ?? '', o.address ?? '', o.phone ?? ''])
        );
        downloadBlob(csv, `trygc-offices-${today()}.csv`, 'text/csv');
        ctx.logAction('EXPORT_OFFICES_CSV', { count: ws.offices.length, page: activePage });
        addToast(`${ws.offices.length} offices exported.`, 'success', 3000);
      },
    },
    {
      label: 'Audit Log CSV',
      icon: FileSpreadsheet,
      run: (ctx) => {
        const ws = ctx.exportWorkspace();
        const csv = toCSV(
          ['ID', 'Action', 'User', 'Severity', 'Timestamp', 'Details'],
          ws.auditLogs.map(e => [e.id, e.action, e.userId ?? '', e.severity ?? 'info', e.timestamp, JSON.stringify(e.details)])
        );
        downloadBlob(csv, `trygc-audit-${today()}.csv`, 'text/csv');
        ctx.logAction('EXPORT_AUDIT_CSV', { count: ws.auditLogs.length, page: activePage });
        addToast(`${ws.auditLogs.length} audit events exported.`, 'success', 3000);
      },
    },
  ];

  return shared;
}

// ── Component ────────────────────────────────────────────────────────────────
interface MasterExportBarProps {
  activePage: string;
  filteredData?: {
    tasks?: Task[];
    handovers?: Handover[];
    members?: Member[];
    offices?: Office[];
    label?: string;
  };
}

export default function MasterExportBar({ activePage, filteredData }: MasterExportBarProps) {
  const ctx = useLocalData();
  const { isMasterAdmin, importData, logAction } = ctx;

  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Only render for master admin
  if (!isMasterAdmin) return null;

  const exports = buildExports(activePage);

  // If filtered data is provided, add a filtered export entry
  const hasFiltered = filteredData && (
    filteredData.tasks || filteredData.handovers || filteredData.members || filteredData.offices
  );
  const allExports = hasFiltered
    ? [
        ...exports,
        {
          label: `Export Filtered (${filteredData!.label || 'current view'})`,
          icon: Download,
          run: () => {
            if (filteredData!.tasks) {
              const csv = toCSV(
                ['ID', 'Title', 'Status', 'Priority', 'Owner', 'Team', 'Office', 'Country', 'Shift', 'Due', 'Carry', 'Created'],
                filteredData!.tasks!.map((t: Task) => [t.id, t.title, t.status, t.priority, t.owner, t.team, t.office, t.country, t.shift, t.due, t.carry, t.createdAt])
              );
              downloadBlob(csv, `trygc-filtered-tasks-${today()}.csv`, 'text/csv');
              ctx.logAction('EXPORT_FILTERED_TASKS_CSV', { count: filteredData!.tasks!.length, page: activePage });
              addToast(`${filteredData!.tasks!.length} filtered tasks exported.`, 'success', 3000);
            } else if (filteredData!.handovers) {
              const csv = toCSV(
                ['ID', 'Date', 'From Shift', 'To Shift', 'Outgoing', 'Incoming', 'Status', 'Team'],
                filteredData!.handovers!.map((h: Handover) => [h.id, h.date, h.fromShift, h.toShift, h.outgoing, h.incoming, h.status, h.team])
              );
              downloadBlob(csv, `trygc-filtered-handovers-${today()}.csv`, 'text/csv');
            } else if (filteredData!.members) {
              const csv = toCSV(
                ['ID', 'Name', 'Role', 'Team', 'Office', 'Country', 'Tasks Completed', 'Handovers Out'],
                filteredData!.members!.map((m: Member) => [m.id, m.name, m.role, m.team, m.office, m.country, m.tasksCompleted, m.handoversOut])
              );
              downloadBlob(csv, `trygc-filtered-members-${today()}.csv`, 'text/csv');
            } else if (filteredData!.offices) {
              const csv = toCSV(
                ['ID', 'Name', 'Country', 'Lead', 'Shift', 'Timezone'],
                filteredData!.offices!.map((o: Office) => [o.id, o.name, o.country, o.lead, o.shift, o.timezone])
              );
              downloadBlob(csv, `trygc-filtered-offices-${today()}.csv`, 'text/csv');
            }
          },
        },
      ]
    : exports;

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ok = importData(text);
      setImporting(false);
      if (ok) {
        setImported(true);
        logAction('IMPORT_WORKSPACE_JSON', { filename: file.name });
        setTimeout(() => setImported(false), 3000);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {/* Floating bar */}
      <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white border border-dawn rounded-2xl shadow-2xl shadow-ink/10 overflow-hidden min-w-[230px]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-dawn bg-stone/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-citrus" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-ink">Master Controls</span>
                </div>
                <button onClick={() => setOpen(false)} className="p-0.5 text-muted hover:text-ink transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Export items */}
              <div className="py-1.5">
                <p className="px-4 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-muted/50">Export</p>
                {allExports.map((exp) => {
                  const Icon = exp.icon;
                  return (
                    <button
                      key={exp.label}
                      onClick={() => { exp.run(ctx); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-ink hover:bg-stone/60 transition-colors text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-citrus shrink-0" />
                      {exp.label}
                    </button>
                  );
                })}
              </div>

              {/* Import */}
              <div className="border-t border-dawn py-1.5">
                <p className="px-4 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-muted/50">Import</p>
                <button
                  onClick={() => { fileRef.current?.click(); setOpen(false); }}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-ink hover:bg-stone/60 transition-colors text-left disabled:opacity-50"
                >
                  {importing
                    ? <Loader2 className="w-3.5 h-3.5 text-citrus animate-spin shrink-0" />
                    : <Upload className="w-3.5 h-3.5 text-citrus shrink-0" />
                  }
                  Import Workspace JSON
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger button */}
        <motion.button
          onClick={() => setOpen(v => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
            open
              ? 'bg-ink text-white shadow-ink/20'
              : 'bg-citrus text-white shadow-citrus/30 hover:bg-citrus/90'
          }`}
          title="Master export / import controls"
        >
          {imported ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{imported ? 'Imported!' : 'Export / Import'}</span>
          <Shield className="w-3 h-3 opacity-60" />
          <ChevronDown
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </motion.button>
      </div>
    </>
  );
}
