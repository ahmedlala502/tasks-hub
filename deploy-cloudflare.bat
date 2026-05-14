@echo off
REM Cloudflare Pages Deployment Script for Windows

echo Building application...
call npm run build

if %errorlevel% neq 0 (
  echo Build failed!
  exit /b 1
)

echo Deploying to Cloudflare Pages...
call wrangler pages deploy dist --project-name=trygc-tasks-hub

echo Deployment complete!
pause
