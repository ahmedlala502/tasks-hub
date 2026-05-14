# 🚨 Quick Fix: "Failed to connect to edge functions"

## Problem
When adding a new user, you see: **"Failed to connect to edge functions"**

## ✅ Solution (Choose One)

### Option 1: One-Command Fix (Easiest)
```bash
fix-user-management.bat
```
This script will:
- Install Supabase CLI if needed
- Deploy the edge function
- Guide you through setting the service role key

### Option 2: Manual Fix (5 minutes)
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Deploy edge functions
deploy-edge-functions.bat
```

### Option 3: Use Fallback Mode (No setup needed)
The app automatically falls back to Supabase Auth signup if edge functions aren't available.

**Limitations:**
- Can create users ✅
- Cannot list all users ⚠️
- Cannot update/delete users ⚠️

---

## 💾 Data Safety - 100% Guaranteed

### Your data is SAFE and will NOT be lost:

✅ **All data is stored in Supabase PostgreSQL**
- Tasks, handovers, offices, members
- Automatically backed up by Supabase
- Persists even if you close the browser

✅ **Local cache for offline access**
- Browser localStorage caches data
- Syncs automatically with Supabase
- Reloads from Supabase if cache is cleared

✅ **User data is persistent**
- Users created via edge function: Stored in Supabase Auth
- Users created via fallback: Also stored in Supabase Auth
- All user data persists permanently

✅ **Manual backup available**
- Export all data from User Manager
- Import data anytime
- JSON format for easy backup

### What happens if edge functions aren't deployed?
- ✅ All existing data remains safe
- ✅ You can still view all data
- ✅ You can create new users (via fallback)
- ✅ You can export data as backup
- ⚠️ Some admin features limited (list/update/delete users)

---

## 🔧 Step-by-Step Fix

### Step 1: Get Your Service Role Key
1. Go to: https://supabase.com/dashboard/project/waicnakckbpljtiikups/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (NOT the anon key)
4. Keep it safe - you'll need it in Step 3

### Step 2: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 3: Deploy Edge Function
```bash
# Windows
fix-user-management.bat

# Or manually:
supabase login
supabase link --project-ref waicnakckbpljtiikups
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key_from_step_1
supabase functions deploy admin-users
```

### Step 4: Test
1. Run: `npm run dev`
2. Log in as admin
3. Go to User Manager
4. Click "New User"
5. Fill in the form
6. Click "Create User"

You should see: "User created successfully" ✅

---

## 🧪 Verify Everything Works

### Check 1: Edge Function Deployed
Visit: https://waicnakckbpljtiikups.supabase.co/functions/v1/admin-users

You should see: `{"error":"Missing authorization header."}`

This is GOOD - it means the function is deployed and working!

### Check 2: Create a Test User
1. Log in as admin (admin@trygc.com)
2. Go to User Manager
3. Create a test user
4. If successful, edge functions are working ✅

### Check 3: Data Persistence
1. Create a task or user
2. Close the browser
3. Open the app again
4. Data should still be there ✅

---

## 📊 System Status

### Before Fix
- ❌ Edge function: Not deployed
- ⚠️ User management: Limited (fallback mode)
- ✅ Data persistence: Working
- ✅ Task management: Working
- ✅ Handovers: Working

### After Fix
- ✅ Edge function: Deployed
- ✅ User management: Full features
- ✅ Data persistence: Working
- ✅ Task management: Working
- ✅ Handovers: Working

---

## 🐛 Troubleshooting

### Error: "Supabase CLI not found"
```bash
npm install -g supabase
```

### Error: "Failed to link to project"
```bash
supabase login
# Then try again
```

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"
1. Get key from: https://supabase.com/dashboard/project/waicnakckbpljtiikups/settings/api
2. Set it: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key`
3. Redeploy: `supabase functions deploy admin-users`

### Error: "Only master users can manage workspace accounts"
- You need to log in as a master admin
- Default master: admin@trygc.com
- Or add your email to master list in edge function

### Still not working?
1. Check Supabase status: https://status.supabase.com
2. Check function logs: https://supabase.com/dashboard/project/waicnakckbpljtiikups/logs/edge-functions
3. Use fallback mode (works automatically)

---

## 📞 Need Help?

### Quick Checks
```bash
# Check if Supabase CLI is installed
supabase --version

# Check if you're logged in
supabase projects list

# Check edge function status
check-edge-functions.bat
```

### Documentation
- [Full Edge Function Setup Guide](EDGE_FUNCTION_SETUP.md)
- [Supabase Configuration](SUPABASE_SETUP_COMPLETE.md)
- [README](README.md)

---

## ✨ Summary

**To fix the error:**
1. Run: `fix-user-management.bat`
2. Follow the prompts
3. Set service role key when asked
4. Done! ✅

**Your data is 100% safe:**
- Stored in Supabase PostgreSQL ✅
- Automatically backed up ✅
- Cached locally for offline access ✅
- Can be exported anytime ✅

**Time required:** 5 minutes  
**Risk level:** Zero (data is safe)  
**Difficulty:** Easy (automated script)

---

**Status**: Ready to fix  
**Team can start working**: Immediately (fallback mode works)  
**Full features available**: After edge function deployment (5 min)
