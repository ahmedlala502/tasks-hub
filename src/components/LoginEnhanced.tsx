import React, { useState, useMemo } from 'react';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff,
  Lock, Loader2, Shield, UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalData } from './LocalDataContext';
import { validateEmail, validatePasswordField, passwordStrengthScore } from '../lib/authService';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  isLocked?: boolean;
}

type Tab = 'signin' | 'signup';

// ─────────────────────────────────────────────────────────────────
export default function LoginEnhanced({ onLogin, isLocked }: LoginProps) {
  const { pendingSignups, users, requestSignup, settings } = useLocalData();

  const [tab, setTab]     = useState<Tab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Sign-in state
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Signup state
  const [su, setSu] = useState({
    name: '',
    email: '',
    password: '',
    team:    settings.teams?.[0]    || 'Operations Team',
    office:  settings.locations?.[0] || 'Cairo HQ',
    country: 'EG',
  });
  const [showSuPw, setShowSuPw] = useState(false);

  const pendingEmails  = useMemo(() => new Set(pendingSignups.map(r => r.email.toLowerCase())), [pendingSignups]);
  const approvedEmails = useMemo(() => new Set(users.map(u => u.email.toLowerCase())), [users]);

  const isPending = pendingEmails.has(email.trim().toLowerCase()) && !approvedEmails.has(email.trim().toLowerCase());

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  // ── Sign In ────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    const ev = validateEmail(email);
    if (!ev.valid) errs.email = ev.error;

    const pv = validatePasswordField(password);
    if (!pv.valid) errs.password = pv.error;

    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      const res = await onLogin(email.trim(), password);
      if (!res.ok) {
        const msg = res.error || '';
        if (msg.includes('pending'))
          setError('Your request is still pending admin approval.');
        else if (msg.includes('password') || msg.includes('Invalid') || msg.includes('Incorrect'))
          setError('Incorrect email or password.');
        else if (msg.includes('not found') || msg.includes('No account') || msg.includes('No approved'))
          setError('No account found. Use "Request Access" to sign up.');
        else
          setError(msg || 'Sign in failed. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Request Access ─────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!su.name.trim())            errs.name = 'Full name is required.';
    const ev = validateEmail(su.email);
    if (!ev.valid)                  errs.email = ev.error;
    const pv = validatePasswordField(su.password);
    if (!pv.valid)                  errs.password = pv.error;

    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      const res = await requestSignup(su);
      if (!res.ok) {
        setError(res.error || 'Request failed. Please try again.');
      } else {
        setSuccess('Access request submitted. An admin will approve your account shortly.');
        setSu({ ...su, name: '', email: '', password: '' });
        setTimeout(() => switchTab('signin'), 4000);
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrengthScore(su.password);
  const strengthLabel =
    !su.password ? null :
    strength < 40  ? { text: 'Weak',   bar: 'w-1/4 bg-red-400'    } :
    strength < 70  ? { text: 'Fair',   bar: 'w-2/4 bg-amber-400'  } :
    strength < 100 ? { text: 'Good',   bar: 'w-3/4 bg-citrus'     } :
                     { text: 'Strong', bar: 'w-full bg-emerald-400' };

  // ── Locked session ─────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="min-h-screen w-full bg-stone flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center space-y-6 border border-dawn"
        >
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="relaxed-title text-2xl text-ink">Session Locked</h2>
            <p className="text-sm text-muted font-medium mt-2 leading-relaxed">
              Your session was locked due to inactivity. Sign in again to continue.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-ink text-white rounded-xl font-semibold hover:bg-ink/90 transition-all active:scale-[0.98]"
          >
            Unlock Session
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main auth screen ───────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-stone flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-ink rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-ink/10">
            <Shield className="w-7 h-7 text-citrus" />
          </div>
          <h1 className="relaxed-title text-2xl text-ink">TryGC Hub Manager</h1>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Operations Control Center</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-dawn shadow-sm p-8 space-y-6">

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-stone rounded-xl">
            {(['signin', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Request Access'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'signin' ? (
              <motion.form
                key="signin"
                onSubmit={handleSignIn}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
                noValidate
              >
                {/* Email */}
                <FormField label="Email" error={fieldErrors.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                    placeholder="name@company.com"
                    className={inputCls(!!fieldErrors.email)}
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                  />
                </FormField>

                {/* Password */}
                <FormField label="Password" error={fieldErrors.password}>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }}
                      placeholder="Enter your password"
                      className={`${inputCls(!!fieldErrors.password)} pr-11`}
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>

                {/* Pending notice */}
                {isPending && (
                  <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Your access request is still pending admin approval.
                  </p>
                )}

                {/* Error */}
                {error && <ErrorBanner text={error} />}

                <button
                  type="submit"
                  disabled={loading || isPending}
                  className="w-full py-3 bg-ink text-white rounded-xl font-semibold text-sm hover:bg-ink/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                    : <><Lock className="w-4 h-4" /> Sign In</>}
                </button>
              </motion.form>

            ) : (
              <motion.form
                key="signup"
                onSubmit={handleSignUp}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
                noValidate
              >
                {success && (
                  <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-700 font-medium">{success}</p>
                  </div>
                )}

                {/* Name + Email */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Full Name" error={fieldErrors.name}>
                    <input
                      type="text"
                      value={su.name}
                      onChange={e => { setSu(s => ({ ...s, name: e.target.value })); setFieldErrors(p => ({ ...p, name: '' })); }}
                      placeholder="Sara Ahmed"
                      className={inputCls(!!fieldErrors.name)}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Email" error={fieldErrors.email}>
                    <input
                      type="email"
                      value={su.email}
                      onChange={e => { setSu(s => ({ ...s, email: e.target.value })); setFieldErrors(p => ({ ...p, email: '' })); }}
                      placeholder="name@company.com"
                      className={inputCls(!!fieldErrors.email)}
                      disabled={loading}
                    />
                  </FormField>
                </div>

                {/* Password */}
                <FormField label="Password" error={fieldErrors.password}>
                  <div className="relative">
                    <input
                      type={showSuPw ? 'text' : 'password'}
                      value={su.password}
                      onChange={e => { setSu(s => ({ ...s, password: e.target.value })); setFieldErrors(p => ({ ...p, password: '' })); }}
                      placeholder="Create a password (min. 6 chars)"
                      className={`${inputCls(!!fieldErrors.password)} pr-11`}
                      disabled={loading}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowSuPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
                      {showSuPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {strengthLabel && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1 w-full bg-stone rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strengthLabel.bar}`} />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted">{strengthLabel.text}</p>
                    </div>
                  )}
                </FormField>

                {/* Team / Office / Country */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Team',    key: 'team',    opts: settings.teams    || ['Operations Team', 'Community Team'] },
                    { label: 'Office',  key: 'office',  opts: settings.locations || ['Cairo HQ'] },
                    { label: 'Country', key: 'country', opts: ['KSA', 'UAE', 'KW', 'EG', 'BH', 'QA', 'OM'] },
                  ].map(({ label, key, opts }) => (
                    <FormField key={key} label={label}>
                      <select
                        value={su[key as keyof typeof su]}
                        onChange={e => setSu(s => ({ ...s, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-dawn bg-stone/50 text-sm font-medium focus:border-citrus outline-none transition-colors"
                        disabled={loading}
                      >
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </FormField>
                  ))}
                </div>

                {error && <ErrorBanner text={error} />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-citrus text-white rounded-xl font-semibold text-sm hover:bg-citrus/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><UserPlus className="w-4 h-4" /> Request Access</>}
                </button>

                <p className="text-center text-[11px] text-muted leading-relaxed">
                  Your request will be reviewed and approved by a workspace admin.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted/50">
          TryGC Hub Manager v2.0 · Secure Local Workspace
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    'w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-colors',
    hasError
      ? 'border-red-300 bg-red-50/50 focus:border-red-400'
      : 'border-dawn bg-stone/50 focus:border-citrus',
  ].join(' ');
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black uppercase tracking-widest text-muted">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
    >
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-600 font-medium">{text}</p>
    </motion.div>
  );
}
