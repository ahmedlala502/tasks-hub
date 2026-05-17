# Cloudflare Pages Deployment Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```
3. **Authentication**: Authenticate with Cloudflare
   ```bash
   wrangler login
   ```

## Quick Deploy

### Option 1: Using Batch Script (Windows)
```bash
deploy-cloudflare.bat
```

### Option 2: Using Shell Script (macOS/Linux)
```bash
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

### Option 3: Manual Deployment
```bash
npm run build
wrangler pages deploy dist --project-name=trygc-tasks-hub
```

## Environment Variables

Set environment variables in Cloudflare Pages dashboard:
- `GEMINI_API_KEY`: Your Gemini API key
- `VITE_API_URL`: API endpoint (if needed)

## Configuration

The `wrangler.toml` file contains:
- Project name: `trygc-tasks-hub`
- Build command: `npm run build`
- Output directory: `dist`

## Troubleshooting

### Build Fails
- Ensure Node.js 18+ is installed
- Run `npm install` to install dependencies
- Check `npm run lint` for TypeScript errors

### Deployment Fails
- Verify Wrangler authentication: `wrangler whoami`
- Check project name matches Cloudflare Pages project
- Ensure `dist` folder exists after build

### Environment Variables Not Loading
- Set variables in Cloudflare Pages dashboard under Settings > Environment Variables
- Restart deployment after adding variables

## Post-Deployment

1. Visit your Cloudflare Pages URL
2. Monitor performance in Cloudflare dashboard
3. Set up custom domain if needed
4. Configure SSL/TLS settings

## Rollback

To rollback to a previous deployment:
1. Go to Cloudflare Pages dashboard
2. Select your project
3. Choose a previous deployment
4. Click "Rollback"
