import React from 'react';
import { Home, CheckSquare, RefreshCw, Globe, MessageSquare, Settings, LogOut, TrendingUp, User as UserIcon, Users, Lock, ChevronLeft, ChevronRight, Bell, Shield, Activity } from 'lucide-react';
import { useLocalData } from './LocalDataContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getInitials, generateAvatarColor } from '../utils';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openSettingsTab?: (tab: string) => void;
  stats: {
    riskCount: number;
    handoverCount: number;
    openCount?: number;
    carryCount?: number;
  };
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, openSettingsTab, stats, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, logout, lock, isSuperAdmin, isMasterAdmin, canAccessPage, hasAdminAccess } = useLocalData();

  const menuItems = [
    { section: 'Intelligence' },
    { id: 'dashboard', label: 'Command Center', icon: Home, badge: stats.riskCount > 0 ? stats.riskCount : null, badgeColor: 'bg-red-500' },
    { id: 'reports', label: 'Analytics', icon: TrendingUp },
    { id: 'ai', label: 'AI Workspace', icon: MessageSquare, badge: null },
    { section: 'Operations' },
    { id: 'tasks', label: 'Task Register', icon: CheckSquare, badge: (stats.openCount ?? 0) > 0 ? stats.openCount : null, badgeColor: 'bg-blue-500' },
    { id: 'handover', label: 'Shift Handover', icon: RefreshCw, badge: stats.handoverCount > 0 ? stats.handoverCount : null, badgeColor: 'bg-citrus' },
    { id: 'offices', label: 'Office Map', icon: Globe },
    { id: 'team', label: 'Team Performance', icon: Users },
    { section: 'System' },
    { id: 'profile', label: 'User Manager', icon: UserIcon },
    { id: 'settings', label: 'Settings & Config', icon: Settings },
    ...(isMasterAdmin ? [{ id: 'activity', label: 'Activity Feed', icon: Activity, badge: null, badgeColor: '' }] : []),
  ];

  return (
    <aside
      className={cn(
        'bg-white border-r border-dawn flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-300 ease-in-out z-50',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <div className="flex items-center gap-3 mb-6 px-4 pt-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-citrus rounded-xl flex items-center justify-center shadow-lg shadow-citrus/20 shrink-0"
        >
          <span className="text-white font-black text-xl tracking-tighter italic">T</span>
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="min-w-0 overflow-hidden"
            >
              <span className="block font-bold text-lg tracking-tight text-ink leading-none truncate">TryGC Hub</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mt-0.5 block">Control Center</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggleCollapse}
          className="ml-auto p-1.5 hover:bg-stone rounded-lg transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted" /> : <ChevronLeft className="w-4 h-4 text-muted" />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto custom-scrollbar">
        {menuItems.filter(item => ('section' in item) || canAccessPage(item.id as any)).map((item, idx) => {
          if ('section' in item) {
            return (
              <AnimatePresence key={`section-${idx}`}>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] font-black uppercase tracking-[0.2em] text-muted/60 mt-4 mb-1.5 ml-3"
                  >
                    {item.section}
                  </motion.div>
                )}
              </AnimatePresence>
            );
          }

          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => {
                if (item.id === 'settings' && openSettingsTab) {
                  openSettingsTab('general');
                } else {
                  setActiveTab(item.id);
                }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'w-full flex items-center p-2.5 rounded-xl transition-all duration-200 group relative',
                isActive
                  ? 'bg-ink text-white font-bold shadow-md shadow-ink/10'
                  : 'text-muted hover:bg-stone/80 hover:text-ink font-semibold'
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={cn('relative flex items-center justify-center w-8 h-8 rounded-lg shrink-0', isActive ? 'bg-white/10' : '')}>
                <Icon className={cn('w-[18px] h-[18px]', isActive ? 'text-citrus' : 'text-muted group-hover:text-ink')} />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <>
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="ml-2.5 text-xs whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                    {item.badge && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          'ml-auto px-1.5 min-w-[20px] h-5 flex items-center justify-center text-[10px] font-black text-white rounded-md shadow-sm',
                          item.badgeColor || 'bg-gray-400'
                        )}
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </>
                )}
              </AnimatePresence>
              {collapsed && item.badge && (
                <span className={cn(
                  'absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-[9px] font-black text-white rounded-full',
                  item.badgeColor || 'bg-gray-400'
                )}>
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 px-2 pb-4 space-y-2 border-t border-dawn">
        <div className={cn('p-3 bg-stone/50 rounded-xl border border-dawn', collapsed && 'flex justify-center')} >
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3 mb-3')} >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-white border-2 border-white shadow-sm shrink-0',
              generateAvatarColor(user.name)
            )}>
              <span className="text-xs">{getInitials(user.name)}</span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="min-w-0 overflow-hidden"
                >
                  <span className="block text-sm font-bold text-ink leading-none truncate">{user.name}</span>
                  <span className="text-xs font-semibold text-muted mt-0.5 block truncate">{user.role}</span>
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-citrus/10 text-citrus rounded text-[8px] font-black uppercase tracking-widest">
                      <Shield className="w-2.5 h-2.5" />
                      Super Admin
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1"
              >
                <button
                  onClick={() => setActiveTab('profile')}
                  className="w-full flex items-center gap-2 p-2 text-xs font-bold transition-colors rounded-lg text-muted hover:text-ink hover:bg-white/60"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Profile Settings</span>
                </button>
                <button
                  onClick={() => { lock(); setActiveTab('dashboard'); }}
                  className="w-full flex items-center gap-2 p-2 text-xs font-bold text-muted hover:text-ink hover:bg-white/60 transition-colors rounded-lg"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Session</span>
                </button>
                <button
                  onClick={() => { logout(); setActiveTab('dashboard'); }}
                  className="w-full flex items-center gap-2 p-2 text-xs font-bold text-muted hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={cn('px-3 flex items-center gap-2', collapsed && 'justify-center')} >
          <Bell className="w-3 h-3 text-muted/40" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] font-bold text-muted/40"
              >
                v{APP_VERSION}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
