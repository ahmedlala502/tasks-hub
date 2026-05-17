-- Run this in your Supabase project's SQL Editor:
-- Dashboard → SQL Editor → New query → paste and run

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@trygc.com',
  crypt('Admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"],"role":"master"}'::jsonb,
  '{"display_name":"Admin","full_name":"Admin"}'::jsonb,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@trygc.com'
);

-- Verify the user was created:
SELECT id, email, email_confirmed_at, raw_app_meta_data
FROM auth.users
WHERE email = 'admin@trygc.com';
