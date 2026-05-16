import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar, User, MapPin, Flag, Zap, Info, Sparkles, Loader2, Megaphone, Users, Mail, Check, AlertCircle as AlertIcon, Globe, Plus, Bell, Trash2 as TrashIcon, Clock } from 'lucide-react';
import { Task, Status, Priority, Shift, Reminder } from '../types';
import { TEAMS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { improveTaskContent } from '../lib/apiService';
import { useLocalData } from './LocalDataContext';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  initialTask?: Task | null;
}

const createBlankTask = (teams: string[], office: string, country: string): Partial<Task> => ({
  title: '',
  campaign: '',
  owner: '',
  country,
  office,
  team: teams[0] || TEAMS[0],
  priority: Priority.MEDIUM,
  status: Status.BACKLOG,
  shift: Shift.MORNING,
  due: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  estimatedHours: 24,
  carry: false,
  details: '',
  reminders: [],
});

export default function TaskModal({ isOpen, onClose, onSave, initialTask }: TaskModalProps) {
  const { offices, settings, user, members } = useLocalData();
  const teamOptions = settings.teams?.length ? settings.teams : TEAMS;
  const officeOptions = offices.length ? offices : [];
  const defaultOffice = user.office || officeOptions[0]?.name || 'Cairo HQ';
  const defaultCountry = user.country || officeOptions[0]?.country || 'EG';
  const [form, setForm] = useState<Partial<Task>>(() => createBlankTask(teamOptions, defaultOffice, defaultCountry));

  const [reminderTime, setReminderTime] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));

  const [isSuggesting, setIsSuggesting] = useState(false);

  const assignableMembers = useMemo(() => {
    const pool = members.filter(member => !form.team || member.team === form.team);
    const deduped = new Map<string, typeof pool[number]>();

    pool.forEach(member => {
      if (!deduped.has(member.name)) deduped.set(member.name, member);
    });

    if (user.name && !deduped.has(user.name)) {
      deduped.set(user.name, {
        id: 'current-user',
        name: user.name,
        team: form.team || user.team || teamOptions[0],
        office: user.office,
        country: user.country,
        role: user.role,
        tasksCompleted: 0,
        handoversOut: 0,
        onTime: 0,
      });
    }

    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [form.team, members, teamOptions, user]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialTask ? { ...initialTask, due: initialTask.due?.slice(0, 16) } : {
      ...createBlankTask(teamOptions, defaultOffice, defaultCountry),
      owner: user.name,
    });
  }, [defaultCountry, defaultOffice, initialTask, isOpen, teamOptions, user.name]);

  if (!isOpen) return null;

  const handleAISuggest = async (field: 'title' | 'details') => {
    if (isSuggesting) return;

    setIsSuggesting(true);
    try {
      const result = await improveTaskContent({
        content: field === 'title' ? (form.title || '') : `${form.title} - ${form.details}`,
        type: field,
        campaign: form.campaign,
        team: form.team
      });

      if (result.text) {
        setForm(prev => ({ ...prev, [field]: result.text.trim() }));
      }

      // Log if using fallback
      if (result.provider === 'mock') {
        console.log('Using local fallback for task suggestion');
      }
    } catch (error) {
      console.error('AI Suggestion Failed:', error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    onSave(form);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <header className="px-8 py-6 border-b border-dawn flex items-center justify-between">
            <div>
              <h2 className="relaxed-title text-2xl text-ink">New Core Outcome</h2>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mt-1">{initialTask ? 'Edit Daily Task' : 'Daily Task Definition'}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone rounded-full transition-colors">
              <X className="w-5 h-5 text-muted" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted block">Outcome Title</label>
                <button
                  type="button"
                  onClick={() => handleAISuggest('title')}
                  disabled={!form.title || isSuggesting}
                  className="flex items-center gap-1.5 text-[9px] font-bold text-citrus hover:text-citrus/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                >
                  {isSuggesting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  <span>Refine Title</span>
                </button>
              </div>
              <input
                autoFocus
                type="text"
                required
                placeholder="What is the objective?"
                value={form.title || ''}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full text-xl font-semibold bg-stone/30 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-citrus/20 outline-none placeholder:text-muted/40"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                <Megaphone className="w-3 h-3" />
                <span>Associated Campaign</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramadan 2024, Brand Launch..."
                value={form.campaign || ''}
                onChange={e => setForm({ ...form, campaign: e.target.value })}
                className="w-full bg-stone/50 border border-dawn rounded-xl px-6 py-3 text-sm font-bold focus:border-citrus outline-none"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                <Globe className="w-3 h-3" />
                <span>Target Country</span>
              </label>
              <input
                type="text"
                placeholder="e.g. KSA, UAE, Egypt..."
                value={form.country || ''}
                onChange={e => setForm({ ...form, country: e.target.value })}
                className="w-full bg-stone/50 border border-dawn rounded-xl px-6 py-3 text-sm font-bold focus:border-citrus outline-none"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                <Users className="w-3 h-3" />
                <span>Executing Team</span>
              </label>
              <select
                value={form.team || teamOptions[0] || TEAMS[0]}
                onChange={e => setForm({ ...form, team: e.target.value })}
                className="w-full bg-stone/50 border border-dawn rounded-xl px-6 py-3 text-sm font-bold focus:border-citrus outline-none"
              >
                {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>Owner</span>
                    </div>
                    {form.owner && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-[9px] font-bold text-green-600 uppercase tracking-widest"
                      >
                        <Check className="w-3 h-3" />
                        <span>Assigned</span>
                      </motion.div>
                    )}
                  </label>
                  <select
                    value={form.owner || ''}
                    onChange={e => setForm({ ...form, owner: e.target.value })}
                    className="w-full bg-stone/50 border border-dawn focus:border-citrus rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all"
                  >
                    <option value="">Select assignee</option>
                    {assignableMembers.map(member => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span>Regional Hub</span>
                  </label>
                  <select
                    value={form.office || defaultOffice}
                    onChange={e => setForm({ ...form, office: e.target.value })}
                    className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                  >
                    {[...new Set([form.office, ...officeOptions.map(o => o.name)])].filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>Commitment Date</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.due || ''}
                    onChange={e => setForm({ ...form, due: e.target.value })}
                    className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>SLA Duration</span>
                  </label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    placeholder="Hours assigned to complete"
                    value={form.estimatedHours ?? ''}
                    onChange={e => setForm({ ...form, estimatedHours: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                  />
                  <p className="text-[9px] font-bold text-muted/60 uppercase tracking-wider">Shown to the assignee on the task card.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                    <Flag className="w-3 h-3" />
                    <span>Priority Level</span>
                  </label>
                  <div className="flex gap-2">
                    {Object.values(Priority).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p })}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black border transition-all ${form.priority === p
                          ? 'bg-ink text-white border-ink shadow-md'
                          : 'bg-white text-muted border-dawn hover:border-citrus'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    <span>Current Status</span>
                  </label>
                  <select
                    value={form.status || Status.BACKLOG}
                    onChange={e => setForm({ ...form, status: e.target.value as Status })}
                    className="w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none"
                  >
                    {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="p-4 bg-citrus/5 rounded-2xl border border-citrus/10 mt-auto">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-citrus"
                      checked={form.carry}
                      onChange={e => setForm({ ...form, carry: e.target.checked })}
                    />
                    <div>
                      <span className="block text-xs font-bold text-ink">Carry over to next shift</span>
                      <span className="text-[9px] font-bold text-muted/60 leading-none">Auto-includes in next handover</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  <span>Detailed Notes & Description</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleAISuggest('details')}
                  disabled={!form.title || isSuggesting}
                  className="flex items-center gap-1.5 text-[9px] font-bold text-citrus hover:text-citrus/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                >
                  {isSuggesting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  <span>Draft Notes via AI</span>
                </button>
              </div>
              <textarea
                value={form.details || ''}
                onChange={e => setForm({ ...form, details: e.target.value })}
                placeholder="Provide any additional context, background, or detailed notes for this outcome..."
                className="w-full bg-stone/50 border border-dawn rounded-2xl px-6 py-4 text-sm font-medium focus:border-citrus outline-none min-h-[100px]"
              />
            </div>

            <div className="space-y-4 p-6 bg-amber-50/30 rounded-2xl border border-amber-100">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 flex items-center gap-2">
                <Bell className="w-3 h-3" />
                <span>Operational Reminders</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="flex-1 bg-white border border-amber-100 rounded-xl px-4 py-2 text-xs font-bold focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newReminder: Reminder = { id: crypto.randomUUID(), time: reminderTime, triggered: false };
                    setForm({ ...form, reminders: [...(form.reminders || []), newReminder] });
                  }}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Add Reminder
                </button>
              </div>

              {form.reminders && form.reminders.length > 0 && (
                <div className="space-y-2 mt-4">
                  {form.reminders.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-amber-50 shadow-sm animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span className="text-xs font-bold text-amber-900">
                          {new Date(r.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newReminders = [...(form.reminders || [])];
                          newReminders.splice(i, 1);
                          setForm({ ...form, reminders: newReminders });
                        }}
                        className="p-1.5 text-amber-300 hover:text-red-500 transition-colors"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>

          <footer className="px-8 py-6 bg-stone/50 border-t border-dawn flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-8 py-2.5 bg-ink text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {initialTask ? 'Save Changes' : 'Confirm Outcome'}
            </button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
