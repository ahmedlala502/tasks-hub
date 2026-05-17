import React, { useState } from 'react';
import { useAuth } from '../App';
import { Button } from '../components/ui/button';
import { ShieldCheck, Command } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (error: any) {
      setError(error.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-card border border-border shadow-2xl">
          <Command className="h-8 w-8 text-gc-orange" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-condensed text-[32px] font-extrabold tracking-tight uppercase leading-none">TryGC OPS</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Command Center</p>
        </div>
      </div>
      
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <h2 className="font-condensed text-[20px] font-bold uppercase tracking-tight">Authentication Required</h2>
          <p className="text-[12px] text-muted-foreground font-medium">Sign in with your Supabase workspace account to access the operations dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-semibold text-foreground outline-none focus:border-gc-orange"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-semibold text-foreground outline-none focus:border-gc-orange"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gc-orange text-white hover:bg-gc-orange/90 h-11 font-condensed font-bold uppercase tracking-wider text-[14px] disabled:opacity-60"
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
        
        <div className="flex items-center justify-center gap-2 pt-4 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-bold font-condensed">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Supabase Secure Access</span>
        </div>
      </div>
      
      <p className="mt-12 font-mono text-[10px] text-muted-foreground/40 font-bold">
        SYSTEM_ID: TRYGC_OPS_V1 // STATUS: STANDBY
      </p>
    </div>
  );
}
