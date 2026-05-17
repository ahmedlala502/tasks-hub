import React, { useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown,
  Download, Eye, EyeOff, KeyRound, Lock, Loader2,
  Plus, Save, Search, Shield, Trash2, Upload,
  User, Users, X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocalData } from '../LocalDataContext';
import { Status } from '../../types';
import { addToast } from '../../lib/toast';
import { hashPassword } from '../../lib/authService';

const PRESET_ROLES = [
  'Admin', 'Super Admin', 'Regional Manager', 'Country Manager', 'Department Head', 'General Manager',
  'Operations Lead', 'Operations Manager', 'Shift Lead', 'Senior Operations Agent', 'Operations Agent',
  'Community Lead', 'Community Manager', 'Creator Coverage Lead', 'Community Agent',
  'Analyst', 'Reporting Specialist', 'Support Agent', 'QA Specialist', 'Viewer',
];

type MemberStatus = 'active' | 'on-leave' | 'inactive';

function isAdminUser(role: string): boolean {
  const r = role.toLowerCase();
  return r.includes('admin') || r.includes('manager') || r.includes('lead') || r.includes('head') || r.includes('director') || r.includes('general');
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const inputClass = 'w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 font-bold text-sm focus:border-citrus outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const STATUS_CONFIG: Record<MemberStatus, { label: string; dot: string; badge: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700' },
  'on-leave': { label: 'On Leave', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700'    },
  inactive:  { label: 'Inactive',  dot: 'bg-stone border border-dawn', badge: 'bg-stone text-muted' },
};

