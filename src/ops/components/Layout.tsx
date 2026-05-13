import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  LayoutDashboard, LogOut, Bell,
  Settings, ShieldCheck, AlertTriangle, History,
  Shield, BarChart3, MessageSquare, CheckSquare, Flame,
  Sun, Moon, RefreshCw, Download,
  ChevronRight,
  Search, X, SlidersHorizontal, Check, Clock, CircleAlert, CheckCircle2, UserRound
} from 'lucide-react';
import { cn } from '../lib/utils';
import { notificationService, AppNotification } from '../services/notificationService';
import { exportAllData, downloadJson } from '../services/dataService';
import { canAccessPath, getRoleLabel } from '../lib/access';
import { getWorkspaceLabel } from '../lib/workspace';
import ErrorBoundary from '../../components/ErrorBoundary';

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
};

// ── Nav items ─────────────────────────────────────────────
const OPS_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',      path: '/' },
  { icon: RefreshCw,       label: 'Handover',       path: '/handover' },
  { icon: CheckSquare,     label: 'Tasks',          path: '/tasks' },
  { icon: Flame,           label: 'Priority Board', path: '/priority-board' },
  { icon: AlertTriangle,   label: 'Blockers',       path: '/blockers' },
  { icon: BarChart3,       label: 'Reporting',      path: '/reporting' },
];

const SYSTEM_NAV: NavItem[] = [
  { icon: UserRound,     label: 'Profile',     path: '/profile' },
  { icon: MessageSquare, label: 'Templates',  path: '/templates' },
  { icon: History,       label: 'Audit Logs', path: '/audit' },
  { icon: Settings,      label: 'Settings',   path: '/settings' },
  { icon: Shield,        label: 'Admin',      path: '/admin' },
];

// ── Page label lookup ─────────────────────────────────────
const ALL_NAV = [...OPS_NAV, ...SYSTEM_NAV];
const ACCENTS = [
  { name: 'Reference Orange', value: '#f97316' },
  { name: 'Deep Orange', value: '#ea580c' },
  { name: 'Executive Purple', value: '#6b21a8' },
  { name: 'Success Green', value: '#16a34a' },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getPageLabel(pathname: string): string {
  const exact = ALL_NAV.find(i => i.path === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith('/tasks/')) return 'Tasks';
  if (pathname === '/online-users') return 'Online Users';
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/setup')) return 'Campaign Setup';
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/closure')) return 'Campaign Closure';
  if (pathname.startsWith('/campaigns/')) return 'Campaign Detail';
  if (pathname.startsWith('/influencers/')) return 'Influencer Profile';
  return 'Dashboard';
}

// ── NavLink ───────────────────────────────────────────────
const NavLink: React.FC<{ item: NavItem; active: boolean; compact?: boolean }> = ({ item, active, compact }) => {
  return (
    <Link
      to={item.path}
      title={compact ? item.label : undefined}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-[12px] font-medium transition-all duration-150',
        compact && 'justify-center px-2',
        active
          ? 'bg-gc-orange/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
      )}
    >
      <item.icon className={cn(
        'h-3.5 w-3.5 shrink-0 transition-colors',
        active ? 'text-gc-orange' : 'group-hover:text-foreground'
      )} />
      <span className={cn("truncate", compact && "hidden")}>{item.label}</span>
      {active && !compact && <div className="ml-auto w-1 h-4 rounded-full bg-gc-orange" />}
    </Link>
  );
};

// ── Section label ─────────────────────────────────────────
function NavSection({ label }: { label: string }) {
  return (
    <div className="px-5 pt-4 pb-1">
      <p className="text-[9px] font-bold uppercase tracking-[1.6px] text-muted-foreground/50">{label}</p>
    </div>
  );
}

