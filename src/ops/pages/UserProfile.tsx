import React, { useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../App';
import type { OpsDepartment } from '../auth/types';
import { dataService } from '../services/dataService';
import { notify } from '../services/notificationService';

const DEPARTMENTS: OpsDepartment[] = [
  'Operations',
  'Onboarding',
  'WhatsApp / Live Chat',
  'Coverage & Monitoring',
  'Coordination',
  'Quality & Training',
  'Systems & Automation',
  'Activation',
  'Account Managers',
  'Data Analysis',
];

export default function UserProfile() {
  const { user, updateProfile, updatePassword } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [department, setDepartment] = useState<OpsDepartment>(user?.department || 'Operations');
  const [title, setTitle] = useState(user?.title || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Cairo');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState('');

  const userTasks = useMemo(() => {
    if (!user) return [];
    return dataService.getTasks().filter((task) => task.ownerId.toLowerCase() === user.displayName.toLowerCase());
  }, [user]);

  const completedCount = userTasks.filter((task) => task.completed).length;
  const openCount = userTasks.length - completedCount;

  if (!user) return null;

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await updateProfile({
        displayName: displayName.trim(),
        department,
        title: title.trim() || 'Team Member',
        timezone: timezone.trim() || 'Africa/Cairo',
      });
      setMessage('Profile saved');
      notify('Profile Updated', `${displayName.trim()} profile details saved`, 'green', '/profile');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    setPasswordSaving(true);
    setMessage('');
    try {
      await updatePassword(password);
      setPassword('');
      setMessage('Password updated');
      notify('Password Updated', `${user.email} password changed`, 'green', '/profile');
    } catch (error: any) {
      setMessage(error.message || 'Unable to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gc-orange/10 text-gc-orange">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">User Profile</p>
              <h2 className="font-condensed text-2xl font-extrabold text-foreground">{user.displayName}</h2>
              <p className="text-xs font-semibold text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Role" value={user.role} />
            <Metric label="Done" value={String(completedCount)} />
            <Metric label="Open" value={String(openCount)} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gc-orange" />
            <h3 className="font-condensed text-lg font-extrabold text-foreground">Identity & Assignment Profile</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name">
              <input className="settings-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </Field>
            <Field label="Title">
              <input className="settings-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Department">
              <select className="settings-input" value={department} onChange={(event) => setDepartment(event.target.value as OpsDepartment)}>
                {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <input className="settings-input" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">These details drive task ownership, reminders, and profile visibility.</p>
            <button
              onClick={saveProfile}
              disabled={saving || !displayName.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gc-orange px-4 text-xs font-extrabold uppercase tracking-widest text-white hover:bg-gc-orange/90 disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-gc-orange" />
            <h3 className="font-condensed text-lg font-extrabold text-foreground">Password Access</h3>
          </div>
          <Field label="New password">
            <input
              className="settings-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </Field>
          <button
            onClick={savePassword}
            disabled={passwordSaving || password.length < 6}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-xs font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange disabled:opacity-60"
          >
            <KeyRound size={14} />
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </button>
          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black capitalize text-foreground">{value}</p>
    </div>
  );
}