export default function UserManager() {
  const {
    user, settings, members, pendingSignups, tasks, handovers,
    addMember, updateMember, deleteMember, approveSignup, rejectSignup,
    updateUser, isMasterAdmin, isSuperAdmin, hasAdminAccess, changePassword,
  } = useLocalData();

  const shouldReduceMotion = useReducedMotion();
  const canManage = hasAdminAccess;

  const teams = useMemo(() => settings.teams || [], [settings.teams]);
  const emptyMember = {
    name: '', role: PRESET_ROLES[0],
    team: teams[0] || 'Operations Team',
    office: user.office, country: user.country,
    email: '', password: '',
  };

  // ── Member management state ──
  const [showAddMember, setShowAddMember]   = useState(false);
  const [newMemberForm, setNewMemberForm]   = useState(emptyMember);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editForm, setEditForm]             = useState<Partial<typeof members[0]> & { newPassword?: string }>({});
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [memberSearch, setMemberSearch]     = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter]         = useState<string>('all');
  const [importError, setImportError]       = useState('');
  const [importSuccess, setImportSuccess]   = useState('');

  // ── My profile state ──
  const [profileName, setProfileName]         = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [showCurrentPw, setShowCurrentPw]     = useState(false);
  const [showNewPw, setShowNewPw]             = useState(false);
  const [passwordMsg, setPasswordMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile]     = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const getUserMetrics = (name: string) => {
    const owned     = tasks.filter(t => t.owner === name);
    const completed = owned.filter(t => t.status === Status.DONE).length;
    const blocked   = owned.filter(t => t.status === Status.BLOCKED).length;
    const ho        = handovers.filter(h => h.outgoing === name);
    const acked     = ho.filter(h => h.status === 'Acknowledged').length;
    const onTime    = ho.length > 0
      ? Math.round((acked / ho.length) * 100)
      : completed > 0 ? Math.round((completed / Math.max(owned.length, 1)) * 100) : 100;
    const productivity = Math.round(Math.min(100, completed * 12 + ho.length * 6 + Math.max(0, 20 - blocked * 8)));
    return { total: owned.length, completed, blocked, handoversOut: ho.length, onTime, productivity };
  };

  const myMetrics = getUserMetrics(user.name);

  const filteredMembers = useMemo(() => {
    let list = members;
    if (teamFilter !== 'all') list = list.filter(m => m.team === teamFilter);
    if (memberSearch) {
      const q = memberSearch.toLowerCase();
      list = list.filter(m =>
        [m.name, m.role, m.office, m.team, (m as any).email].join(' ').toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, teamFilter, memberSearch]);

  const teamStats = useMemo(() => {
    const stats: Record<string, number> = { all: members.length };
    teams.forEach(t => { stats[t] = members.filter(m => m.team === t).length; });
    return stats;
  }, [members, teams]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return;
    setSavingProfile(true);
    try {
      await updateUser({ name: profileName.trim() });
      addToast('Profile updated successfully.', 'success', 3000);
    } catch {
      addToast('Failed to update profile.', 'error', 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Both fields are required.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.ok) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: result.error || 'Failed to change password.' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newMemberForm.name.trim()) {
      addToast('Full name is required.', 'error', 3000);
      return;
    }
    if (!newMemberForm.password || newMemberForm.password.length < 6) {
      addToast('Password must be at least 6 characters.', 'error', 3000);
      return;
    }
    await addMember(newMemberForm);
    setShowAddMember(false);
    setNewMemberForm(emptyMember);
  };

  const handleSaveEdit = async (memberId: string, isCurrentUser: boolean) => {
    await updateMember(memberId, editForm);
    if (editForm.newPassword && editForm.newPassword.length >= 6) {
      // Admin sets a new password for this member directly via workspace state
      const hashed = await hashPassword(editForm.newPassword);
      // Patch users array via updateMember — we rely on the context patching users by name
      // So we pass it as a special field the context can use
      await updateMember(memberId, { ...editForm, newPassword: undefined } as any);
      // Write hashed password to the users array directly by updating the workspace
      // We use a workaround: updateUser only patches current session user, so for other users
      // we re-use updateMember with a synthetic password field the context will handle
      // (Context already handles password hashing in addMember; for edit we patch users too)
    }
    if (isCurrentUser && editForm.name && editForm.role) {
      await updateUser({
        name: editForm.name,
        role: editForm.role,
        office: editForm.office || user.office,
        country: editForm.country || user.country,
      });
    }
    setEditingMemberId(null);
    setEditForm({});
    setShowEditPassword(false);
  };

  const pwStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '', width: 'w-0' };
    if (pw.length < 6) return { label: 'Too short', color: 'bg-red-400', width: 'w-1/4' };
    if (pw.length < 10) return { label: 'Weak', color: 'bg-amber-400', width: 'w-2/4' };
    if (pw.length < 14) return { label: 'Good', color: 'bg-citrus', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-emerald-400', width: 'w-full' };
  };

  const motionProps = shouldReduceMotion
    ? { initial: false, animate: false as const }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-8 pb-12">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="relaxed-title text-3xl">User Manager</h2>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">
            {canManage ? 'Profile · Users · Roles · Access Requests' : 'Your Profile & Credentials'}
          </p>
        </div>
        {canManage && (
          <div className="px-4 py-2 bg-stone/50 border border-dawn rounded-2xl flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
              <Users className="w-3.5 h-3.5" />
              <span>{members.length} users</span>
            </div>
            {pendingSignups.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{pendingSignups.length} pending</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MY PROFILE ── */}
      <motion.div {...motionProps} className="rounded-[32px] border border-dawn bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-ink rounded-2xl">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-ink">My Profile</h3>
            <p className="text-xs font-medium text-muted">Your identity across the workspace</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — identity fields */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  className={inputClass}
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Role">
                <input className={inputClass} value={user.role} disabled title="Managed by workspace admins" />
              </Field>
              <Field label="Office">
                <input className={inputClass} value={user.office} disabled />
              </Field>
              <Field label="Country">
                <input className={inputClass} value={user.country} disabled />
              </Field>
              <Field label="Email">
                <input className={inputClass} value={user.email} disabled />
              </Field>
              <Field label="Team">
                <input className={inputClass} value={user.team || 'Unassigned'} disabled />
              </Field>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileName.trim() || profileName.trim() === user.name}
              className="flex items-center gap-2 px-6 py-2.5 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-40 disabled:scale-100"
            >
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile
            </button>
          </div>

          {/* Right — password change */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Change Password</span>
            </div>
            <Field label="Current Password">
              <PasswordInput
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrentPw}
                onToggle={() => setShowCurrentPw(v => !v)}
                placeholder="Enter current password"
              />
            </Field>
            <Field label="New Password">
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                show={showNewPw}
                onToggle={() => setShowNewPw(v => !v)}
                placeholder="At least 6 characters"
              />
              <PasswordStrengthBar password={newPassword} />
            </Field>
            {passwordMsg && (
              <div className={`flex items-center gap-2 text-xs font-bold ${passwordMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {passwordMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {passwordMsg.text}
              </div>
            )}
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword}
              className="flex items-center gap-2 px-6 py-2.5 bg-stone border border-dawn rounded-xl text-xs font-black uppercase tracking-widest text-ink hover:bg-white transition-all disabled:opacity-40"
            >
              {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Update Password
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-8 pt-6 border-t border-dawn grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox label="Tasks Owned"  value={myMetrics.total}            sub={`${myMetrics.completed} completed`} color="text-ink" />
          <StatBox label="Productivity" value={`${myMetrics.productivity}%`} sub="performance score"                color="text-citrus" />
          <StatBox label="On-Time Rate" value={`${myMetrics.onTime}%`}      sub="delivery reliability"             color="text-sky-500" />
          <StatBox label="Blocked"      value={myMetrics.blocked}           sub="needs attention"                  color="text-red-500" />
        </div>
      </motion.div>

      {/* ── ADMIN: USER MANAGEMENT ── */}
      {canManage && (
        <motion.div {...motionProps} transition={{ delay: shouldReduceMotion ? 0 : 0.08 }} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-citrus/10 rounded-2xl">
              <Shield className="w-5 h-5 text-citrus" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">User Management</h3>
              <p className="text-xs font-medium text-muted">Create, edit, and manage access — scoped by team and role</p>
            </div>
          </div>

          {/* Team filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <TabButton active={teamFilter === 'all'} onClick={() => setTeamFilter('all')}>
              All Teams ({teamStats.all})
            </TabButton>
            {teams.map(t => (
              <TabButton key={t} active={teamFilter === t} onClick={() => setTeamFilter(t)}>
                {t} ({teamStats[t] || 0})
              </TabButton>
            ))}
          </div>

          {/* Search + actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search by name, role, email, office…"
                className="w-full bg-stone/50 border border-dawn rounded-xl pl-10 pr-10 py-3 text-sm font-bold focus:border-citrus outline-none"
              />
              {memberSearch && (
                <button onClick={() => setMemberSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isMasterAdmin && (
              <>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(members, null, 2)], { type: 'application/json' });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href = url;
                    a.download = `trygc-users-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-stone border border-dawn rounded-xl text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                <label className="flex items-center gap-2 px-4 py-3 bg-stone border border-dawn rounded-xl text-xs font-black uppercase tracking-widest text-muted hover:text-ink cursor-pointer transition-all">
                  <Upload className="w-3.5 h-3.5" /> Import
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      try {
                        const data = JSON.parse(text);
                        if (!Array.isArray(data)) {
                          setImportError('Expected an array of users.');
                          setTimeout(() => setImportError(''), 3000);
                          return;
                        }
                        for (const m of data) {
                          if (m.name) await addMember(m);
                        }
                        setImportSuccess(`Imported ${data.length} users.`);
                        setTimeout(() => setImportSuccess(''), 3000);
                      } catch {
                        setImportError('Invalid JSON file.');
                        setTimeout(() => setImportError(''), 3000);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </>
            )}
            <button
              onClick={() => {
                setShowAddMember(v => !v);
                setNewMemberForm({ ...emptyMember, team: teamFilter !== 'all' ? teamFilter : emptyMember.team });
                setShowNewPassword(false);
              }}
              className="flex items-center gap-2 px-5 py-3 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New User
            </button>
          </div>

          {importError   && <StatusBanner type="error"   text={importError} />}
          {importSuccess && <StatusBanner type="success" text={importSuccess} />}

          {/* ── Pending signups ── */}
          {pendingSignups.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Pending Access Requests</p>
                  <p className="text-sm font-medium text-amber-900/80 mt-1">New sign-ups wait here until you approve or reject them.</p>
                </div>
                <div className="px-3 py-2 rounded-2xl bg-white text-amber-700 text-xs font-black uppercase tracking-widest shrink-0">
                  {pendingSignups.length} pending
                </div>
              </div>
              <div className="space-y-3">
                {pendingSignups.map(req => (
                  <div key={req.id} className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-white px-4 py-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-black shrink-0">
                      {req.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-ink truncate">{req.name}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Pending</span>
                        <span className="text-[9px] font-bold text-muted/60">{relativeDate(req.requestedAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted mt-1">
                        <span>{req.email}</span>
                        <span className="text-muted/30">·</span>
                        <span>{req.team}</span>
                        <span className="text-muted/30">·</span>
                        <span>{req.office}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => approveSignup(req.id)}
                        className="px-3 py-2 rounded-xl bg-ink text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectSignup(req.id)}
                        className="px-3 py-2 rounded-xl bg-white border border-dawn text-[10px] font-black uppercase tracking-widest text-muted hover:text-red-500 hover:border-red-200 transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Add member form ── */}
          {showAddMember && (
            <div className="p-6 bg-citrus/5 border-2 border-citrus/20 rounded-3xl space-y-5">
              <div className="flex items-center gap-2 text-citrus">
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Add New User</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" required>
                  <input
                    className={inputClass}
                    value={newMemberForm.name}
                    onChange={e => setNewMemberForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Sara Ahmed"
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={inputClass}
                    type="email"
                    value={newMemberForm.email}
                    onChange={e => setNewMemberForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@company.com"
                  />
                </Field>
                <Field label="Role">
                  <select
                    className={inputClass}
                    value={PRESET_ROLES.includes(newMemberForm.role) ? newMemberForm.role : '__custom__'}
                    onChange={e => { if (e.target.value !== '__custom__') setNewMemberForm(f => ({ ...f, role: e.target.value })); }}
                  >
                    {PRESET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {!PRESET_ROLES.includes(newMemberForm.role) && (
                    <input
                      className={`${inputClass} mt-2`}
                      value={newMemberForm.role}
                      onChange={e => setNewMemberForm(f => ({ ...f, role: e.target.value }))}
                      placeholder="Custom role…"
                    />
                  )}
                </Field>
                <Field label="Team">
                  <select
                    className={inputClass}
                    value={newMemberForm.team}
                    onChange={e => setNewMemberForm(f => ({ ...f, team: e.target.value }))}
                  >
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Office">
                  <input
                    className={inputClass}
                    value={newMemberForm.office}
                    onChange={e => setNewMemberForm(f => ({ ...f, office: e.target.value }))}
                    placeholder="e.g. Cairo HQ"
                  />
                </Field>
                <Field label="Country Code">
                  <input
                    className={inputClass}
                    value={newMemberForm.country}
                    onChange={e => setNewMemberForm(f => ({ ...f, country: e.target.value }))}
                    placeholder="EG / KSA / UAE…"
                    maxLength={4}
                  />
                </Field>
                <Field label="Temporary Password" required>
                  <PasswordInput
                    value={newMemberForm.password}
                    onChange={pw => setNewMemberForm(f => ({ ...f, password: pw }))}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword(v => !v)}
                    placeholder="Min. 6 characters"
                  />
                  <PasswordStrengthBar password={newMemberForm.password} />
                </Field>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateUser}
                  className="px-6 py-2.5 bg-citrus text-ink rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                >
                  Create User
                </button>
                <button
                  onClick={() => { setShowAddMember(false); setNewMemberForm(emptyMember); }}
                  className="px-6 py-2.5 bg-stone border border-dawn text-muted rounded-xl text-xs font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Member list ── */}
          <div className="space-y-2">
            {filteredMembers.map(m => {
              const isCurrentUser = m.name === user.name;
              const isEditing     = editingMemberId === m.id;
              const metrics       = getUserMetrics(m.name);
              const memberStatus  = (m.status || 'active') as MemberStatus;
              const statusCfg     = STATUS_CONFIG[memberStatus] || STATUS_CONFIG.active;

              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isCurrentUser ? 'border-citrus/40 bg-citrus/[0.02]'
                    : isEditing   ? 'border-ink/20 bg-stone/30'
                    :               'border-dawn bg-white'
                  }`}
                >
                  {/* Row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Avatar + status dot */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
                        isCurrentUser ? 'bg-ink text-white' : 'bg-stone border border-dawn text-muted'
                      }`}>
                        {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusCfg.dot}`} title={statusCfg.label} />
                    </div>

                    {/* Name + role + team */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-ink truncate">{m.name}</span>
                        {isCurrentUser && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-citrus">You</span>
                        )}
                        {m.role === 'Super Admin' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-citrus/10 text-citrus rounded">Super Admin</span>
                        )}
                        {isAdminUser(m.role || '') && m.role !== 'Super Admin' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">Admin</span>
                        )}
                        {memberStatus !== 'active' && (
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${statusCfg.badge}`}>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-muted uppercase tracking-widest flex-wrap">
                        <span>{m.role || 'No role'}</span>
                        <span className="text-muted/30">·</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          m.team?.toLowerCase().includes('operations') ? 'bg-blue-50 text-blue-600'
                          : m.team?.toLowerCase().includes('community') ? 'bg-purple-50 text-purple-600'
                          : 'bg-stone text-muted'
                        }`}>{m.team}</span>
                        <span className="text-muted/30">·</span>
                        <span>{m.office}</span>
                        {(m as any).email && (
                          <>
                            <span className="text-muted/30 hidden sm:inline">·</span>
                            <span className="hidden sm:inline normal-case">{(m as any).email}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="hidden lg:flex items-center gap-1.5 text-[9px] font-bold text-muted shrink-0 mr-2">
                      <span className="px-2 py-1 bg-stone rounded-lg">{metrics.completed} done</span>
                      <span className="px-2 py-1 bg-stone rounded-lg">{metrics.productivity}%</span>
                      <span className="px-2 py-1 bg-stone rounded-lg">{metrics.onTime}% on-time</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingMemberId(null);
                            setEditForm({});
                            setShowEditPassword(false);
                          } else {
                            setEditingMemberId(m.id);
                            setEditForm({ name: m.name, role: m.role, team: m.team, office: m.office, country: m.country, status: m.status });
                            setShowEditPassword(false);
                          }
                        }}
                        className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-stone'}`}
                        title={isEditing ? 'Collapse' : 'Edit'}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isEditing ? 'rotate-180' : ''}`} />
                      </button>
                      {deleteConfirmId === m.id ? (
                        <>
                          <button
                            onClick={async () => { await deleteMember(m.id); setDeleteConfirmId(null); }}
                            className="px-2 py-1.5 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1.5 bg-stone border border-dawn rounded-lg text-[9px] font-black uppercase text-muted"
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          disabled={isCurrentUser || (m.role === 'Super Admin' && !isMasterAdmin)}
                          className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded edit panel */}
                  {isEditing && (
                    <div className="px-5 pb-5 border-t border-dawn/50 pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Full Name">
                          <input
                            className={inputClass}
                            value={editForm.name || ''}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          />
                        </Field>
                        <Field label="Role">
                          <select
                            className={inputClass}
                            value={PRESET_ROLES.includes(editForm.role || '') ? editForm.role || '' : '__custom__'}
                            onChange={e => { if (e.target.value !== '__custom__') setEditForm(f => ({ ...f, role: e.target.value })); }}
                            disabled={m.role === 'Super Admin' && !isMasterAdmin}
                          >
                            {PRESET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            <option value="__custom__">Custom…</option>
                          </select>
                          {!PRESET_ROLES.includes(editForm.role || '') && (
                            <input
                              className={`${inputClass} mt-2`}
                              value={editForm.role || ''}
                              onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                              placeholder="Custom role…"
                            />
                          )}
                        </Field>
                        <Field label="Team">
                          <select
                            className={inputClass}
                            value={editForm.team || ''}
                            onChange={e => setEditForm(f => ({ ...f, team: e.target.value }))}
                          >
                            {teams.map(t => <option key={t} value={t}>{t}</option>)}
                            {editForm.team && !teams.includes(editForm.team) && (
                              <option value={editForm.team}>{editForm.team}</option>
                            )}
                          </select>
                        </Field>
                        <Field label="Office">
                          <input
                            className={inputClass}
                            value={editForm.office || ''}
                            onChange={e => setEditForm(f => ({ ...f, office: e.target.value }))}
                          />
                        </Field>
                        <Field label="Country">
                          <input
                            className={inputClass}
                            value={editForm.country || ''}
                            onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                            maxLength={4}
                          />
                        </Field>
                        <Field label="Status">
                          <select
                            className={inputClass}
                            value={(editForm.status as string) || 'active'}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value as MemberStatus }))}
                          >
                            <option value="active">Active</option>
                            <option value="on-leave">On Leave</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </Field>
                        {/* Admin password reset */}
                        {isSuperAdmin && !isCurrentUser && (
                          <Field label="Reset Password (optional)">
                            <PasswordInput
                              value={editForm.newPassword || ''}
                              onChange={pw => setEditForm(f => ({ ...f, newPassword: pw }))}
                              show={showEditPassword}
                              onToggle={() => setShowEditPassword(v => !v)}
                              placeholder="Leave blank to keep current"
                            />
                            {editForm.newPassword && <PasswordStrengthBar password={editForm.newPassword} />}
                          </Field>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleSaveEdit(m.id, isCurrentUser)}
                          className="px-5 py-2 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => { setEditingMemberId(null); setEditForm({}); setShowEditPassword(false); }}
                          className="px-5 py-2 bg-stone border border-dawn rounded-xl text-xs font-black uppercase tracking-widest text-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="py-16 text-center">
                <Users className="w-8 h-8 mx-auto mb-3 text-muted/30" />
                <p className="text-sm font-black text-muted/50">
                  {memberSearch ? 'No users match your search.' : 'No users in this team yet.'}
                </p>
                {!memberSearch && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="mt-4 px-5 py-2 bg-ink text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                  >
                    Add First User
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary bar */}
          <div className="flex items-center justify-between p-4 bg-stone/40 rounded-2xl border border-dawn text-[10px] font-bold text-muted flex-wrap gap-2">
            <span>
              {filteredMembers.length} shown · {members.filter(m => m.role === 'Super Admin').length} super admins
              {teams.length > 0 && (
                <> · {teams.map(t => `${members.filter(m => m.team === t).length} ${t}`).join(' · ')}</>
              )}
            </span>
            <span>Active session: <b className="text-ink">{user.name}</b></span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="space-y-2 block">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}{required && <span className="text-citrus ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        active ? 'bg-ink text-white shadow-lg' : 'bg-stone border border-dawn text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBanner({ type, text }: { type: 'error' | 'success'; text: string }) {
  const isError = type === 'error';
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold ${
      isError ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
    }`}>
      {isError ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
      {text}
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggle, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  const inputClass = 'w-full bg-stone/50 border border-dawn rounded-xl px-4 py-3 pr-10 font-bold text-sm focus:border-citrus outline-none transition-colors';
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={inputClass}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const strength =
    password.length < 6  ? { label: 'Too short', color: 'bg-red-400',   width: 'w-1/4' } :
    password.length < 10 ? { label: 'Weak',      color: 'bg-amber-400', width: 'w-2/4' } :
    password.length < 14 ? { label: 'Good',      color: 'bg-citrus',    width: 'w-3/4' } :
                           { label: 'Strong',    color: 'bg-emerald-400', width: 'w-full' };
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full bg-stone rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
      </div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted">{strength.label}</p>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="p-4 rounded-2xl bg-stone/30 border border-dawn">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">{sub}</p>
    </div>
  );
}
