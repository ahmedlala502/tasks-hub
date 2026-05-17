import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { Search, Plus, Loader2, Sparkles, Zap, User, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OFFICES, TEAMS } from './constants';
import { Status, Priority, Shift } from './types';
import { useLocalData } from './components/LocalDataContext';
import { APP_PAGES } from './lib/accessControl';
import { addToast } from './lib/toast';
// Eagerly loaded critical components
import LoginEnhanced from './components/LoginEnhanced';
import Sidebar from './components/Sidebar';
import SessionGuard from './components/SessionGuard';
import TaskModal from './components/TaskModal';
import ToastContainer from './components/ToastContainer';
import MasterExportBar from './components/MasterExportBar';

// Lazy load all views for code splitting
const Dashboard = lazy(() => import('./components/views/Dashboard'));
const TaskBoard = lazy(() => import('./components/views/TaskBoard'));
const HandoverFlow = lazy(() => import('./components/views/HandoverFlow'));
const AICopilot = lazy(() => import('./components/views/AICopilot'));
const OfficeRegister = lazy(() => import('./components/views/OfficeRegister'));
const SettingsView = lazy(() => import('./components/views/Settings'));
const Reporting = lazy(() => import('./components/views/Reporting'));
const TeamPerformance = lazy(() => import('./components/views/TeamPerformance'));
const UserProfilePage = lazy(() => import('./components/views/UserManager'));
const ActivityFeed = lazy(() => import('./components/views/ActivityFeed'));

const LoadingView = () => (
  <div className="flex-1 flex items-center justify-center min-h-96">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-citrus animate-spin" />
      <span className="text-sm font-bold text-muted">Loading view...</span>
    </div>
  </div>
);

function getInitialTab(): (typeof APP_PAGES)[number] {
  const tab = window.location.hash.replace('#', '').split(':')[0] as typeof APP_PAGES[number];
  return APP_PAGES.includes(tab) ? tab : 'dashboard';
}

function getInitialSettingsTab() {
  return window.location.hash.replace('#', '').split(':')[1] || 'general';
}

