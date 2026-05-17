@echo off
cd /d "%~dp0"

echo === Step 1: Commit and push to GitHub ===
git add src/ops/lib/platformUsers.ts src/ops/pages/CampaignList.tsx
git commit -m "fix: user dropdowns show all users, creator name, read-only permissions"
git push

echo === Step 2: Deploy to Cloudflare Pages ===
call npx wrangler pages deploy . --project-name=trygc-tasks-hub

echo === Done! ===
pause
