import { createClient } from 'jsr:@supabase/supabase-js@2';

type OpsRole = 'master' | 'operations' | 'community';
type OpsStatus = 'active' | 'suspended';
type OpsOffice = 'Egypt' | 'KSA' | 'UAE' | 'Kuwait';

type RequestPayload =
  | { action: 'listUsers' }
  | { action: 'createUser'; name: string; email: string; password: string; role: OpsRole; office?: OpsOffice; department?: string; title?: string }
  | { action: 'updateUser'; id: string; name?: string; password?: string; role?: OpsRole; status?: OpsStatus; office?: OpsOffice; department?: string; title?: string }
  | { action: 'deleteUser'; id: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const defaultMasterEmails = [
  'admin@trygc.com',
  'lamiaa@trygc.com',
  'adel@grand-community.com',
  'sabry@trygc.com',
  'a.ismail@trygc.com',
];
const configuredMasterEmails = [
  Deno.env.get('MASTER_ADMIN_EMAIL'),
  Deno.env.get('MASTER_ADMIN_EMAILS'),
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(','))
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const masterEmails = new Set([...defaultMasterEmails, ...configuredMasterEmails]);

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

function isOpsOffice(value: unknown): value is OpsOffice {
  return value === 'KSA' || value === 'UAE' || value === 'Kuwait' || value === 'Egypt';
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferOffice(input: { name?: unknown; role?: unknown; office?: unknown }): OpsOffice {
  if (isOpsOffice(input.office)) return input.office;
  const normalizedName = normalizeText(input.name);
  if (['abdulrahman', 'abdelrahman', 'khalid', 'khaled', 'nurhan'].some((name) => normalizedName.includes(name))) return 'UAE';
  if (input.role === 'community') return 'KSA';
  return 'Egypt';
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
  const effectiveRole = masterEmails.has(email.toLowerCase()) ? 'master' : metadataRole;
  const displayName =
    String(
      user.user_metadata?.display_name ??
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        email.split('@')[0] ??
        'Workspace User',
    ).trim() || 'Workspace User';
  const storedOffice = user.user_metadata?.office;
  const office: OpsOffice = isOpsOffice(storedOffice)
    ? storedOffice
    : inferOffice({ name: displayName, role: effectiveRole, office: storedOffice });

  return {
    uid: user.id,
    email,
    displayName,
    role: effectiveRole,
    status: user.banned_until ? 'suspended' : 'active',
    office,
    department: (user.user_metadata?.department as string) ?? 'Operations',
    title: (user.user_metadata?.title as string) ?? (effectiveRole === 'master' ? 'Master Admin' : 'Team Member'),
    timezone: (user.user_metadata?.timezone as string) ?? 'Africa/Cairo',
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
  if (callerRole !== 'master' && !masterEmails.has(callerEmail)) {
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
        const name = payload.name.trim();
        const office = inferOffice({ name, role, office: payload.office });

        const { data, error } = await serviceClient.auth.admin.createUser({
          email,
          password: payload.password,
          email_confirm: true,
          app_metadata: {
            role,
          },
          user_metadata: {
            display_name: name,
            full_name: name,
            office,
            department: payload.department ?? (role === 'community' ? 'Coordination' : 'Operations'),
            title: payload.title ?? (role === 'master' ? 'Master Admin' : role === 'community' ? 'Community Access' : 'Operations Access'),
            timezone: 'Africa/Cairo',
          },
        });

        if (error || !data.user) throw error ?? new Error('Unable to create user.');
        return json(mapUser(data.user), 201);
      }

      case 'updateUser': {
        const { data: existingData, error: existingError } = await serviceClient.auth.admin.getUserById(payload.id);
        if (existingError || !existingData.user) throw existingError ?? new Error('User not found.');
        const existing = existingData.user;

        const updateData: {
          password?: string;
          app_metadata?: { role: OpsRole };
          user_metadata?: Record<string, unknown>;
          ban_duration?: 'none' | '876000h';
        } = {};

        const nextRole = payload.role ? normalizeRole(payload.role) : normalizeRole(existing.app_metadata?.role);

        if (payload.role) {
          updateData.app_metadata = { role: nextRole };
        }

        if (payload.password !== undefined) {
          const password = payload.password.trim();
          if (password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
          }
          updateData.password = password;
        }

        const hasMetadataChange =
          payload.name !== undefined ||
          payload.office !== undefined ||
          payload.department !== undefined ||
          payload.title !== undefined;

        if (hasMetadataChange) {
          const existingMeta = (existing.user_metadata ?? {}) as Record<string, unknown>;
          const nextName = payload.name?.trim() || (existingMeta.display_name as string) || (existingMeta.full_name as string) || (existing.email?.split('@')[0] ?? 'Workspace User');
          const nextOffice = inferOffice({
            name: nextName,
            role: nextRole,
            office: payload.office !== undefined ? payload.office : existingMeta.office,
          });

          updateData.user_metadata = {
            ...existingMeta,
            display_name: nextName,
            full_name: nextName,
            office: nextOffice,
            department: payload.department ?? (existingMeta.department as string) ?? (nextRole === 'community' ? 'Coordination' : 'Operations'),
            title: payload.title ?? (existingMeta.title as string) ?? (nextRole === 'master' ? 'Master Admin' : nextRole === 'community' ? 'Community Access' : 'Operations Access'),
            timezone: (existingMeta.timezone as string) ?? 'Africa/Cairo',
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
