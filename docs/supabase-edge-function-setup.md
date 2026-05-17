# Supabase Edge Function Setup

This project now expects a Supabase Edge Function named `admin-users` for secure admin account management.

## Required project

- Supabase project: `waicnakckbpljtiikups`

## Required secrets

Set these in the Supabase project before deploying the function:

- `SUPABASE_URL=https://waicnakckbpljtiikups.supabase.co`
- `SUPABASE_ANON_KEY=<your anon key>`
- `SUPABASE_SERVICE_ROLE_KEY=<your service role key>`
- `MASTER_ADMIN_EMAIL=admin@trygc.com`
- Optional: `MASTER_ADMIN_EMAILS=admin@trygc.com,lamiaa@trygc.com,adel@grand-community.com,sabry@trygc.com,a.ismail@trygc.com`

## Function location

- `supabase/functions/admin-users/index.ts`

## What it does

- validates the caller JWT
- allows only `master` users to manage accounts
- lists users
- creates users with `app_metadata.role`
- updates display name / role / suspension state
- deletes users

## Deployment

Use Supabase CLI from a machine authenticated to the target project:

```bash
supabase login
supabase link --project-ref waicnakckbpljtiikups
supabase secrets set \
  SUPABASE_URL=https://waicnakckbpljtiikups.supabase.co \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  MASTER_ADMIN_EMAIL=admin@trygc.com \
  MASTER_ADMIN_EMAILS=admin@trygc.com,lamiaa@trygc.com,adel@grand-community.com,sabry@trygc.com,a.ismail@trygc.com
supabase functions deploy admin-users --project-ref waicnakckbpljtiikups
```

## Frontend client

The admin UI now calls:

- `supabase.functions.invoke('admin-users', { body: { action: ... } })`

So once the function is deployed, the Admin page can manage users without exposing the service role key to the browser.
