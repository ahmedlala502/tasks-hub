import type { OpsDepartment, OpsOffice, OpsRole, OpsUser } from '../auth/types';
import { supabase } from '../lib/supabase';

type AdminApiUser = OpsUser;

async function invokeFunction<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      action,
      ...(payload || {}),
    },
  });

  if (error) {
    throw new Error(error.message || 'Edge Function request failed.');
  }

  return data as T;
}

export const adminApi = {
  async listUsers(): Promise<AdminApiUser[]> {
    return invokeFunction<AdminApiUser[]>('listUsers');
  },

  async createUser(payload: { name: string; email: string; password: string; role: OpsRole; office: OpsOffice; department?: OpsDepartment; title?: string }) {
    return invokeFunction<AdminApiUser>('createUser', payload);
  },

  async updateUser(payload: { id: string; name?: string; role?: OpsRole; status?: 'active' | 'suspended'; office?: OpsOffice; department?: OpsDepartment; title?: string }) {
    return invokeFunction<AdminApiUser>('updateUser', payload);
  },

  async deleteUser(id: string) {
    return invokeFunction<{ success: boolean }>('deleteUser', { id });
  },
};
