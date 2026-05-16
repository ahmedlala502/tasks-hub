import {
  getDepartmentFromMetadata,
  getOfficeFromMetadata,
  getRoleFromMetadata,
  type OpsDepartment,
  type OpsOffice,
  type OpsRole,
  type OpsUser,
} from '../auth/types';
import { supabase } from '../lib/supabase';

type AdminApiUser = OpsUser;

const USER_CACHE_KEY = 'trygc-admin-users-cache-v1';

function readUserCache(): AdminApiUser[] {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUserCache(users: AdminApiUser[]) {
  try {
    const byEmail = new Map<string, AdminApiUser>();
    users.forEach((user) => {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    });
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify([...byEmail.values()]));
  } catch {
    // Cache is a durability aid only; Supabase remains the source of truth.
  }
}

function upsertUserCache(user: AdminApiUser) {
  const next = [user, ...readUserCache().filter((item) => item.email.toLowerCase() !== user.email.toLowerCase())];
  writeUserCache(next);
}

function removeUserFromCache(id: string) {
  writeUserCache(readUserCache().filter((user) => user.uid !== id));
}

function isFunctionUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('failed to send a request') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('edge function') ||
    message.includes('function not found') ||
    message.includes('non-2xx status code') ||
    message.includes('missing required supabase secrets')
  );
}

async function getFunctionErrorMessage(error: unknown) {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string') return body.error;
      if (typeof body?.message === 'string') return body.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Fall through to the default message.
      }
    }
  }

  return error instanceof Error ? error.message : 'Edge Function request failed.';
}

async function invokeFunction<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action,
        ...(payload || {}),
      },
    });

    if (error) {
      const errorMessage = await getFunctionErrorMessage(error);
      
      // Provide helpful error messages
      if (errorMessage.includes('function not found') || errorMessage.includes('404')) {
        throw new Error(
          'Edge function not deployed. Please run: deploy-edge-functions.bat (Windows) or deploy-edge-functions.sh (Mac/Linux). ' +
          'Falling back to local user management.'
        );
      }
      
      if (errorMessage.includes('missing required supabase secrets')) {
        throw new Error(
          'Edge function is missing environment variables. Please set SUPABASE_SERVICE_ROLE_KEY using: ' +
          'supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key'
        );
      }
      
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error) {
    // Add context to network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(
        'Failed to connect to edge functions. Please check your internet connection and ensure the edge function is deployed. ' +
        'Run: deploy-edge-functions.bat (Windows) or deploy-edge-functions.sh (Mac/Linux)'
      );
    }
    throw error;
  }
}

function mapDirectoryRow(row: any): AdminApiUser {
  return {
    uid: row.uid,
    email: row.email || '',
    displayName: row.display_name || row.email?.split('@')[0] || 'Workspace User',
    role: getRoleFromMetadata(row.role),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    office: getOfficeFromMetadata(row.office),
    department: getDepartmentFromMetadata(row.department),
    title: row.title || 'Team Member',
    timezone: row.timezone || 'Africa/Cairo',
    createdAt: row.created_at ?? null,
    lastSignInAt: row.last_sign_in_at ?? null,
  };
}

async function listUsersFromDirectory(): Promise<AdminApiUser[]> {
  const { data, error } = await supabase
    .from('ops_user_directory' as any)
    .select('uid,email,display_name,role,status,office,department,title,timezone,created_at,last_sign_in_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDirectoryRow);
}

async function createUserWithSignupFallback(payload: {
  name: string;
  email: string;
  password: string;
  role: OpsRole;
  office: OpsOffice;
  department?: OpsDepartment;
  title?: string;
}): Promise<AdminApiUser> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSession = sessionData.session;
  const normalizedEmail = payload.email.trim().toLowerCase();
  const displayName = payload.name.trim();
  const department = payload.department ?? (payload.role === 'community' ? 'Coordination' : 'Operations');
  const title = payload.title ?? (payload.role === 'master' ? 'Master Admin' : payload.role === 'community' ? 'Community Access' : 'Operations Access');

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: payload.password,
    options: {
      data: {
        display_name: displayName,
        full_name: displayName,
        role: payload.role,
        office: payload.office,
        department,
        title,
        timezone: 'Africa/Cairo',
      },
    },
  });

  if (currentSession?.access_token && currentSession.refresh_token) {
    await supabase.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });
  }

  if (error) throw error;
  if (!data.user) throw new Error('Unable to create fallback Supabase user.');

  const createdUser: AdminApiUser = {
    uid: data.user.id,
    email: data.user.email || normalizedEmail,
    displayName,
    role: payload.role,
    status: 'active',
    office: payload.office,
    department,
    title,
    timezone: 'Africa/Cairo',
    createdAt: data.user.created_at,
    lastSignInAt: null,
  };

  upsertUserCache(createdUser);
  return createdUser;
}

async function updateUserWithDirectoryRpc(payload: {
  id: string;
  name?: string;
  role?: OpsRole;
  status?: 'active' | 'suspended';
  office?: OpsOffice;
  department?: OpsDepartment;
  title?: string;
}): Promise<AdminApiUser> {
  const { data, error } = await (supabase as any).rpc('update_ops_user_account', {
    p_id: payload.id,
    p_name: payload.name ?? null,
    p_role: payload.role ?? null,
    p_status: payload.status ?? null,
    p_office: payload.office ?? null,
    p_department: payload.department ?? null,
    p_title: payload.title ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('Unable to update user profile.');
  return mapDirectoryRow(data);
}

export const adminApi = {
  async listUsers(): Promise<AdminApiUser[]> {
    try {
      const users = await listUsersFromDirectory();
      if (users.length > 0) {
        writeUserCache(users);
        return users;
      }
    } catch {
      // The Edge Function remains a fallback for projects before the directory migration.
    }

    try {
      const users = await invokeFunction<AdminApiUser[]>('listUsers');
      writeUserCache(users);
      return users;
    } catch (error) {
      const cachedUsers = readUserCache();
      if (cachedUsers.length > 0 && isFunctionUnavailable(error)) return cachedUsers;
      throw error;
    }
  },

  async createUser(payload: { name: string; email: string; password: string; role: OpsRole; office: OpsOffice; department?: OpsDepartment; title?: string }) {
    try {
      const user = await invokeFunction<AdminApiUser>('createUser', payload);
      upsertUserCache(user);
      return user;
    } catch (error) {
      if (!isFunctionUnavailable(error)) throw error;
      return createUserWithSignupFallback(payload);
    }
  },

  async updateUser(payload: { id: string; name?: string; password?: string; role?: OpsRole; status?: 'active' | 'suspended'; office?: OpsOffice; department?: OpsDepartment; title?: string }) {
    try {
      const user = await invokeFunction<AdminApiUser>('updateUser', payload);
      upsertUserCache(user);
      return user;
    } catch (error) {
      if (!isFunctionUnavailable(error) || payload.password) throw error;
      const user = await updateUserWithDirectoryRpc(payload);
      upsertUserCache(user);
      return user;
    }
  },

  async deleteUser(id: string) {
    const result = await invokeFunction<{ success: boolean }>('deleteUser', { id });
    removeUserFromCache(id);
    return result;
  },
};
