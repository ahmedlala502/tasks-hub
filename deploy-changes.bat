@echo off
cd /d "G:\adel\tasks-hub-main (1)\tasks-hub-main"

echo === Step 1: Commit and push to GitHub ===
git add -A
git commit -m "feat: per-user task dashboard with widgets, fix user management"
git push

echo === Step 2: Deploy to Cloudflare Pages ===
call npx wrangler pages deploy . --project-name=trygc-tasks-hub

echo === Done! ===
pause
