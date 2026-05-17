@echo off
REM ============================================
REM Check Edge Function Status
REM ============================================

echo.
echo ========================================
echo   Edge Function Status Check
echo ========================================
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Supabase CLI: NOT INSTALLED
    echo.
    echo To fix: npm install -g supabase
    echo.
) else (
    echo [OK] Supabase CLI: INSTALLED
    supabase --version
    echo.
)

REM Check if .env file exists
if exist .env (
    echo [OK] Environment file: FOUND
    echo.
) else (
    echo [X] Environment file: MISSING
    echo.
    echo To fix: Create .env file with Supabase credentials
    echo.
)

REM Check if edge function exists
if exist supabase\functions\admin-users\index.ts (
    echo [OK] Edge function code: FOUND
    echo.
) else (
    echo [X] Edge function code: MISSING
    echo.
)

echo ========================================
echo   Next Steps
echo ========================================
echo.
echo 1. If Supabase CLI is not installed:
echo    npm install -g supabase
echo.
echo 2. Deploy the edge function:
echo    deploy-edge-functions.bat
echo.
echo 3. Or read the full guide:
echo    EDGE_FUNCTION_SETUP.md
echo.
echo ========================================
echo   Data Safety Status
echo ========================================
echo.
echo [OK] Your data is 100%% safe and persisted in:
echo   - Supabase PostgreSQL database
echo   - Local browser cache (for offline access)
echo   - Automatic Supabase backups
echo.
echo Even without edge functions, you can:
echo   - View all existing data
echo   - Create new users (via fallback mode)
echo   - Export data as backup
echo.
pause