export default function Layout() {
  const { user, logout, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('trygc-dark');
    const isDark = saved === 'true';
    if (isDark) document.documentElement.classList.add('dark');
    return isDark;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [density, setDensity] = useState(() => localStorage.getItem('trygc-density') || 'comfortable');
  const [accent, setAccent] = useState(() => localStorage.getItem('trygc-accent') || '#f97316');
  const [compactSidebar, setCompactSidebar] = useState(() => localStorage.getItem('trygc-compact-sidebar') === 'true');
  const [notifications, setNotifications] = useState<AppNotification[]>(() => notificationService.getAll());

  const refreshNotifications = useCallback(() => {
    setNotifications(notificationService.getAll());
  }, []);

  useEffect(() => {
    const handler = () => refreshNotifications();
    window.addEventListener('gc-notification', handler);
    return () => window.removeEventListener('gc-notification', handler);
  }, [refreshNotifications]);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary', accent);
    document.documentElement.style.setProperty('--gc-orange', accent);
    localStorage.setItem('trygc-accent', accent);
  }, [accent]);

  React.useEffect(() => {
    localStorage.setItem('trygc-density', density);
    document.documentElement.dataset.density = density;
  }, [density]);

  React.useEffect(() => {
    localStorage.setItem('trygc-compact-sidebar', String(compactSidebar));
  }, [compactSidebar]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('trygc-dark', String(next));
  };

  const initials = user?.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U';
  const pageLabel = getPageLabel(location.pathname);
  const unreadCount = notifications.filter(n => !n.read).length;
  const workspaceNav = OPS_NAV.filter(item => canAccessPath(role, item.path));
  const systemNav = SYSTEM_NAV.filter(item => canAccessPath(role, item.path));
  const workspaceLabel = getWorkspaceLabel(role);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border relative overflow-hidden transition-[width,min-width] duration-200",
        compactSidebar ? "w-[72px] min-w-[72px]" : "w-[256px] min-w-[256px]"
      )}>
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--sidebar-glow) 0%, transparent 70%)' }} />

        {/* Brand */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-sidebar-border relative z-10">
          <div className="w-8 h-8 shrink-0">
            <svg viewBox="0 0 34 34" fill="none" className="w-full h-full">
              <circle cx="13" cy="12" r="8.5" stroke="var(--gc-orange)" strokeWidth="2.8"/>
              <circle cx="13" cy="12" r="4" fill="var(--gc-orange)"/>
              <circle cx="22" cy="6" r="2.4" fill="var(--gc-purple)"/>
              <path d="M5 22 Q5 30 13 30 Q19 30 21 27" stroke="var(--gc-purple)" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div className={cn(compactSidebar && "hidden")}>
            <div className="font-condensed font-extrabold text-[14px] tracking-[1px] leading-tight">TRYGC</div>
            <div className="text-[8.5px] font-bold tracking-[2px] uppercase text-muted-foreground/60 mt-0.5">{getRoleLabel(role)}</div>
          </div>
        </div>

        {/* Tagline */}
        <div className={cn("px-5 py-2.5 border-b border-sidebar-border", compactSidebar && "hidden")}>
          <p className="font-condensed text-[8.5px] font-bold tracking-[1.5px] uppercase">
            <span className="text-foreground">SPEAK. </span>
            <span className="text-gc-orange">CONNECT. </span>
            <span className="text-muted-foreground/50">IMPACT.</span>
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-hide relative z-10">
          {!compactSidebar && workspaceNav.length > 0 && <NavSection label={workspaceLabel} />}
          {workspaceNav.map(item => (
            <NavLink key={item.path} item={item} active={location.pathname === item.path} compact={compactSidebar} />
          ))}

          {systemNav.length > 0 && (
            <>
              {!compactSidebar && <NavSection label="System" />}
              {systemNav.map(item => (
                <NavLink key={item.path} item={item} active={location.pathname === item.path} compact={compactSidebar} />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 relative z-10">
          <div
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/60 transition-colors cursor-pointer group mb-1"
            onClick={() => navigate('/profile')}
            title="Open profile"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gc-purple to-gc-orange flex items-center justify-center text-[10px] font-extrabold text-white font-condensed shrink-0">
              {initials}
            </div>
            <div className={cn("flex-1 min-w-0", compactSidebar && "hidden")}>
              <p className="text-[11.5px] font-bold truncate font-condensed leading-tight">{user?.displayName || 'Admin'}</p>
              <p className="text-[9px] text-muted-foreground truncate">{getRoleLabel(role)}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all text-[11px] font-semibold"
          >
            <LogOut className="h-3 w-3" />
            {!compactSidebar && "Logout"}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-13 min-h-[52px] border-b border-border flex items-center justify-between px-5 bg-background shrink-0 z-[200]">
          {/* Page context */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-muted-foreground/50 text-[11px] font-medium">
              <span>TRYGC</span>
              <ChevronRight className="h-3 w-3" />
            </div>
            <h1 className="font-condensed font-extrabold text-[16px] tracking-[0.3px] text-foreground">{pageLabel}</h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Live pulse */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9.5px] font-bold text-emerald-500 font-mono tracking-[0.2px] mr-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>

            {/* Search */}
            {searchOpen ? (
              <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-3 py-1.5 w-48">
                <Search className="h-3 w-3 text-muted-foreground" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/40 text-foreground"
                  placeholder="Search..."
                  onBlur={() => setSearchOpen(false)}
                />
                <button onClick={() => setSearchOpen(false)}><X className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-gc-orange/50 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden lg:inline">Refresh</span>
            </button>

            <button
              onClick={() => downloadJson(exportAllData(), `trygc-export-${new Date().toISOString().slice(0, 10)}.json`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gc-orange text-white rounded-lg text-[11px] font-semibold hover:bg-gc-orange/90 transition-all"
              title="Export all workspace data as JSON"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Dark toggle */}
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gc-orange/50 transition-all"
            >
              {darkMode
                ? <Sun className="h-3.5 w-3.5" />
                : <Moon className="h-3.5 w-3.5" />
              }
            </button>

            <button
              onClick={() => setCustomizerOpen(true)}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gc-orange/50 transition-all"
              title="Customize workspace"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((value) => !value)}
                className={cn(
                  "relative p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gc-orange/50 transition-all",
                  notificationsOpen && "border-gc-orange text-foreground bg-gc-orange/10"
                )}
                title="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-gc-orange px-1 text-[9px] leading-4 text-white font-bold text-center">
                  {unreadCount}
                </span>
              </button>

              {notificationsOpen && (
                <NotificationPanel
                  items={notifications}
                  digestEnabled={digestEnabled}
                  onToggleDigest={() => setDigestEnabled((value) => !value)}
                  onClose={() => setNotificationsOpen(false)}
                  onMarkAllRead={() => {
                    notificationService.markAllRead();
                    refreshNotifications();
                  }}
                  onClearAll={() => {
                    notificationService.clearAll();
                    refreshNotifications();
                  }}
                  onNavigate={(path) => {
                    setNotificationsOpen(false);
                    navigate(path);
                  }}
                />
              )}
            </div>

          </div>
        </header>

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-y-auto bg-background transition-[padding] duration-200",
          density === 'compact' ? 'p-3' : density === 'spacious' ? 'p-7' : 'p-5',
          notificationsOpen && 'xl:pr-[390px]'
        )}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {customizerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setCustomizerOpen(false)}>
          <div
            className="h-full w-full max-w-sm bg-card border-l border-border shadow-xl p-5 overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">Workspace</p>
                <h2 className="text-lg font-bold text-foreground">Customize Command Center</h2>
              </div>
              <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground" onClick={() => setCustomizerOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Brand Accent</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ACCENTS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setAccent(item.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-border p-3 text-left hover:bg-accent transition-colors",
                        accent === item.value && "border-gc-orange bg-gc-orange/10"
                      )}
                    >
                      <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: item.value }} />
                      <span className="text-xs font-semibold flex-1">{item.name}</span>
                      {accent === item.value && <Check className="h-3.5 w-3.5 text-gc-orange" />}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Density</h3>
                <div className="grid grid-cols-3 gap-2">
                  {['compact', 'comfortable', 'spacious'].map((item) => (
                    <button
                      key={item}
                      onClick={() => setDensity(item)}
                      className={cn(
                        "rounded-lg border border-border px-3 py-2 text-xs font-semibold capitalize hover:bg-accent",
                        density === item && "border-gc-orange bg-gc-orange/10 text-gc-orange"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Compact Sidebar</h3>
                    <p className="text-xs text-muted-foreground mt-1">Use icon-first navigation for high-focus work.</p>
                  </div>
                  <button
                    onClick={() => setCompactSidebar((value) => !value)}
                    className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", compactSidebar ? "bg-gc-orange" : "bg-border")}
                  >
                    <span className={cn("block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", compactSidebar && "translate-x-5")} />
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationPanel({
  items,
  digestEnabled,
  onToggleDigest,
  onClose,
  onMarkAllRead,
  onClearAll,
  onNavigate,
}: {
  items: AppNotification[];
  digestEnabled: boolean;
  onToggleDigest: () => void;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNavigate: (path: string) => void;
}) {
  const toneMap = {
    orange: {
      dot: 'bg-gc-orange',
      icon: 'bg-orange-50 text-gc-orange border-orange-100 dark:bg-orange-900/20 dark:border-orange-900/40',
      badge: 'bg-orange-50 text-gc-orange border-orange-100 dark:bg-orange-900/20 dark:border-orange-900/40',
      label: 'Review',
    },
    red: {
      dot: 'bg-red-500',
      icon: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/40',
      badge: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/40',
      label: 'Alert',
    },
    purple: {
      dot: 'bg-purple-500',
      icon: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-900/40',
      badge: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-900/40',
      label: 'Event',
    },
    green: {
      dot: 'bg-green-500',
      icon: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/40',
      badge: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/40',
      label: 'Done',
    },
  };

  const critical = items.filter(n => n.tone === 'red').length;
  const pending = items.filter(n => n.tone === 'orange').length;
  const resolved = items.filter(n => n.tone === 'green').length;

  return (
    <>
    <button
      aria-label="Close notifications"
      className="fixed inset-0 z-[90] cursor-default bg-transparent"
      onClick={onClose}
    />
    <div className="fixed right-5 top-[60px] z-[100] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">Notifications</p>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Operations Alerts</h3>
        </div>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <>
              <button onClick={onMarkAllRead} className="rounded px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Mark read
              </button>
              <button onClick={onClearAll} className="rounded px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                Clear
              </button>
            </>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center dark:divide-gray-800 dark:border-gray-800">
        <div className="p-3">
          <p className="text-xl font-bold text-red-600">{critical}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Alerts</p>
        </div>
        <div className="p-3">
          <p className="text-xl font-bold text-gc-orange">{pending}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Review</p>
        </div>
        <div className="p-3">
          <p className="text-xl font-bold text-green-600">{resolved}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Done</p>
        </div>
      </div>

      <div className="max-h-[min(330px,calc(100vh-320px))] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No notifications yet. Activity from all pages will appear here.
          </div>
        ) : (
          items.map((item) => {
            const tone = toneMap[item.tone as keyof typeof toneMap];
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.path)}
                className={cn(
                  "group flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/70",
                  !item.read && "bg-orange-50/30 dark:bg-orange-900/5"
                )}
              >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tone.icon}`}>
                  {item.tone === 'green' ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("truncate text-sm font-semibold group-hover:text-gc-orange", item.read ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white")}>{item.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                      {tone.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.detail}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    <Clock className="h-3 w-3" />
                    {timeAgo(item.createdAt)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="space-y-3 bg-gray-50 p-4 dark:bg-gray-900/20">
        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-card">
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">Daily Digest</p>
            <p className="text-[11px] text-gray-400">Send summary at 9:00 AM.</p>
          </div>
          <button
            onClick={onToggleDigest}
            className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", digestEnabled ? "bg-gc-orange" : "bg-gray-300 dark:bg-gray-700")}
          >
            <span className={cn("block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", digestEnabled && "translate-x-5")} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate('/blockers')} className="rounded-lg bg-gc-orange px-3 py-2 text-xs font-bold text-white hover:bg-gc-orange/90">
            View Blockers
          </button>
          <button onClick={() => onNavigate('/tasks')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-card dark:text-gray-300 dark:hover:bg-gray-800">
            Open Tasks
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
