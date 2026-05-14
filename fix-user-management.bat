@echo off
REM ============================================
REM Quick Fix for User Management
REM ============================================

echo.
echo ========================================
echo   Fixing User Management
echo ========================================
echo.
echo This script will:
echo   1. Check if Supabase CLI is installed
echo   2. Deploy the admin-users edge function
echo   3. Set up required environment variables
echo.
echo Your data is 100%% safe - nothing will be deleted.
echo.
pause

REM Check if Supabase CLI is installed
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [STEP 1] Installing Supabase CLI...
    echo.
    npm install -g supabase
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install Supabase CLI.
        echo Please install it manually: npm install -g supabase
        echo.
        pause
        exit /b 1
    )
) else (
    echo [STEP 1] Supabase CLI already installed ✓
)

echo.
echo [STEP 2] Logging in to Supabase...
echo.
echo A browser window will open. Please log in with your Supabase account.
echo.
supabase login

echo.
echo [STEP 3] Linking to your project...
echo.
supabase link --project-ref waicnakckbpljtiikups

echo.
echo [STEP 4] Setting environment variables...
echo.
supabase secrets set SUPABASE_URL=https://waicnakckbpljtiikups.supabase.co
supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaWNuYWtja2JwbGp0aWlrdXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjY2ODAsImV4cCI6MjA5NDEwMjY4MH0.hTGsc6YZwRL8ZIo3eKdCv_uYO_Hc-INeNFXBPgc_s4I
supabase secrets set MASTER_ADMIN_EMAIL=admin@trygc.com

echo.
echo ========================================
echo   IMPORTANT: Service Role Key Required
echo ========================================
echo.
echo To complete the setup, you need to set your service role key.
echo.
echo 1. Open this URL in your browser:
echo    https://supabase.com/dashboard/project/waicnakckbpljtiikups/settings/api
echo.
echo 2. Copy the "service_role" key (NOT the anon key)
echo.
echo 3. Run this command (replace YOUR_KEY with the actual key):
echo    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY
echo.
echo 4. Then run this script again to deploy the function
echo.
set /p CONTINUE="Have you set the service role key? (y/n): "
if /i not "%CONTINUE%"=="y" (
    echo.
    echo Please set the service role key first, then run this script again.
    echo.
    pause
    exit /b 0
)

echo.
echo [STEP 5] Deploying edge function...
echo.
supabase functions deploy admin-users --no-verify-jwt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Deployment failed. This might be because:
    echo   - Service role key is not set
    echo   - Network connection issue
    echo   - Supabase project is not accessible
    echo.
    echo Please check the error above and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! ✓
echo ========================================
echo.
echo User management is now working!
echo.
echo You can now:
echo   - Add new users
echo   - Update user roles
echo   - Delete users
echo   - List all users
echo.
echo Your data is safe and persisted in Supabase.
echo.
echo To test:
echo   1. Run: npm run dev
echo   2. Log in as admin
echo   3. Go to User Manager
echo   4. Click "New User"
echo.
pause
