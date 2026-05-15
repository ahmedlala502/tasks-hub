-- Migration: Create workspace tables for cloud sync
-- This replaces localStorage with Supabase cloud storage

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'TryGC Hub Workspace',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Users table
CREATE TABLE IF NOT EXISTS workspace_users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'Viewer',
  office TEXT,
  country TEXT,
  team TEXT,
  status TEXT DEFAULT 'active',
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  profile JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

-- Workspace Tasks table
CREATE TABLE IF NOT EXISTS workspace_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  country TEXT,
  office TEXT,
  team TEXT,
  owner TEXT,
  shift TEXT,
  priority TEXT,
  status TEXT,
  due TIMESTAMPTZ,
  campaign TEXT,
  details TEXT,
  carry BOOLEAN DEFAULT false,
  dod JSONB,
  reminders JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  creator_id TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  dependencies JSONB,
  tags JSONB,
  estimated_hours FLOAT,
  actual_hours FLOAT,
  blocked_reason TEXT,
  blocked_since TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  local_only BOOLEAN DEFAULT false
);

-- Workspace Handovers table
CREATE TABLE IF NOT EXISTS workspace_handovers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  date TEXT,
  from_shift TEXT,
  to_shift TEXT,
  from_office TEXT,
  to_office TEXT,
  team TEXT,
  country TEXT,
  outgoing TEXT,
  incoming TEXT,
  status TEXT,
  watchouts TEXT,
  task_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ack_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  review_history JSONB,
  creator_id TEXT,
  template_id TEXT,
  quality TEXT,
  issues JSONB,
  synced_at TIMESTAMPTZ,
  local_only BOOLEAN DEFAULT false
);

-- Workspace Offices table
CREATE TABLE IF NOT EXISTS workspace_offices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  lead TEXT,
  shift TEXT,
  team_capacity INTEGER,
  current_load INTEGER,
  timezone TEXT,
  address TEXT,
  phone TEXT
);

-- Workspace Members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team TEXT,
  office TEXT,
  country TEXT,
  role TEXT,
  tasks_completed INTEGER DEFAULT 0,
  handovers_out INTEGER DEFAULT 0,
  on_time INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile JSONB,
  email TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'active'
);

-- Workspace Settings table
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Audit Logs table
CREATE TABLE IF NOT EXISTS workspace_audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT,
  severity TEXT DEFAULT 'info'
);

-- Workspace Signup Requests table
CREATE TABLE IF NOT EXISTS workspace_signup_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT,
  team TEXT,
  office TEXT,
  country TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  verification_code TEXT,
  verified_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  UNIQUE(workspace_id, email)
);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_signup_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON workspaces FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON workspaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON workspaces FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users on workspace_users" ON workspace_users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_tasks" ON workspace_tasks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_handovers" ON workspace_handovers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_offices" ON workspace_offices FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_members" ON workspace_members FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_settings" ON workspace_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_audit_logs" ON workspace_audit_logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users on workspace_signup_requests" ON workspace_signup_requests FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime for all tables
alter publication supabase_realtime add table workspaces;
alter publication supabase_realtime add table workspace_users;
alter publication supabase_realtime add table workspace_tasks;
alter publication supabase_realtime add table workspace_handovers;
alter publication supabase_realtime add table workspace_offices;
alter publication supabase_realtime add table workspace_members;
alter publication supabase_realtime add table workspace_settings;
alter publication supabase_realtime add table workspace_audit_logs;
alter publication supabase_realtime add table workspace_signup_requests;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_email ON workspace_users(email);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_workspace_id ON workspace_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_status ON workspace_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_team ON workspace_tasks(team);
CREATE INDEX IF NOT EXISTS idx_workspace_handovers_workspace_id ON workspace_handovers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_offices_workspace_id ON workspace_offices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_team ON workspace_members(team);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_workspace_id ON workspace_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_timestamp ON workspace_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_signup_requests_workspace_id ON workspace_signup_requests(workspace_id);
