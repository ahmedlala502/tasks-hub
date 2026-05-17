import React, { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import { addToast } from '../lib/toast';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

interface BulkCSVImportProps {
  label: string;
  description: string;
  expectedHeaders: string[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}

export default function BulkCSVImport({ label, description, expectedHeaders, onImport }: BulkCSVImportProps) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setError('CSV file is empty or has invalid format.');
        return;
      }
      const missingHeaders = expectedHeaders.filter(h => !rows[0] || !(h in rows[0]) && !Object.keys(rows[0]).some(k => k.toLowerCase() === h.toLowerCase()));
      if (missingHeaders.length > 0 && missingHeaders.length === expectedHeaders.length) {
        setError(`CSV must include at least one of these columns: ${expectedHeaders.join(', ')}`);
        return;
      }
      setPreview(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError('');
    try {
      await onImport(preview);
      addToast(`${preview.length} records imported successfully.`, 'success', 4000);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {importing ? 'Importing...' : label}
      </button>

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm" onClick={() => !importing && setPreview(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-citrus" />
                <h3 className="text-lg font-black text-ink">Confirm CSV Import</h3>
              </div>
              {!importing && (
                <button onClick={() => setPreview(null)} className="text-muted hover:text-ink"><X className="w-5 h-5" /></button>
              )}
            </div>
            <p className="text-xs font-bold text-muted">{description}</p>
            <p className="text-sm font-black text-ink">{preview.length} rows detected</p>
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-dawn rounded-2xl">
              <table className="w-full text-xs">
                <thead className="bg-stone/50 sticky top-0">
                  <tr>{Object.keys(preview[0]).map(h => <th key={h} className="px-3 py-2 text-left font-black text-muted uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-dawn/50">
                      {Object.values(row).map((val, j) => <td key={j} className="px-3 py-2 font-medium text-ink truncate max-w-[150px]">{val}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && <p className="text-center text-[10px] font-bold text-muted/40 py-3">...and {preview.length - 20} more rows</p>}
            </div>
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setPreview(null)} disabled={importing} className="px-5 py-2.5 bg-stone border border-dawn rounded-xl text-[10px] font-black uppercase tracking-widest text-muted">Cancel</button>
              <button onClick={doImport} disabled={importing} className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {importing ? 'Importing...' : `Import ${preview.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}