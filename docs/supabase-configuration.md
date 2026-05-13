# Supabase Configuration Guide

## Project Information

- **Project Name**: supabase-beige-cushion
- **Project ID**: `waicnakckbpljtiikups`
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Database**: PostgreSQL 17.6.1.121
- **Project URL**: https://waicnakckbpljtiikups.supabase.co

## Environment Variables

All Supabase configuration is stored in `.env` file:

```env
# Supabase Project URL
VITE_SUPABASE_URL=https://waicnakckbpljtiikups.supabase.co

# Publishable Key (Recommended - modern, secure, independently rotatable)
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XQV-m4_BHaL_OnzCOOeZUA_Yobr9HW-

# Legacy Anon Key (JWT-based - for compatibility)
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Master Admin Email
VITE_MASTER_ADMIN_EMAIL=admin@trygc.com
```

### Security Best Practices

✅ **DO:**
- Use `VITE_SUPABASE_PUBLISHABLE_KEY` for frontend applications
- Keep service role keys in backend/Edge Functions only
- Enable RLS on all public tables
- Use prepared statements for queries
- Validate user input before database operations

❌ **DON'T:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Don't use `user_metadata` for authorization (it's user-editable)
- Don't disable RLS without proper security review
- Don't hardcode credentials in source code

## Database Schema

### Tables

#### 1. `public.trygc` (Main Task Table)
- **Primary Key**: `id` (text)
- **RLS**: Enabled ✅
- **Policies**: Full CRUD for authenticated users
- **Indexes**:
  - `idx_trygc_status` - Query by status
  - `idx_trygc_owner` - Query by owner
  - `idx_trygc_team` - Query by team
  - `idx_trygc_priority` - Query by priority
  - `idx_trygc_sla_deadline` - Query by deadline
  - `idx_trygc_created_at` - Sort by creation date
  - `idx_trygc_updated_at` - Sort by update date

**Columns:**
- `id` - Unique task identifier
- `orderId` - Order reference
- `brandName` - Brand name
- `campaignName` - Campaign name
- `market` - Market/region
- `team` - Assigned team
- `function` - Function/department
- `taskName` - Task title
- `description` - Task description
- `owner` - Task owner
- `priority` - Priority level
- `status` - Current status
- `slaDeadline` - SLA deadline (timestamptz)
- `dependency` - Task dependencies
- `proofLink` - Proof/evidence link
- `comments` - Task comments
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp
- `slaStatus` - SLA status

#### 2. `public.notes`
- **Primary Key**: `id` (bigint, auto-increment)
- **RLS**: Enabled ✅
- **Policies**: Full CRUD for authenticated users

## Row Level Security (RLS) Policies

### Trygc Table Policies

1. **Read Policy**: `Allow authenticated users to read tasks`
   - Allows all authenticated users to SELECT
   
2. **Insert Policy**: `Allow authenticated users to create tasks`
   - Allows all authenticated users to INSERT

3. **Update Policy**: `Allow authenticated users to update tasks`
   - Allows all authenticated users to UPDATE

4. **Delete Policy**: `Allow authenticated users to delete tasks`
   - Allows all authenticated users to DELETE

### Notes Table Policies

Same structure as trygc table - full CRUD for authenticated users.

## Performance Optimizations

### 1. Indexes Created
- Status, owner, team, priority for filtering
- Timestamp columns for sorting
- Composite indexes can be added for common query patterns

### 2. Connection Pooling
The Supabase client uses connection pooling automatically via the REST API.

### 3. Query Optimization Tips
```typescript
// ✅ Good - Use select to limit columns
const { data } = await supabase
  .from('trygc')
  .select('id, taskName, status')
  .eq('status', 'active');

// ✅ Good - Use pagination
const { data } = await supabase
  .from('trygc')
  .select('*')
  .range(0, 9);

// ❌ Bad - Fetching all columns when not needed
const { data } = await supabase
  .from('trygc')
  .select('*');
```

### 4. Batch Operations
```typescript
// ✅ Good - Batch insert
const { data, error } = await supabase
  .from('trygc')
  .insert([task1, task2, task3]);

// ❌ Bad - Multiple single inserts
await supabase.from('trygc').insert(task1);
await supabase.from('trygc').insert(task2);
await supabase.from('trygc').insert(task3);
```

## Client Configuration

### Location: `src/ops/lib/supabase.ts`

```typescript
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,        // Store session in localStorage
    autoRefreshToken: true,       // Auto-refresh JWT tokens
    detectSessionInUrl: true,     // Handle OAuth redirects
    flowType: 'pkce',            // Use PKCE for OAuth
    storageKey: 'trygc-hub-auth', // Custom storage key
  },
  db: {
    schema: 'public',             // Default schema
  },
  global: {
    headers: {
      'x-application-name': 'trygc-hub-manager',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,        // Rate limiting for realtime
    },
  },
});
```

## Authentication Configuration

### Session Management
- **JWT Expiry**: 3600 seconds (1 hour)
- **Refresh Token Rotation**: Enabled
- **Reuse Interval**: 10 seconds
- **Storage**: localStorage with key `trygc-hub-auth`

### Password Requirements
- **Minimum Length**: 8 characters
- **Required Characters**: Letters (upper/lower), numbers

### Email Settings
- **Signup**: Enabled
- **Confirmations**: Disabled (for development)
- **Double Confirm Changes**: Enabled

## Edge Functions

### admin-users Function
- **Location**: `supabase/functions/admin-users/`
- **JWT Verification**: Enabled ✅
- **Purpose**: User management operations (create, update, delete users)

**Environment Variables Required:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MASTER_ADMIN_EMAIL`

## Extensions Installed

Currently installed PostgreSQL extensions:
- `plpgsql` - PL/pgSQL procedural language
- `pgcrypto` - Cryptographic functions
- `uuid-ossp` - UUID generation
- `pg_stat_statements` - Query statistics
- `supabase_vault` - Secrets management

### Recommended Extensions to Enable

```sql
-- For full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- For vector/AI features
CREATE EXTENSION IF NOT EXISTS vector;

-- For scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- For HTTP requests from database
CREATE EXTENSION IF NOT EXISTS http;
```

## Security Audit Results

### ✅ Fixed Issues

1. **Primary Key Missing** - FIXED
   - Added primary key to `trygc` table
   
2. **RLS Enabled Without Policies** - FIXED
   - Created comprehensive RLS policies for all tables
   
3. **Missing Indexes** - FIXED
   - Added performance indexes on frequently queried columns

### ⚠️ Recommendations

1. **Enable Leaked Password Protection**
   - Go to: https://supabase.com/dashboard/project/waicnakckbpljtiikups/auth/policies
   - Enable "Leaked Password Protection" to check against HaveIBeenPwned.org

2. **Consider More Granular RLS Policies**
   - Current policies allow all authenticated users full access
   - Consider implementing role-based or owner-based policies:
   ```sql
   -- Example: Users can only update their own tasks
   CREATE POLICY "Users can update own tasks"
     ON public.trygc
     FOR UPDATE
     TO authenticated
     USING (owner = auth.email())
     WITH CHECK (owner = auth.email());
   ```

3. **Enable Realtime (if needed)**
   - Realtime is configured but not actively used
   - Enable for live updates: https://supabase.com/docs/guides/realtime

4. **Set up Database Backups**
   - Configure automated backups in Supabase dashboard
   - Test restore procedures

5. **Monitor Query Performance**
   - Use `pg_stat_statements` to identify slow queries
   - Add indexes for common query patterns

## Monitoring & Maintenance

### Health Check
```typescript
import { checkSupabaseHealth } from '@/ops/lib/supabase';

const isHealthy = await checkSupabaseHealth();
```

### Get Logs
```bash
# Using Supabase CLI
supabase logs --project-ref waicnakckbpljtiikups

# Or via MCP
kiroPowers.use({
  powerName: "supabase-hosted",
  serverName: "supabase",
  toolName: "get_logs",
  arguments: {
    project_id: "waicnakckbpljtiikups",
    service: "postgres"
  }
})
```

### Security Advisors
Run security checks regularly:
```bash
# Using MCP
kiroPowers.use({
  powerName: "supabase-hosted",
  serverName: "supabase",
  toolName: "get_advisors",
  arguments: {
    project_id: "waicnakckbpljtiikups",
    type: "security"
  }
})
```

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Ensure `.env` file exists in project root
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
   - Restart dev server after changing `.env`

2. **"Row Level Security Policy Violation"**
   - Check if user is authenticated
   - Verify RLS policies allow the operation
   - Check if table has proper GRANT permissions

3. **"Connection timeout"**
   - Check internet connection
   - Verify project is not paused
   - Check Supabase status: https://status.supabase.com

4. **"JWT expired"**
   - Token refresh should happen automatically
   - If not, call `supabase.auth.refreshSession()`

## Migration Workflow

### Creating Migrations
```bash
# Create new migration file
supabase migration new <migration_name>

# Apply migration
supabase db push
```

### Best Practices
- Always test migrations locally first
- Use transactions for complex migrations
- Add rollback scripts for critical changes
- Document breaking changes

## Resources

- [Supabase Dashboard](https://supabase.com/dashboard/project/waicnakckbpljtiikups)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Performance Tips](https://supabase.com/docs/guides/database/postgres/performance)

## Support

For issues or questions:
1. Check this documentation
2. Review Supabase docs: https://supabase.com/docs
3. Check Supabase Discord: https://discord.supabase.com
4. Open GitHub issue: https://github.com/supabase/supabase/issues
