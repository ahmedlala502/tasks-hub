/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ArrowLeft,
  MapPin,
  Instagram,
  Globe,
  Users,
  TrendingUp,
  Star,
  CheckCircle2,
  Layers,
  BarChart3,
  Zap,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Video,
  Youtube,
  Activity,
  Clock,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../utils';
import { motion } from 'motion/react';
import { dataService } from '../services/dataService';
import { exportInfluencers } from '../services/spreadsheetService';

const PERFORMANCE_METRICS = [
  { label: 'Avg. Engagement', value: '8.4%', trend: '+1.2%', up: true, sub: 'Avg: 6.5%' },
  { label: 'Conversion Rate', value: '3.2%', trend: 'Steady', up: null, sub: 'Avg: 2.8%' },
  { label: 'Content Quality', value: 'A+', trend: 'Peak', up: true, sub: 'Internal Score' },
  { label: 'Est. Media Value', value: '$42K', trend: '+15%', up: true, sub: 'Estimated EMV' },
];

const AUDIENCE_BARS = [
  { label: 'Riyadh Core', val: 42, color: 'bg-gc-orange' },
  { label: 'Male 24–34', val: 68, color: 'bg-gc-purple' },
  { label: 'Tech Interest', val: 89, color: 'bg-emerald-500' },
];

const PORTFOLIO = [
  { campaign: 'Red Bull Summer KSA', status: 'In Flight', date: 'Oct 2024', niche: 'Lifestyle / Action' },
  { campaign: 'STC Pay Launch', status: 'Completed', date: 'Aug 2024', niche: 'Fintech / UX' },
  { campaign: 'Almarai Fresh', status: 'Completed', date: 'Jun 2024', niche: 'Social Impact' },
];

const getPlatformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case 'instagram': return Instagram;
    case 'tiktok': return Video;
    case 'youtube': return Youtube;
    case 'snapchat': return Smartphone;
    default: return Globe;
  }
};

const getPlatformUrl = (platform: string, handle: string) => {
  const h = handle?.replace('@', '');
  switch (platform?.toLowerCase()) {
    case 'instagram': return `https://instagram.com/${h}`;
    case 'tiktok': return `https://tiktok.com/@${h}`;
    case 'youtube': return `https://youtube.com/@${h}`;
    case 'snapchat': return `https://snapchat.com/add/${h}`;
    default: return `https://${platform?.toLowerCase()}.com/${h}`;
  }
};

