import React, { Suspense, createContext, lazy, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { canAccessPath, getHomePath } from './lib/access';
import { dataService } from './services/dataService';
import { supabaseAuth } from './services/supabaseAuth';
import ErrorBoundary from '../components/ErrorBoundary';
import type { OpsDepartment, OpsOffice, OpsRole, OpsUser } from './auth/types';

import Updates from './pages/Updates';
import Login from './pages/Login';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyDashboard = lazy(() => import('./pages/MyDashboard'));
const LiveOps = lazy(() => import('./pages/LiveOps'));
const Admin = lazy(() => import('./pages/Admin'));
const Reporting = lazy(() => import('./pages/Reporting'));
const Tasks = lazy(() => import('./pages/Tasks'));
const DailyRoutines = lazy(() => import('./pages/DailyRoutines'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const OnlineUsers = lazy(() => import('./pages/OnlineUsers'));
const Templates = lazy(() => import('./pages/Templates'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AssetRegistry = lazy(() => import('./pages/AssetRegistry'));
const Handover = lazy(() => import('./pages/Handover'));
const Settings = lazy(() => import('./pages/Settings'));
const CampaignList = lazy(() => import('./pages/CampaignList'));
const CampaignIntake = lazy(() => import('./pages/CampaignIntake'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const CampaignSetup = lazy(() => import('./pages/CampaignSetup'));
const CampaignClosure = lazy(() => import('./pages/CampaignClosure'));
const InfluencerList = lazy(() => import('./pages/InfluencerList'));
const InfluencerProfile = lazy(() => import('./pages/InfluencerProfile'));

interface AuthContextType {
  user: OpsUser | null;
  role: OpsRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { displayName: string; office: OpsOffice; department: OpsDepartment; title: string; timezone: string }) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function LoadingView() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
      <div className="animate-pulse font-mono text-sm tracking-widest uppercase">Loading workspace...</div>
    </div>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default function App() {
  const [user, setUser] = useState<OpsUser | null>(null);
  const [role, setRole] = useState<OpsRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabaseAuth.getSessionUser().then(async (sessionUser) => {
      if (!mounted) return;
      if (sessionUser) await dataService.initializeCloudWorkspace();
      if (!mounted) return;
      setUser(sessionUser);
      setRole(sessionUser?.role || null);
      setLoading(false);
    });

    const subscription = supabaseAuth.onAuthStateChange((sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser);
      setRole(sessionUser?.role || null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const signedInUser = await supabaseAuth.signIn(email, password);
    await dataService.initializeCloudWorkspace();
    dataService.recordActivity({
      action: 'user.login',
      entityType: 'user',
      entityId: signedInUser.uid,
      summary: `${signedInUser.displayName} signed in`,
      metadata: { email: signedInUser.email, role: signedInUser.role },
    });
    setUser(signedInUser);
    setRole(signedInUser.role);
  };

  const logout = async () => {
    if (user) {
      dataService.recordActivity({
        action: 'user.logout',
        entityType: 'user',
        entityId: user.uid,
        summary: `${user.displayName} signed out`,
        metadata: { email: user.email, role: user.role },
      });
    }
    await supabaseAuth.signOut();
    setUser(null);
    setRole(null);
  };

  const updateProfile = async (payload: { displayName: string; office: OpsOffice; department: OpsDepartment; title: string; timezone: string }) => {
    const updatedUser = await supabaseAuth.updateProfile(payload);
    dataService.recordActivity({
      action: 'user.profile_updated',
      entityType: 'user',
      entityId: updatedUser.uid,
      summary: `${updatedUser.displayName} updated their profile`,
      metadata: { office: updatedUser.office, department: updatedUser.department, title: updatedUser.title },
    });
    setUser(updatedUser);
    setRole(updatedUser.role);
  };

  const updatePassword = async (password: string) => {
    const updatedUser = await supabaseAuth.updatePassword(password);
    setUser(updatedUser);
    setRole(updatedUser.role);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="animate-pulse font-mono text-sm tracking-widest uppercase">Initializing Command Center...</div>
      </div>
    );
  }

  const homePath = getHomePath(role);
  const redirectHome = <Navigate to={homePath} replace />;
  const allow = (path: string, element: React.ReactElement) => (canAccessPath(role, path) ? element : redirectHome);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, updateProfile, updatePassword }}>
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<LoadingView />}>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route
                path="/"
                element={user ? <Layout /> : <Navigate to="/login" />}
              >
                <Route index element={allow('/', <Dashboard />)} />
                <Route path="my-dashboard" element={allow('/my-dashboard', <MyDashboard />)} />
                <Route path="live-ops" element={allow('/live-ops', <LiveOps />)} />
                <Route path="handover" element={allow('/handover', <Handover />)} />
                <Route path="online-users" element={allow('/online-users', <OnlineUsers />)} />
                <Route path="blockers" element={<Navigate to="/live-ops" replace />} />
                <Route path="audit" element={allow('/audit', <Navigate to="/settings?section=audit-log" replace />)} />
                <Route path="reporting" element={allow('/reporting', <Reporting />)} />
                <Route path="tasks" element={allow('/tasks', <Tasks />)} />
                <Route path="tasks/:bucket" element={allow('/tasks', <Tasks />)} />
                <Route path="tasks-daily-routines" element={allow('/tasks-daily-routines', <DailyRoutines />)} />
                <Route path="daily-routines" element={allow('/daily-routines', <DailyRoutines />)} />
                <Route path="priority-board" element={<Navigate to="/tasks-daily-routines" replace />} />
                <Route path="profile" element={allow('/profile', <UserProfile />)} />
                <Route path="performance" element={allow('/performance', <UserProfile />)} />
                <Route path="templates" element={allow('/templates', <Templates />)} />
                <Route path="updates" element={allow('/updates', <Updates />)} />
                <Route path="analytics" element={allow('/analytics', <Analytics />)} />
                <Route path="assets" element={allow('/assets', <AssetRegistry />)} />
                <Route path="settings" element={allow('/settings', <Settings />)} />
                <Route path="admin" element={allow('/admin', <Admin />)} />
                <Route path="campaigns" element={allow('/', <CampaignList />)} />
                <Route path="campaigns/new" element={allow('/', <CampaignIntake />)} />
                <Route path="campaigns/:id" element={allow('/', <CampaignDetail />)} />
                <Route path="campaigns/:id/setup" element={allow('/', <CampaignSetup />)} />
                <Route path="campaigns/:id/closure" element={allow('/', <CampaignClosure />)} />
                <Route path="influencers" element={allow('/influencers', <InfluencerList />)} />
                <Route path="influencers/:id" element={allow('/influencers', <InfluencerProfile />)} />
                <Route path="*" element={redirectHome} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}
