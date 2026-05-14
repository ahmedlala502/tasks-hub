#!/bin/bash
# ============================================
# Deploy Supabase Edge Functions
# ============================================

set -e

echo ""
echo "========================================"
echo "  Deploying Supabase Edge Functions"
echo "========================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "[ERROR] Supabase CLI is not installed."
    echo ""
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or download from: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "[1/4] Checking Supabase CLI version..."
supabase --version
echo ""

echo "[2/4] Linking to Supabase project..."
supabase link --project-ref waicnakckbpljtiikups
echo ""

echo "[3/4] Setting edge function secrets..."
echo "Setting SUPABASE_URL..."
supabase secrets set SUPABASE_URL=https://waicnakckbpljtiikups.supabase.co

echo "Setting SUPABASE_ANON_KEY..."
supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaWNuYWtja2JwbGp0aWlrdXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjY2ODAsImV4cCI6MjA5NDEwMjY4MH0.hTGsc6YZwRL8ZIo3eKdCv_uYO_Hc-INeNFXBPgc_s4I

echo "Setting MASTER_ADMIN_EMAIL..."
supabase secrets set MASTER_ADMIN_EMAIL=admin@trygc.com

echo ""
echo "[NOTE] SUPABASE_SERVICE_ROLE_KEY must be set manually for security."
echo "Please run this command with your service role key:"
echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here"
echo ""
echo "You can find your service role key at:"
echo "  https://supabase.com/dashboard/project/waicnakckbpljtiikups/settings/api"
echo ""
read -p "Press Enter to continue after setting the service role key..."

echo "[4/4] Deploying admin-users edge function..."
supabase functions deploy admin-users --no-verify-jwt
echo ""

echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Edge function 'admin-users' has been deployed."
echo ""
echo "IMPORTANT: Don't forget to set SUPABASE_SERVICE_ROLE_KEY if you haven't:"
echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key"
echo ""
echo "You can test the function at:"
echo "  https://waicnakckbpljtiikups.supabase.co/functions/v1/admin-users"
echo ""