export default function InfluencerProfile() {
  const navigate = useNavigate();
  const { id } = useParams();

  const influencer = React.useMemo(
    () => dataService.getInfluencers().find(i => i.id === id),
    [id]
  );

  if (!influencer) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <h2 className="text-2xl font-black text-muted-foreground uppercase tracking-widest">Creator Not Found</h2>
        <button
          onClick={() => navigate('/influencers')}
          className="bg-gc-orange text-white px-4 py-2.5 rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors"
        >
          Return to Roster
        </button>
      </div>
    );
  }

  const PlatformIcon = getPlatformIcon(influencer.platform);

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-white dark:bg-card rounded-xl p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gc-orange" />

        <div className="relative z-10 flex items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-xl bg-gc-orange/10 border-2 border-gc-orange/20 flex items-center justify-center text-2xl font-black text-gc-orange font-condensed select-none">
              {influencer.username.substring(1, 3).toUpperCase()}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-card flex items-center justify-center">
              <ShieldCheck className="h-2.5 w-2.5 text-white" />
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-condensed font-black text-[26px] tracking-tight text-foreground leading-none">
                {influencer.username}
              </h1>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border',
                influencer.status === 'Confirmed'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                  : influencer.status === 'Dropped'
                  ? 'bg-red-50 text-red-500 border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
              )}>
                <Star className="h-3 w-3" fill="currentColor" />
                {influencer.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {influencer.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {influencer.city}{influencer.country ? `, ${influencer.country}` : ''}
                </span>
              )}
              <a
                href={getPlatformUrl(influencer.platform, influencer.username)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-gc-orange hover:underline transition-colors"
              >
                <PlatformIcon className="h-3 w-3" />
                {influencer.platform}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {influencer.followerRange}
              </span>
              {influencer.niche && (
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  {influencer.niche}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-10 flex flex-wrap gap-2 shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 bg-gc-orange text-white rounded-lg text-[11px] font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors shadow-sm shadow-gc-orange/20">
            <Zap className="h-3.5 w-3.5" fill="currentColor" /> Deploy Invitation
          </button>
          <button onClick={() => exportInfluencers([influencer])} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> Export Data
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PERFORMANCE_METRICS.map((m) => (
          <div
            key={m.label}
            className="bg-white dark:bg-card rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">{m.label}</p>
            <p className="text-3xl font-bold text-foreground tabular-nums leading-tight">{m.value}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{m.sub}</span>
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
                m.up === true ? 'text-emerald-500' : m.up === false ? 'text-red-500' : 'text-gc-purple'
              )}>
                {m.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Audience Pulse */}
        <div className="xl:col-span-4 bg-card border border-border rounded-xl p-6 space-y-5">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Audience Intelligence</p>
            <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Audience Pulse</h3>
          </div>

          <div className="space-y-4">
            {AUDIENCE_BARS.map((b) => (
              <div key={b.label} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="text-foreground tabular-nums">{b.val}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', b.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${b.val}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-gc-orange/5 border border-gc-orange/15 rounded-xl">
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange mb-1.5">Insight</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Highest resonance in Riyadh's tech cluster. Content depth exceeds peer median by 2.4×. Strong seasonal alignment for Summer KSA.
            </p>
          </div>
        </div>

        {/* Creator Details */}
        <div className="xl:col-span-8 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Record Details</p>
              <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Creator Dossier</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-border">
            {[
              { label: 'Influencer ID', value: influencer.influencerId || influencer.id },
              { label: 'Platform', value: influencer.platform },
              { label: 'Niche', value: influencer.niche || '—' },
              { label: 'Follower Range', value: influencer.followerRange },
              { label: 'Campaign ID', value: influencer.campaignId || '—' },
              { label: 'Owner', value: influencer.ownerId || '—' },
              { label: 'Invitation Wave', value: influencer.invitationWave != null ? `Wave ${influencer.invitationWave}` : '—' },
              { label: 'Visit Completed', value: influencer.visitCompleted ? 'Yes' : 'No' },
              { label: 'Coverage Received', value: influencer.coverageReceived ? 'Yes' : 'No' },
              { label: 'QA Status', value: influencer.qaStatus || '—' },
              { label: 'Reminder 1', value: influencer.reminder1Sent ? 'Sent' : 'Pending' },
              { label: 'Reminder 2', value: influencer.reminder2Sent ? 'Sent' : 'Pending' },
            ].map((row) => (
              <div key={row.label} className="px-5 py-4">
                <p className="text-[9.5px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-0.5">{row.label}</p>
                <p className="text-[13px] font-semibold text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Collaborative Portfolio ─────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">History</p>
            <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Collaborative Portfolio</h3>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            Full Audit <ArrowLeft className="h-3 w-3 rotate-180" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Campaign</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Niche</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PORTFOLIO.map((p, i) => (
                <tr key={i} className="hover:bg-accent/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gc-orange/10 border border-gc-orange/20 flex items-center justify-center text-gc-orange group-hover:bg-gc-orange group-hover:text-white transition-all">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[13px] font-semibold text-foreground group-hover:text-gc-orange transition-colors">{p.campaign}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-semibold text-muted-foreground">{p.niche}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3 w-3" />{p.date}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border',
                      p.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                    )}>
                      {p.status === 'Completed' ? <CheckCircle2 className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
