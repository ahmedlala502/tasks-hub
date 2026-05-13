import React, { useState, useEffect } from 'react';
import { Office, Task, Status, Shift } from '../../types';
import { COUNTRY_FLAGS } from '../../constants';
import { Search, Plus, MapPin, User, ChevronRight, MoreHorizontal, Globe, Trash2, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalData } from '../LocalDataContext';
import BulkCSVImport from '../BulkCSVImport';

interface OfficeRegisterProps {
  offices: Office[];
  tasks: Task[];
}

export default function OfficeRegister({ offices, tasks }: OfficeRegisterProps) {
  const { addOffice, updateOffice, deleteOffice, isMasterAdmin } = useLocalData();
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [form, setForm] = useState<Partial<Office>>({
    name: '',
    country: 'KSA',
    lead: '',
    shift: Shift.MORNING
  });

  useEffect(() => {
    if (editingOffice) {
      setForm(editingOffice);
    } else {
      setForm({
        name: '',
        country: 'KSA',
        lead: '',
        shift: Shift.MORNING
      });
    }
  }, [editingOffice, isModalOpen]);

  const handleSave = async () => {
    if (!form.name || !form.lead) return;

    if (editingOffice) {
      await updateOffice(editingOffice.id, form);
    } else {
      await addOffice(form);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete hub ${name}?`)) {
      await deleteOffice(id);
    }
  };

  const filteredOffices = offices.filter(o => 
    o.name.toLowerCase().includes(filter.toLowerCase()) ||
    o.country.toLowerCase().includes(filter.toLowerCase()) ||
    o.lead.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-citrus transition-colors" />
          <input 
            type="text" 
            placeholder="Search register..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white border border-dawn rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-citrus/20 w-64 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditingOffice(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-ink text-white rounded-xl font-bold text-xs shadow-lg shadow-ink/10 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Hub</span>
          </button>
          {isMasterAdmin && (
            <BulkCSVImport
              label="Import CSV"
              description="Import offices from CSV. Expected columns: name, country, lead, shift, timezone, address, phone"
              expectedHeaders={['name', 'country', 'lead']}
              onImport={async (rows) => {
                for (const row of rows) {
                  await addOffice({
                    name: row.name || row.Name || 'New Hub',
                    country: row.country || row.Country || 'EG',
                    lead: row.lead || row.Lead || '',
                    shift: (row.shift || row.Shift || 'Morning') as any,
                    timezone: row.timezone || row.Timezone || undefined,
                    address: row.address || row.Address || undefined,
                    phone: row.phone || row.Phone || undefined,
                  });
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone/50 border-b border-dawn">
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Region</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Hub Name</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Regional Lead</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Shift Coverage</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Load Status</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dawn">
            {filteredOffices.map((office) => {
              const officeTasks = tasks.filter(t => t.office === office.name);
              const openTasks = officeTasks.filter(t => t.status !== Status.DONE);
              const riskTasks = officeTasks.filter(t => t.priority === 'High' && t.status !== Status.DONE);
              const progress = officeTasks.length > 0 
                ? (officeTasks.filter(t => t.status === Status.DONE).length / officeTasks.length) * 100 
                : 0;

              return (
                <tr key={office.id} className="group hover:bg-stone/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{COUNTRY_FLAGS[office.country] || '🌍'}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted">{office.country}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div>
                      <span className="block text-sm font-bold text-ink group-hover:text-citrus transition-colors">{office.name}</span>
                      <span className="text-[10px] font-medium text-muted mt-0.5 block italic">Primary Delivery Point</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-dawn rounded-lg flex items-center justify-center text-[10px] font-black text-muted border border-white">
                        {office.lead.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-xs font-bold text-muted uppercase tracking-wider">{office.lead}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-2 py-1 bg-stone border border-dawn rounded-lg text-[9px] font-black uppercase tracking-widest text-muted">
                      {office.shift} Window
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="w-48">
                      <div className="flex justify-between items-center mb-1.5 flex-nowrap">
                        <span className="text-[10px] font-bold text-ink whitespace-nowrap">{openTasks.length} Outcomes Pending</span>
                        {riskTasks.length > 0 && (
                          <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter ml-2">Risk Alert!</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-dawn rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className={`h-full rounded-full ${riskTasks.length > 0 ? 'bg-red-500' : 'bg-citrus'}`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingOffice(office);
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-white rounded-lg transition-colors text-muted hover:text-citrus"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(office.id, office.name)}
                        className="p-2 hover:bg-white rounded-lg transition-colors text-muted hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-dawn"
            >
              <div className="px-8 py-6 border-b border-dawn flex justify-between items-center">
                <h3 className="relaxed-title text-xl">{editingOffice ? 'Modify Operational Hub' : 'Register New Regional Hub'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone rounded-full transition-colors">
                  <Plus className="w-5 h-5 text-muted rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Country Registry</label>
                      <select 
                        value={form.country}
                        onChange={e => setForm({...form, country: e.target.value})}
                        className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none appearance-none"
                      >
                        {Object.keys(COUNTRY_FLAGS).map(code => (
                          <option key={code} value={code}>{COUNTRY_FLAGS[code]} {code}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Operating Shift</label>
                      <select 
                        value={form.shift}
                        onChange={e => setForm({...form, shift: e.target.value as Shift})}
                        className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                      >
                        {Object.values(Shift).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Office Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Riyadh Central HQ"
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Regional Lead / POC</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input 
                        type="text" 
                        placeholder="Assign lead owner..."
                        value={form.lead}
                        onChange={e => setForm({...form, lead: e.target.value})}
                        className="w-full bg-stone/50 border border-dawn rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                  <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-amber-700 mb-0.5">Note on Regional Governance</span>
                    <p className="text-[10px] font-bold text-amber-600/80 leading-relaxed uppercase tracking-tighter">
                      Registering a hub enables cross-shift handovers and collaborative outcome tracking for the selected region.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-stone/50 border-t border-dawn flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-2.5 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                >
                  Sync & Register
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
