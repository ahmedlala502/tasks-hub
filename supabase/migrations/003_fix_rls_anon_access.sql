-- Migration: Fix RLS policies to allow anon key access
-- The app uses its own local auth system with Supabase as a data store.
-- The Supabase client connects with the anon key, so auth.role() is 'anon'.
-- The existing policies only allowed 'authenticated' role, which silently
-- blocked all data operations, preventing any sync between the app and Supabase.

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON workspaces;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON workspaces;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON workspaces;

DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_users" ON workspace_users;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_tasks" ON workspace_tasks;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_handovers" ON workspace_handovers;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_offices" ON workspace_offices;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_settings" ON workspace_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_audit_logs" ON workspace_audit_logs;
DROP POLICY IF EXISTS "Enable all access for authenticated users on workspace_signup_requests" ON workspace_signup_requests;

-- Create new policies that allow both anon and authenticated roles
CREATE POLICY "Enable read access for all users" ON workspaces FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON workspaces FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON workspaces FOR UPDATE USING (true);

CREATE POLICY "Enable all access for all users on workspace_users" ON workspace_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_tasks" ON workspace_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_handovers" ON workspace_handovers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_offices" ON workspace_offices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_members" ON workspace_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_settings" ON workspace_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_audit_logs" ON workspace_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users on workspace_signup_requests" ON workspace_signup_requests FOR ALL USING (true) WITH CHECK (true);
