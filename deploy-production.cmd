@echo off
cd /d "%~dp0"
echo === Git ===
git status -sb
git add -A
git reset HEAD .env .env.local .env.* 2>nul
git diff --cached --quiet
if errorlevel 1 git commit -m "Add Cloudflare Pages CI deploy workflow"
git push origin master:main
echo.
echo === Build ===
call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
echo.
echo === Deploy production ===
call npx wrangler pages deploy dist --project-name=trygc-tasks-hub
echo Done: https://trygc-tasks-hub.pages.dev/