export default function App() {
  const { user, tasks, handovers, offices, members, settings, scopedTasks, scopedHandovers, scopedOffices, scopedMembers, loading, isReady, addTask, auth, login, currentTeam, canAccessPage, canUseFeature } = useLocalData();
  const [activeTab, setActiveTab] = useState<typeof APP_PAGES[number]>(() => getInitialTab());
  const [settingsTab, setSettingsTab] = useState(() => getInitialSettingsTab());
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);
  const [taskFilterPreset, setTaskFilterPreset] = useState('');
  const [taskStatusPreset, setTaskStatusPreset] = useState('All');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Theme initialization
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('trygc_theme') || 'flow';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Hash routing
  React.useEffect(() => {
    const syncFromHash = () => {
      const nextTab = getInitialTab();
      const nextSettingsTab = getInitialSettingsTab();
      if (canAccessPage(nextTab)) {
        setActiveTab(nextTab);
        if (nextTab === 'settings') setSettingsTab(nextSettingsTab);
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [canAccessPage]);

  React.useEffect(() => {
    const suffix = activeTab === 'settings' ? `:${settingsTab}` : '';
    window.history.replaceState(null, '', `#${activeTab}${suffix}`);
  }, [activeTab, settingsTab]);

  // Auto-redirect if page access is denied
  React.useEffect(() => {
    if (canAccessPage(activeTab)) return;
    const fallback = APP_PAGES.find(page => canAccessPage(page)) || 'dashboard';
    setActiveTab(fallback);
  }, [activeTab, canAccessPage]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for quick search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-quick-search]')?.focus();
      }
      // Cmd/Ctrl + N for new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (canUseFeature('task.create')) setIsGlobalTaskModalOpen(true);
      }
      // Cmd/Ctrl + / for keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
      }
      // Press 1-9 for tab navigation
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const accessiblePages = APP_PAGES.filter(page => canAccessPage(page));
        const page = accessiblePages[idx];
        if (page) setActiveTab(page);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canAccessPage, canUseFeature]);

  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const stats = useMemo(() => {
    const open = scopedTasks.filter(t => t.status !== Status.DONE);
    const risks = open.filter(t => t.priority === Priority.HIGH || t.status === Status.BLOCKED);
    return {
      openCount: open.length,
      riskCount: risks.length,
      carryCount: open.filter(t => t.carry).length,
      handoverCount: scopedHandovers.filter(h => h.status === 'Pending').length,
      totalTasks: scopedTasks.length,
      completedToday: scopedTasks.filter(t => {
        if (t.status !== Status.DONE || !t.completedAt) return false;
        return t.completedAt.startsWith(new Date().toISOString().split('T')[0]);
      }).length,
    };
  }, [scopedTasks, scopedHandovers]);

  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: number }[]>([
    { role: 'assistant', content: 'Operational intelligence is ready. How can I assist with your shift flow or risk synthesis today?', timestamp: Date.now() }
  ]);

  const openSettingsTab = useCallback((tab: string) => {
    setSettingsTab(tab);
    setActiveTab('settings');
  }, []);

  const openTasks = useCallback((filter = '', status = 'All') => {
    setTaskFilterPreset(filter);
    setTaskStatusPreset(status);
    setActiveTab('tasks');
  }, []);

  const saveTaskFromHeader = useCallback(async (taskData: Record<string, unknown>) => {
    await addTask({
      ...taskData,
      creatorId: (taskData.creatorId as string) || user.email,
      owner: (taskData.owner as string) || user.name,
    });
    setIsGlobalTaskModalOpen(false);
  }, [addTask, user.name, user.email]);

  const handleQuickAdd = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && quickAddTitle.trim() && !isQuickAdding) {
      setIsQuickAdding(true);
      try {
        await addTask({
          title: quickAddTitle.trim(),
          details: 'Quickly added task via Command Bar.',
          priority: Priority.MEDIUM,
          status: Status.BACKLOG,
          shift: Shift.MORNING,
          owner: user.name,
          country: user.country || 'KSA',
          office: user.office || OFFICES[0].name,
          team: currentTeam || TEAMS[0],
          creatorId: user.email,
          due: new Date().toISOString().split('T')[0],
          carry: false,
          dod: [],
        });
        setQuickAddTitle('');
        addToast('Task created from quick add', 'success', 3000);
      } catch {
        addToast('Quick add failed. Please try again.', 'error', 4000);
      } finally {
        setIsQuickAdding(false);
      }
    }
  }, [addTask, quickAddTitle, isQuickAdding, user.name, user.email, user.country, user.office, currentTeam]);

  if (!isReady || loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-stone">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <Sparkles className="w-16 h-16 text-citrus animate-pulse" />
            <div className="absolute inset-0 bg-citrus/20 blur-2xl rounded-full animate-pulse" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-ink animate-pulse">Initializing Ecosystem</p>
        </motion.div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginEnhanced onLogin={login} isLocked={auth.isLocked} />;
  }

  const renderContent = () => {
    const props = {
      tasks: scopedTasks,
      handovers: scopedHandovers,
      offices: scopedOffices,
      members: scopedMembers,
      stats,
      onActionRisks: () => openTasks('risk'),
      onGenerateBrief: () => setActiveTab(canAccessPage('ai') ? 'ai' : 'settings'),
      onNavigate: (tab: string, filter?: string, status?: string) => tab === 'tasks' ? openTasks(filter || '', status || 'All') : setActiveTab(tab as typeof APP_PAGES[number]),
    };

    switch (activeTab) {
      case 'dashboard': return <Dashboard {...props} />;
      case 'tasks': return <TaskBoard tasks={scopedTasks} initialFilter={taskFilterPreset} initialStatus={taskStatusPreset} />;
      case 'handover': return <HandoverFlow handovers={scopedHandovers} tasks={scopedTasks} stats={stats} aiInteractions={copilotMessages} />;
      case 'offices': return <OfficeRegister offices={scopedOffices} tasks={scopedTasks} />;
      case 'team': return <TeamPerformance members={scopedMembers} offices={scopedOffices} tasks={scopedTasks} handovers={scopedHandovers} />;
      case 'profile': return <UserProfilePage />;
      case 'reports': return <Reporting tasks={scopedTasks} handovers={scopedHandovers} stats={stats} />;
      case 'ai': return <AICopilot tasks={scopedTasks} handovers={scopedHandovers} messages={copilotMessages} setMessages={setCopilotMessages} />;
      case 'settings': return <SettingsView activeTab={settingsTab} setActiveTab={setSettingsTab} />;
      case 'activity': return <ActivityFeed />;
      default: return <Dashboard {...props} />;
    }
  };

  const pageTitle = {
    dashboard: 'Daily Rhythm',
    tasks: 'Task Register',
    handover: 'Shift Continuity',
    offices: 'Office Registry',
    team: 'Team Performance',
    profile: 'Your Profile',
    reports: 'Performance Reporting',
    settings: 'System Settings',
    ai: 'Operations Copilot',
    activity: 'Activity Feed',
  }[activeTab] || 'Operations Hub';

  const pageSubtitle = {
    dashboard: "A focused view of today's priorities and team flow.",
    tasks: 'Managing daily outcomes across all regions.',
    handover: 'Guiding the bridge between outgoing and incoming teams.',
    offices: 'Management of regional operating hubs and regional leads.',
    team: 'Member-level output, on-time rate, and handover accountability.',
    profile: 'Manage your profile, credentials, and user access.',
    reports: 'Statistical synthesis of regional outcomes and closure rates.',
    settings: 'Configure your workspace and preferences.',
    ai: 'AI intelligence layers for the modern workspace.',
    activity: 'Master-only real-time audit log of all workspace activity.',
  }[activeTab] || '';

  return (
    <div className="flex h-screen bg-stone overflow-hidden">
      <SessionGuard />
      <ToastContainer />
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab: string) => setActiveTab(tab as typeof APP_PAGES[number])}
        openSettingsTab={openSettingsTab}
        stats={stats}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-white/50 backdrop-blur-md border-b border-dawn shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="relaxed-title text-xl text-ink uppercase tracking-tight truncate">
                {pageTitle}
              </h1>
              <p className="text-xs text-muted font-medium truncate">{pageSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-citrus transition-colors" />
              <input
                data-quick-search
                type="text"
                placeholder="Find anything... (Ctrl+K)"
                className="pl-10 pr-4 py-2 bg-white/50 border border-dawn rounded-xl focus:outline-none focus:ring-2 focus:ring-citrus/20 focus:border-citrus transition-all w-48 lg:w-64 text-sm font-medium"
              />
            </div>

            <div className="relative group hidden md:block">
              {isQuickAdding ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-citrus animate-spin" />
              ) : (
                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-citrus transition-colors" />
              )}
              <input
                type="text"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={handleQuickAdd}
                placeholder="Quick add (Ctrl+N)..."
                disabled={isQuickAdding}
                className="pl-10 pr-4 py-2 bg-citrus/5 border border-citrus/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-citrus focus:border-citrus transition-all w-48 lg:w-56 text-sm font-bold placeholder:font-medium disabled:opacity-50 shadow-inner"
              />
            </div>

            {canUseFeature('task.create') && (
              <button
                onClick={() => setIsGlobalTaskModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-xl font-semibold text-sm hover:bg-ink/90 transition-all shadow-sm active:scale-95"
                title="New Task (Ctrl+N)"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:inline">New</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('profile')}
              className="p-2 hover:bg-stone rounded-xl transition-colors relative"
              title="View profile"
            >
              <User className="w-5 h-5 text-ink" />
              {stats.riskCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              <Suspense fallback={<LoadingView />}>
                {renderContent()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        <TaskModal
          isOpen={isGlobalTaskModalOpen}
          onClose={() => setIsGlobalTaskModalOpen(false)}
          onSave={saveTaskFromHeader}
        />

        {/* Master export/import floating bar - visible on every page */}
        <MasterExportBar activePage={activeTab} />
      </main>

      {/* Keyboard shortcuts help */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Command className="w-5 h-5 text-citrus" />
                  <h3 className="relaxed-title text-xl">Keyboard Shortcuts</h3>
                </div>
                <button
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="text-muted hover:text-ink transition-colors font-bold"
                >
                  Press Esc
                </button>
              </div>
              <div className="space-y-3">
                {[
                  ['Ctrl + K', 'Quick search'],
                  ['Ctrl + N', 'New task'],
                  ['Alt + 1-9', 'Navigate tabs'],
                  ['Ctrl + /', 'Toggle shortcuts'],
                  ['Esc', 'Close modals'],
                ].map(([shortcut, desc]) => (
                  <div key={shortcut} className="flex items-center justify-between py-2 border-b border-dawn last:border-0">
                    <span className="text-sm font-medium text-muted">{desc}</span>
                    <kbd className="px-2 py-1 bg-stone rounded-lg text-xs font-bold text-ink border border-dawn">{shortcut}</kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
