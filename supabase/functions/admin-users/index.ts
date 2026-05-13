import { createClient } from 'jsr:@supabase/supabase-js@2';

type OpsRole = 'master' | 'operations' | 'community';
type OpsStatus = 'active' | 'suspended';

type RequestPayload =
  | { action: 'listUsers' }
  | { action: 'createUser'; name: string; email: string; password: string; role: OpsRole; department?: string; title?: string }
  | { action: 'updateUser'; id: string; name?: string; role?: OpsRole; status?: OpsStatus; department?: string; title?: string }
  | { action: 'deleteUser'; id: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const bootstrapMasterEmail = (Deno.env.get('MASTER_ADMIN_EMAIL') ?? 'admin@trygc.com').trim().toLowerCase();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function assertEnv() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Edge Function is missing required Supabase secrets.');
  }
}

function normalizeRole(role: unknown): OpsRole {
  if (role === 'master' || role === 'operations' || role === 'community') return role;
  return 'operations';
}

function mapUser(user: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}) {
  const email = user.email ?? '';
  const metadataRole = normalizeRole(user.app_metadata?.role);
  const displayName =
    String(
      user.user_metadata?.display_name ??
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        email.split('@')[0] ??
        'Workspace User',
    ).trim() || 'Workspace User';

  return {
    uid: user.id,
    email,
    displayName,
    role: email.toLowerCase() === bootstrapMasterEmail ? 'master' : metadataRole,
    status: user.banned_until ? 'suspended' : 'active',
    department: user.user_metadata?.department ?? 'Operations',
    title: user.user_metadata?.title ?? (metadataRole === 'master' ? 'Master Admin' : 'Team Member'),
    timezone: user.user_metadata?.timezone ?? 'Africa/Cairo',
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

async function requireMaster(request: Request) {
  assertEnv();

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error('Unable to authenticate caller.');
  }

  const callerRole = normalizeRole(user.app_metadata?.role);
  const callerEmail = (user.email ?? '').toLowerCase();
  if (callerRole !== 'master' && callerEmail !== bootstrapMasterEmail) {
    throw new Error('Only master users can manage workspace accounts.');
  }

  return { serviceClient, userClient, caller: user };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const payload = (await request.json()) as RequestPayload;
    const { serviceClient } = await requireMaster(request);

    switch (payload.action) {
      case 'listUsers': {
        const { data, error } = await serviceClient.auth.admin.listUsers();
        if (error) throw error;
        return json((data.users ?? []).map(mapUser));
      }

      case 'createUser': {
        const role = normalizeRole(payload.role);
        const email = payload.email.trim().toLowerCase();

        const { data, error } = await serviceClient.auth.admin.createUser({
          email,
          password: payload.password,
          email_confirm: true,
          app_metadata: {
            role,
          },
          user_metadata: {
            display_name: payload.name.trim(),
            full_name: payload.name.trim(),
            department: payload.department ?? 'Operations',
            title: payload.title ?? (role === 'master' ? 'Master Admin' : 'Team Member'),
            timezone: 'Africa/Cairo',
          },
        });

        if (error || !data.user) throw error ?? new Error('Unable to create user.');
        return json(mapUser(data.user), 201);
      }

      case 'updateUser': {
        const updateData: {
          app_metadata?: { role: OpsRole };
          user_metadata?: {
            display_name: string;
            full_name?: string;
            department?: string;
            title?: string;
            timezone?: string;
          };
          ban_duration?: 'none' | '876000h';
        } = {};

        if (payload.role) {
          updateData.app_metadata = { role: normalizeRole(payload.role) };
        }

        if (payload.name?.trim()) {
          updateData.user_metadata = {
            display_name: payload.name.trim(),
            full_name: payload.name.trim(),
            department: payload.department ?? 'Operations',
            title: payload.title ?? 'Team Member',
            timezone: 'Africa/Cairo',
          };
        } else if (payload.department || payload.title) {
          updateData.user_metadata = {
            display_name: '',
            full_name: '',
            department: payload.department ?? 'Operations',
            title: payload.title ?? 'Team Member',
            timezone: 'Africa/Cairo',
          };
        }

        if (payload.status) {
          updateData.ban_duration = payload.status === 'suspended' ? '876000h' : 'none';
        }

        const { data, error } = await serviceClient.auth.admin.updateUserById(payload.id, updateData);
        if (error || !data.user) throw error ?? new Error('Unable to update user.');
        return json(mapUser(data.user));
      }

      case 'deleteUser': {
        const { error } = await serviceClient.auth.admin.deleteUser(payload.id);
        if (error) throw error;
        return json({ success: true });
      }

      default:
        return json({ error: 'Unsupported action.' }, 400);
    }
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error.',
      },
      400,
    );
  }
});
