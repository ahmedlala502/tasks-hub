import React, { useMemo, useState } from 'react';
import { Member, Office, Task, Handover, Status, Shift } from '../../types';
import { INITIAL_MEMBERS, COUNTRY_FLAGS, TEAMS } from '../../constants';
import { Award, CheckCircle2, Clock, Edit, Plus, Search, ShieldAlert, Trash2, UserRound, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalData } from '../LocalDataContext';
import BulkCSVImport from '../BulkCSVImport';

interface TeamPerformanceProps {
  members: Member[];
  offices: Office[];
  tasks: Task[];
  handovers: Handover[];
}

type MemberForm = Omit<Member, 'id'>;

const emptyForm: MemberForm = {
  name: '',
  team: TEAMS[0],
  office: 'Cairo HQ',
  country: 'EG',
  role: 'Operations',
  tasksCompleted: 0,
  handoversOut: 0,
  onTime: 0,
};

export default function TeamPerformance({ members, offices, tasks, handovers }: TeamPerformanceProps) {
  const { addMember, updateMember, deleteMember, isMasterAdmin } = useLocalData();
  const [filter, setFilter] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const teamMembers = useMemo(() => {
    const byName = new Map<string, Member>();

    const seed = members.length ? members : INITIAL_MEMBERS;
    seed.forEach(member => byName.set(member.name.toLowerCase(), member));

    tasks.forEach(task => {
      const key = task.owner.toLowerCase();
      const current = byName.get(key);
      const completed = task.status === Status.DONE ? 1 : 0;
      const onTime = completed && new Date(task.due).getTime() >= Date.now() ? 1 : 0;

      if (current) {
        byName.set(key, {
          ...current,
          tasksCompleted: Math.max(current.tasksCompleted || 0, 0) + completed,
          onTime: Math.max(current.onTime || 0, 0) + onTime,
        });
      } else {
        byName.set(key, {
          id: `derived-${task.owner}`,
          name: task.owner,
          team: task.team,
          office: task.office,
          country: task.country,
          role: 'Task Owner',
          tasksCompleted: completed,
          handoversOut: 0,
          onTime,
        });
      }
    });

    handovers.forEach(handover => {
      const key = handover.outgoing.toLowerCase();
      const current = byName.get(key);
      if (current) {
        byName.set(key, { ...current, handoversOut: (current.handoversOut || 0) + 1 });
      }
    });

    return Array.from(byName.values()).sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  }, [members, tasks, handovers]);

  const filteredMembers = teamMembers.filter(member => {
    const haystack = [member.name, member.team, member.office, member.country, member.role].join(' ').toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  const totals = useMemo(() => {
    const completed = teamMembers.reduce((sum, member) => sum + (member.tasksCompleted || 0), 0);
    const onTime = teamMembers.reduce((sum, member) => sum + (member.onTime || 0), 0);
    const handoverCount = teamMembers.reduce((sum, member) => sum + (member.handoversOut || 0), 0);
    return {
      completed,
      onTimeRate: completed ? Math.round((onTime / completed) * 100) : 0,
      handoverCount,
      memberCount: teamMembers.length,
    };
  }, [teamMembers]);

  const topCompleted = [...teamMembers].sort((a, b) => b.tasksCompleted - a.tasksCompleted).slice(0, 5);
  const topOnTime = [...teamMembers].sort((a, b) => rate(b) - rate(a)).slice(0, 5);
  const topHandovers = [...teamMembers].sort((a, b) => b.handoversOut - a.handoversOut).slice(0, 5);

  const openCreate = () => {
    setEditingMember(null);
    setForm({
      ...emptyForm,
      office: offices[0]?.name || emptyForm.office,
      country: offices[0]?.country || emptyForm.country,
    });
    setIsModalOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditingMember(member);
    setForm({
      name: member.name,
      team: member.team,
      office: member.office,
      country: member.country,
      role: member.role || 'Operations',
      tasksCompleted: member.tasksCompleted || 0,
      handoversOut: member.handoversOut || 0,
      onTime: member.onTime || 0,
    });
    setIsModalOpen(true);
  };

  const saveMember = async () => {
    if (!form.name.trim() || !form.team.trim() || !form.office.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      name: form.name.trim(),
      team: form.team.trim(),
      office: form.office.trim(),
      country: form.country || 'EG',
      role: form.role?.trim() || 'Operations',
      tasksCompleted: Number(form.tasksCompleted) || 0,
      handoversOut: Number(form.handoversOut) || 0,
      onTime: Number(form.onTime) || 0,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingMember && !editingMember.id.startsWith('derived-')) {
        await updateMember(editingMember.id, payload);
      } else {
        await addMember(payload);
      }
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteMemberRecord = async (member: Member) => {
    if (member.id.startsWith('derived-')) return;
    if (!confirm(`Remove ${member.name} from the team register?`)) return;
    await deleteMember(member.id);
  };

  return (
    <div className="space-y-8 pb-24">
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 glass-card bg-ink text-white border-none p-8 overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6 text-citrus">
              <Award className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Member-level performance</span>
            </div>
            <h2 className="relaxed-title text-4xl mb-4">Know who is carrying the shift.</h2>
            <p className="max-w-xl text-sm font-medium text-white/65 leading-relaxed">
              Track task completion, on-time delivery, and handover ownership by person so the team page from the original spec is now part of TryGC Hub Manager.
            </p>
          </div>
          <Users className="absolute -right-10 -bottom-12 w-72 h-72 text-white/5" />
        </div>

        {[
          { label: 'Team Members', value: totals.memberCount, icon: Users, color: 'text-blue-500' },
          { label: 'Tasks Completed', value: totals.completed, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'On-time Rate', value: `${totals.onTimeRate}%`, icon: Clock, color: 'text-citrus' },
          { label: 'Handovers Out', value: totals.handoverCount, icon: ShieldAlert, color: 'text-red-500' },
        ].slice(1).map(item => (
          <div key={item.label} className="glass-card p-6 border-dawn">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">{item.label}</span>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <span className="relaxed-title text-4xl">{item.value}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-citrus transition-colors" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search member, team, office..."
            className="pl-10 pr-4 py-2.5 bg-white border border-dawn rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-citrus/20 w-full md:w-80 shadow-sm"
          />
        </div>
        {isMasterAdmin && (
          <>
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-ink text-white rounded-xl font-bold text-xs shadow-lg shadow-ink/10 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
            <BulkCSVImport
              label="Import CSV"
              description="Import members from CSV. Expected columns: name, role, team, office, country, email, password"
              expectedHeaders={['name', 'role', 'team']}
              onImport={async (rows) => {
                for (const row of rows) {
                  await addMember({
                    name: row.name || row.Name || 'Unknown',
                    role: row.role || row.Role || 'Operations Agent',
                    team: row.team || row.Team || TEAMS[0],
                    office: row.office || row.Office || 'Cairo HQ',
                    country: row.country || row.Country || 'EG',
                    email: row.email || row.Email || undefined,
                    password: row.password || row.Password || undefined,
                  });
                }
              }}
            />
          </>
        )}
      </section>

      <section className="glass-card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone/50 border-b border-dawn">
              {['Member', 'Team', 'Office', 'Tasks Done', 'On-time Rate', 'Handovers Out', 'Performance', ''].map(head => (
                <th key={head} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dawn">
            {filteredMembers.map(member => {
              const onTimeRate = rate(member);
              const performance = score(member);
              return (
                <tr key={member.id} className="group hover:bg-stone/30 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-dawn rounded-xl flex items-center justify-center text-[11px] font-black text-muted border border-white">
                        {initials(member.name)}
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-ink">{member.name}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">{member.role || 'Operations'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-muted">{member.team}</td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-bold text-ink">{COUNTRY_FLAGS[member.country] || ''} {member.office}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="relaxed-title text-xl">{member.tasksCompleted || 0}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${onTimeRate >= 85 ? 'bg-green-50 text-green-600' : onTimeRate >= 60 ? 'bg-citrus/10 text-citrus' : 'bg-red-50 text-red-500'}`}>
                      {onTimeRate}%
                    </span>
                  </td>
                  <td className="px-6 py-5 text-xs font-black text-muted">{member.handoversOut || 0}</td>
                  <td className="px-6 py-5">
                    <div className="w-40">
                      <div className="h-1.5 bg-dawn rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${performance}%` }}
                          className={`h-full rounded-full ${performance >= 75 ? 'bg-green-500' : performance >= 45 ? 'bg-citrus' : 'bg-red-500'}`}
                        />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted mt-2 block">{performance} score</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {isMasterAdmin && (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(member)} className="p-2 hover:bg-white rounded-lg transition-colors text-muted hover:text-citrus">
                          <Edit className="w-4 h-4" />
                        </button>
                        {!member.id.startsWith('derived-') && (
                          <button onClick={() => deleteMemberRecord(member)} className="p-2 hover:bg-white rounded-lg transition-colors text-muted hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Leaderboard title="Tasks Completed - Top 5" members={topCompleted} metric="tasksCompleted" />
        <Leaderboard title="On-time Delivery" members={topOnTime} metric="onTimeRate" />
        <Leaderboard title="Handovers Out" members={topHandovers} metric="handoversOut" />
      </section>

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
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-dawn"
            >
              <div className="px-8 py-6 border-b border-dawn flex justify-between items-center">
                <h3 className="relaxed-title text-xl">{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-2 gap-5">
                <Field label="Full Name">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Team member name" />
                </Field>
                <Field label="Role">
                  <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputClass} placeholder="Operations Lead" />
                </Field>
                <Field label="Team">
                  <select value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} className={inputClass}>
                    {TEAMS.map(team => <option key={team}>{team}</option>)}
                  </select>
                </Field>
                <Field label="Office">
                  <select
                    value={form.office}
                    onChange={e => {
                      const office = offices.find(item => item.name === e.target.value);
                      setForm({ ...form, office: e.target.value, country: office?.country || form.country });
                    }}
                    className={inputClass}
                  >
                    {[...new Set([form.office, ...offices.map(office => office.name)])].filter(Boolean).map(office => <option key={office}>{office}</option>)}
                  </select>
                </Field>
                <Field label="Tasks Completed">
                  <input type="number" min="0" value={form.tasksCompleted} onChange={e => setForm({ ...form, tasksCompleted: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="On-time Count">
                  <input type="number" min="0" value={form.onTime} onChange={e => setForm({ ...form, onTime: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="Handovers Out">
                  <input type="number" min="0" value={form.handoversOut} onChange={e => setForm({ ...form, handoversOut: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="Country">
                  <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inputClass}>
                    {Object.keys(COUNTRY_FLAGS).map(country => <option key={country}>{country}</option>)}
                  </select>
                </Field>
              </div>

              <div className="px-8 py-6 bg-stone/50 border-t border-dawn flex justify-between items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                  <UserRound className="w-4 h-4" />
                  <span>{editingMember?.id.startsWith('derived-') ? 'Saving will create a managed member record' : 'Managed member record'}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={saveMember}
                    disabled={saving || !form.name.trim()}
                    className="px-8 py-2.5 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {saving ? 'Saving...' : 'Save Member'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Leaderboard({ title, members, metric }: { title: string; members: Member[]; metric: 'tasksCompleted' | 'onTimeRate' | 'handoversOut' }) {
  const values = members.map(member => metric === 'onTimeRate' ? rate(member) : member[metric] || 0);
  const max = Math.max(1, ...values);

  return (
    <div className="glass-card p-6 border-dawn">
      <h3 className="relaxed-title text-lg mb-6">{title}</h3>
      <div className="space-y-5">
        {members.map(member => {
          const value = metric === 'onTimeRate' ? rate(member) : member[metric] || 0;
          return (
            <div key={`${title}-${member.id}`} className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-ink">{member.name}</span>
                <span className="text-muted">{metric === 'onTimeRate' ? `${value}%` : value}</span>
              </div>
              <div className="h-2 bg-dawn rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((value / max) * 100)}%` }} className="h-full bg-citrus rounded-full" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">{label}</span>
      {children}
    </label>
  );
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 3).toUpperCase();
}

function rate(member: Member) {
  return member.tasksCompleted ? Math.round(((member.onTime || 0) / member.tasksCompleted) * 100) : 0;
}

function score(member: Member) {
  const delivery = Math.min(100, (member.tasksCompleted || 0) * 8);
  const punctuality = rate(member);
  const continuity = Math.min(100, (member.handoversOut || 0) * 12);
  return Math.round(delivery * 0.45 + punctuality * 0.4 + continuity * 0.15);
}

const inputClass = 'w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 text-sm font-bold focus:border-citrus outline-none';
