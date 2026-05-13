#!/bin/bash

# Cloudflare Pages Deployment Script
# Prerequisites: npm install -g wrangler

echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

echo "Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=trygc-hub-manager

echo "Deployment complete!"
