import React, { useRef, useState } from 'react';
import { Download, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../App';
import { readSpreadsheet } from '../services/spreadsheetService';

interface PreviewRow<T> {
  index: number;
  parsed: T;
  errors: string[];
}

interface Props<T> {
  label?: string;
  title: string;
  templateHeaders: string[];
  parse: (rows: Record<string, any>[]) => T[];
  validate: (entity: T) => string[];
  commit: (entities: T[]) => Promise<{ inserted: number; updated: number }>;
  onDone?: () => void;
}

export function BulkUploadButton<T>({
  label = 'Bulk Upload',
  title,
  templateHeaders,
  parse,
  validate,
  commit,
  onDone,
}: Props<T>) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  if (role !== 'master') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-accent"
      >
        <Upload size={14} /> {label}
      </button>
      {open && (
        <BulkUploadDialog
          title={title}
          templateHeaders={templateHeaders}
          parse={parse}
          validate={validate}
          commit={commit}
          onClose={() => {
            setOpen(false);
            onDone?.();
          }}
        />
      )}
    </>
  );
}

function BulkUploadDialog<T>({
  title,
  templateHeaders,
  parse,
  validate,
  commit,
  onClose,
}: Omit<Props<T>, 'label' | 'onDone'> & { onClose: () => void }) {
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<PreviewRow<T>[]>([]);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validCount = preview.filter(p => p.errors.length === 0).length;
  const errorCount = preview.length - validCount;

  const onFile = async (file?: File) => {
    setError('');
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const rows = await readSpreadsheet(file);
      if (rows.length === 0) {
        setError('No rows found in the file.');
        setPreview([]);
        return;
      }
      const parsed = parse(rows);
      setPreview(
        parsed.map((p, i) => ({
          index: i + 2,
          parsed: p,
          errors: validate(p),
        })),
      );
    } catch (e) {
      console.error(e);
      setError('Could not parse the file. Check it is a valid CSV or XLSX.');
      setPreview([]);
    }
  };

  const handleCommit = async () => {
    const valid = preview.filter(p => p.errors.length === 0).map(p => p.parsed);
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      const res = await commit(valid);
      setResult(res);
      setPreview([]);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Commit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const sampleValues = templateHeaders.map((header) => {
      const key = header.toLowerCase();
      if (key === 'id') return 'C-BULK-001';
      if (key === 'name') return 'Ramadan Launch KSA';
      if (key === 'country') return 'KSA';
      if (key === 'city') return 'Riyadh';
      if (key === 'platforms') return 'Instagram; TikTok';
      if (key === 'type') return 'Influencer Marketing';
      if (key === 'budget') return '50000';
      if (key === 'budgettype') return 'SAR';
      if (key === 'targetinfluencers') return '25';
      if (key === 'targetpostingcoverage') return '50';
      if (key === 'startdate') return '2026-06-01';
      if (key === 'enddate') return '2026-06-30';
      if (key === 'status') return 'Active';
      if (key === 'stage') return '1';
      if (key === 'currentowner') return 'Operations Lead';
      if (key === 'objective') return 'Brand Awareness';
      return '';
    });
    const csv = `${templateHeaders.join(',')}\n${sampleValues.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-gc-orange" size={20} />
            <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              onFile(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border border-dashed p-5 transition-colors ${
              dragging ? 'border-gc-orange bg-gc-orange/10' : 'border-border bg-background'
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-foreground">Drop a CSV or Excel file here</p>
                <p className="mt-1 text-xs text-muted-foreground">Rows are previewed first. Only clean rows are imported.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent">
                  <Upload size={14} />
                  {fileName ? 'Choose another' : 'Choose file'}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={e => onFile(e.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-gc-orange/30 bg-gc-orange/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gc-orange hover:bg-gc-orange/15"
                >
                  <Download size={14} /> Template
                </button>
              </div>
            </div>
            {fileName && (
              <span className="mt-3 block truncate text-xs font-semibold text-muted-foreground">
                {fileName}
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Done — {result.inserted} inserted, {result.updated} updated.
              </span>
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 size={14} /> {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-red-700">
                    <AlertCircle size={14} /> {errorCount} with errors
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold">Row</th>
                        <th className="px-3 py-2 text-left font-bold">Status</th>
                        <th className="px-3 py-2 text-left font-bold">Summary</th>
                        <th className="px-3 py-2 text-left font-bold">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map(p => {
                        const ok = p.errors.length === 0;
                        const entity = p.parsed as Record<string, any>;
                        const summary =
                          entity.name ||
                          entity.title ||
                          entity.username ||
                          entity.email ||
                          entity.id ||
                          '—';
                        return (
                          <tr key={p.index} className="border-t border-border">
                            <td className="px-3 py-2 text-muted-foreground">{p.index}</td>
                            <td className="px-3 py-2">
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 size={12} /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                                  <AlertCircle size={12} /> Error
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-foreground truncate max-w-xs">
                              {String(summary)}
                            </td>
                            <td className="px-3 py-2 text-red-700">
                              {p.errors.join('; ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border p-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent"
          >
            Close
          </button>
          <button
            onClick={handleCommit}
            disabled={submitting || validCount === 0}
            className="rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-gc-orange/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Importing…' : `Import ${validCount} row${validCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
