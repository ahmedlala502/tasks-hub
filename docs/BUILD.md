# Trygc Hub Manager - Build System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Build Tools & Configuration](#build-tools--configuration)
3. [Development Workflow](#development-workflow)
4. [Production Build Process](#production-build-process)
5. [Code Splitting Strategy](#code-splitting-strategy)
6. [Optimization Techniques](#optimization-techniques)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Trygc Hub Manager uses a modern JavaScript build pipeline centered around **Vite 6.2.3** as the primary bundler. The build system is optimized for:

- **Fast development** with Hot Module Replacement (HMR)
- **Efficient production bundles** with code splitting and tree shaking
- **Type safety** with TypeScript 5.8.2 in strict mode
- **Modern browser targets** (ES2022)
- **Edge deployment** via Cloudflare Workers

### Build System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Source Code (src/)                       │
│  TypeScript 5.8.2 + React 19.0.1 + Tailwind CSS 4.1.14     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Vite 6.2.3 Bundler                         │
│  • TypeScript Compilation (tsc)                             │
│  • React Plugin (@vitejs/plugin-react)                      │
│  • Tailwind CSS Plugin (@tailwindcss/vite)                  │
│  • Path Alias Resolution (@/* → ./src/*)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Build Optimizations                            │
│  • Code Splitting (Manual Chunks)                           │
│  • Tree Shaking                                             │
│  • Minification (ESBuild)                                   │
│  • CSS Code Splitting                                       │
│  • Dependency Pre-bundling                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Output (dist/)                             │
│  • index.html (entry point)                                 │
│  • assets/*.js (chunked JavaScript bundles)                 │
│  • assets/*.css (extracted stylesheets)                     │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Deployment Targets                             │
│  • Cloudflare Workers (Edge)                                │
│  • Static Hosting (Vite Preview)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Tools & Configuration

### Core Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Vite** | 6.2.3 | Primary bundler and dev server |
| **TypeScript** | 5.8.2 | Type checking and compilation |
| **ESBuild** | (via Vite) | Fast minification and transpilation |
| **Rollup** | (via Vite) | Production bundling engine |
| **npm** | Latest | Package manager |

### Vite Configuration (`vite.config.ts`)

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(),           // React Fast Refresh + JSX transform
      tailwindcss()      // Tailwind CSS v4 integration
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),  // @/* → ./src/*
      },
    },
    
    // Pre-bundle heavy dependencies for faster dev startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'motion',
        'date-fns'
      ],
    },
    
    build: {
      target: 'es2020',                    // Modern browser target
      cssCodeSplit: true,                  // Split CSS per chunk
      reportCompressedSize: false,         // Skip gzip size reporting
      sourcemap: !isProduction,            // Source maps in dev only
      minify: isProduction ? 'esbuild' : false,
      chunkSizeWarningLimit: 1200,         // 1.2MB warning threshold
      
      rollupOptions: {
        output: {
          manualChunks: {
            // Strategic code splitting (see below)
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
            'vendor-charts': ['recharts', 'd3'],
            'vendor-motion': ['motion'],
            'vendor-dates': ['date-fns'],
            'vendor-excel': ['exceljs'],
          },
        },
      },
    },
    
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',  // HMR toggle
      proxy: {
        '/api/ai': {
          target: 'http://localhost:8787',       // AI proxy server
          changeOrigin: true,
        },
      },
    },
  };
});
```

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",                    // Modern JavaScript features
    "experimentalDecorators": true,        // Decorator support
    "useDefineForClassFields": false,      // Legacy class field behavior
    "module": "ESNext",                    // ES modules
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,                  // Skip .d.ts validation
    "moduleResolution": "bundler",         // Vite-compatible resolution
    "resolveJsonModule": true,             // Import JSON files
    "isolatedModules": true,               // Single-file transpilation
    "moduleDetection": "force",            // Treat all files as modules
    "allowJs": true,                       // Allow .js files
    "jsx": "react-jsx",                    // Automatic JSX runtime
    "paths": { "@/*": ["./src/*"] },       // Path alias
    "allowImportingTsExtensions": true,    // Import .ts/.tsx files
    "noEmit": true,                        // Vite handles output
    "strict": true,                        // Strict type checking
    "noUnusedLocals": false,               // Allow unused variables
    "noUnusedParameters": false            // Allow unused parameters
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": [
    "node_modules",
    "dist",
    "src/components/ui/**"                 // Exclude shadcn/ui components
  ]
}
```

### Package Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "ai-proxy": "tsx server/aiProxy.ts",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "clean": "rimraf dist",
    "lint": "tsc --noEmit",
    "test": "vitest"
  }
}
```

---

## Development Workflow

### Starting Development Server

```bash
# Start Vite dev server on port 3000
npm run dev

# Start AI proxy server (separate terminal)
npm run ai-proxy
```

**Dev Server Features:**
- **Port**: 3000 (accessible on all network interfaces via `0.0.0.0`)
- **Hot Module Replacement (HMR)**: Instant updates without full page reload
- **Fast Refresh**: Preserves React component state during updates
- **Proxy**: `/api/ai` requests forwarded to `http://localhost:8787`

**Disabling HMR:**
```bash
DISABLE_HMR=true npm run dev
```

### Development Build Process

```
┌─────────────────────────────────────────────────────────────┐
│  1. Vite Dev Server Starts                                  │
│     • Loads vite.config.ts                                  │
│     • Initializes plugins (React, Tailwind)                 │
│     • Sets up HMR WebSocket connection                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Dependency Pre-bundling (First Run Only)                │
│     • Scans package.json dependencies                       │
│     • Pre-bundles: react, react-dom, lucide-react,          │
│       motion, date-fns                                      │
│     • Caches in node_modules/.vite/                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. On-Demand Compilation                                   │
│     • Browser requests index.html                           │
│     • Vite transforms TypeScript → JavaScript (ESBuild)     │
│     • Processes Tailwind CSS directives                     │
│     • Resolves @/* path aliases                             │
│     • Serves transformed modules as ES modules              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Hot Module Replacement (On File Change)                 │
│     • File watcher detects changes                          │
│     • Re-transforms changed module                          │
│     • Sends HMR update via WebSocket                        │
│     • Browser applies update without full reload            │
└─────────────────────────────────────────────────────────────┘
```

### Type Checking During Development

```bash
# Run TypeScript type checker (no output files)
npm run lint

# Watch mode (continuous type checking)
tsc --noEmit --watch
```

**Note**: Vite does **not** perform type checking during dev server runtime for speed. Use `npm run lint` or IDE integration for type errors.

---

## Production Build Process

### Building for Production

```bash
# Clean previous build
npm run clean

# Full production build
npm run build
```

### Build Pipeline Stages

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: TypeScript Compilation (tsc)                      │
│  • Validates all TypeScript types                           │
│  • Checks for type errors (strict mode)                     │
│  • Does NOT emit JavaScript (noEmit: true)                  │
│  • Fails build if type errors exist                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Vite Build (vite build)                           │
│  • Reads vite.config.ts with mode='production'              │
│  • Applies production-specific settings                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: Module Graph Analysis                             │
│  • Scans entry point (index.html → main.tsx)                │
│  • Builds dependency graph of all imports                   │
│  • Identifies lazy-loaded routes (React.lazy)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 4: Code Splitting                                    │
│  • Applies manual chunk configuration                       │
│  • Separates vendor libraries into dedicated chunks         │
│  • Creates async chunks for lazy-loaded components          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 5: Transformation & Bundling                         │
│  • Transpiles TypeScript → JavaScript (ESBuild)             │
│  • Transforms JSX → React.createElement calls               │
│  • Processes Tailwind CSS (@apply, theme(), etc.)           │
│  • Resolves @/* path aliases                                │
│  • Bundles modules with Rollup                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 6: Optimization                                      │
│  • Tree shaking (removes unused code)                       │
│  • Minification (ESBuild minifier)                          │
│  • CSS extraction and minification                          │
│  • Asset hashing (cache busting)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 7: Output Generation (dist/)                         │
│  • index.html (with hashed asset references)                │
│  • assets/index-[hash].js (main bundle)                     │
│  • assets/vendor-react-[hash].js                            │
│  • assets/vendor-ui-[hash].js                               │
│  • assets/vendor-charts-[hash].js                           │
│  • assets/vendor-motion-[hash].js                           │
│  • assets/vendor-dates-[hash].js                            │
│  • assets/vendor-excel-[hash].js                            │
│  • assets/[component]-[hash].js (lazy chunks)               │
│  • assets/index-[hash].css                                  │
└─────────────────────────────────────────────────────────────┘
```

### Build Output Structure

```
dist/
├── index.html                          # Entry HTML (with hashed assets)
├── assets/
│   ├── index-a1b2c3d4.js              # Main application bundle
│   ├── index-e5f6g7h8.css             # Extracted CSS
│   ├── vendor-react-i9j0k1l2.js       # React core chunk
│   ├── vendor-ui-m3n4o5p6.js          # UI utilities chunk
│   ├── vendor-charts-q7r8s9t0.js      # Charts libraries chunk
│   ├── vendor-motion-u1v2w3x4.js      # Animation library chunk
│   ├── vendor-dates-y5z6a7b8.js       # Date utilities chunk
│   ├── vendor-excel-c9d0e1f2.js       # Excel export chunk
│   ├── Dashboard-g3h4i5j6.js          # Lazy-loaded view
│   ├── TaskBoard-k7l8m9n0.js          # Lazy-loaded view
│   ├── HandoverFlow-o1p2q3r4.js       # Lazy-loaded view
│   ├── OfficeRegister-s5t6u7v8.js     # Lazy-loaded view
│   ├── OfficeMap-w9x0y1z2.js          # Lazy-loaded view
│   ├── TeamPerformance-a3b4c5d6.js    # Lazy-loaded view
│   ├── Reporting-e7f8g9h0.js          # Lazy-loaded view
│   ├── AICopilot-i1j2k3l4.js          # Lazy-loaded view
│   ├── ActivityFeed-m5n6o7p8.js       # Lazy-loaded view
│   ├── Settings-q9r0s1t2.js           # Lazy-loaded view
│   ├── UserManager-u3v4w5x6.js        # Lazy-loaded view
│   └── UserProfile-y7z8a9b0.js        # Lazy-loaded view
└── vite.svg                            # Static assets
```

### Build Performance Metrics

Typical production build times on modern hardware:

| Stage | Duration | Notes |
|-------|----------|-------|
| TypeScript compilation | 3-5s | Full type checking |
| Vite bundling | 8-12s | Includes all optimizations |
| **Total** | **11-17s** | Clean build |

**Build output size** (gzipped):
- Main bundle: ~150-200 KB
- Vendor chunks: ~400-500 KB total
- Lazy chunks: ~20-50 KB each
- CSS: ~50-80 KB

---

## Code Splitting Strategy

### Manual Chunk Configuration

The build system uses **manual chunking** to optimize caching and loading performance:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-ui': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
  'vendor-charts': ['recharts', 'd3'],
  'vendor-motion': ['motion'],
  'vendor-dates': ['date-fns'],
  'vendor-excel': ['exceljs'],
}
```

### Chunk Strategy Rationale

| Chunk | Size | Update Frequency | Cache Strategy |
|-------|------|------------------|----------------|
| **vendor-react** | ~120 KB | Very low (framework updates) | Long-term cache |
| **vendor-ui** | ~80 KB | Low (icon/utility updates) | Long-term cache |
| **vendor-charts** | ~200 KB | Low (chart library updates) | Long-term cache |
| **vendor-motion** | ~60 KB | Low (animation updates) | Long-term cache |
| **vendor-dates** | ~40 KB | Very low (date utility updates) | Long-term cache |
| **vendor-excel** | ~150 KB | Very low (export feature) | Long-term cache |
| **Main bundle** | ~150 KB | High (app code changes) | Short-term cache |
| **Lazy chunks** | ~20-50 KB each | Medium (feature updates) | Medium-term cache |

### Lazy Loading Implementation

All view components are lazy-loaded using React's `lazy()` and `Suspense`:

```typescript
// App.tsx
const Dashboard = lazy(() => import('./components/views/Dashboard'));
const TaskBoard = lazy(() => import('./components/views/TaskBoard'));
const HandoverFlow = lazy(() => import('./components/views/HandoverFlow'));
// ... etc

<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'dashboard' && <Dashboard />}
  {activeTab === 'tasks' && <TaskBoard />}
  {activeTab === 'handovers' && <HandoverFlow />}
</Suspense>
```

**Benefits:**
- Initial bundle size reduced by ~60%
- Faster Time to Interactive (TTI)
- On-demand loading of features
- Better caching granularity

---

## Optimization Techniques

### 1. Dependency Pre-bundling

Vite pre-bundles heavy dependencies during dev server startup:

```typescript
optimizeDeps: {
  include: ['react', 'react-dom', 'lucide-react', 'motion', 'date-fns'],
}
```

**Why?**
- Converts CommonJS/UMD modules to ES modules
- Reduces HTTP requests (bundles many small files)
- Improves dev server cold start time

### 2. Tree Shaking

Vite automatically removes unused code in production:

```typescript
// Only the used icons are included in the bundle
import { Calendar, User, Settings } from 'lucide-react';
```

**Result**: Instead of bundling all 1000+ Lucide icons (~2 MB), only the 3 used icons are included (~5 KB).

### 3. CSS Code Splitting

CSS is automatically split per JavaScript chunk:

```typescript
build: {
  cssCodeSplit: true,
}
```

**Result**: Each lazy-loaded component gets its own CSS file, loaded on-demand.

### 4. Minification

ESBuild minifier is used for fast, efficient minification:

```typescript
build: {
  minify: isProduction ? 'esbuild' : false,
}
```

**Techniques:**
- Variable name mangling
- Whitespace removal
- Dead code elimination
- Constant folding

### 5. Asset Hashing

All assets get content-based hashes for cache busting:

```
index-a1b2c3d4.js  → Changes only when content changes
```

**Cache Strategy:**
```
Cache-Control: public, max-age=31536000, immutable
```

### 6. Source Maps

Source maps are generated in development only:

```typescript
build: {
  sourcemap: !isProduction,
}
```

**Why?**
- Enables debugging in dev
- Reduces production bundle size
- Protects source code in production

---

## Deployment

### Cloudflare Workers Deployment

The application is configured for edge deployment via Cloudflare Workers.

#### Wrangler Configuration (`wrangler.toml`)

```toml
name = "trygc-hub-manager"
type = "javascript"
account_id = ""
workers_dev = true

[env.production]
name = "trygc-hub-manager-prod"
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]

[build]
command = "npm run build"
cwd = "./"
watch_paths = ["src/**/*.ts", "src/**/*.tsx"]

[build.upload]
format = "service-worker"
```

#### Deployment Scripts

**Windows** (`deploy-cloudflare.bat`):
```batch
@echo off
echo Building application...
call npm run build

echo Deploying to Cloudflare Workers...
call wrangler deploy

echo Deployment complete!
```

**Unix/Linux** (`deploy-cloudflare.sh`):
```bash
#!/bin/bash
echo "Building application..."
npm run build

echo "Deploying to Cloudflare Workers..."
wrangler deploy

echo "Deployment complete!"
```

#### Deployment Process

```bash
# Windows
deploy-cloudflare.bat

# Unix/Linux
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

**Steps:**
1. Runs `npm run build` (TypeScript + Vite)
2. Uploads `dist/` to Cloudflare Workers
3. Deploys to edge network (global CDN)

### Static Hosting Deployment

For traditional static hosting (Netlify, Vercel, AWS S3, etc.):

```bash
# Build production bundle
npm run build

# Preview locally
npm run preview

# Deploy dist/ folder to hosting provider
```

**Requirements:**
- Serve `dist/index.html` for all routes (SPA routing)
- Set proper cache headers for hashed assets
- Configure HTTPS

---

## Troubleshooting

### Common Build Issues

#### 1. TypeScript Errors During Build

**Symptom:**
```
npm run build
> tsc && vite build
src/components/TaskModal.tsx:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.
```

**Solution:**
```bash
# Run type checker to see all errors
npm run lint

# Fix type errors in source code
# Then rebuild
npm run build
```

#### 2. Out of Memory Errors

**Symptom:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution:**
```bash
# Increase Node.js memory limit
set NODE_OPTIONS=--max-old-space-size=4096
npm run build
```

#### 3. Vite Cache Issues

**Symptom:**
- Stale modules in dev server
- Unexpected behavior after dependency updates

**Solution:**
```bash
# Clear Vite cache
rimraf node_modules/.vite

# Restart dev server
npm run dev
```

#### 4. HMR Not Working

**Symptom:**
- Changes require full page reload
- HMR updates fail silently

**Solution:**
```bash
# Check if HMR is disabled
echo %DISABLE_HMR%

# Re-enable HMR
set DISABLE_HMR=false
npm run dev
```

#### 5. Build Size Warnings

**Symptom:**
```
(!) Some chunks are larger than 1200 KiB after minification.
```

**Solution:**
- Review `manualChunks` configuration
- Identify large dependencies with `npm run build -- --mode analyze`
- Consider lazy loading heavy features
- Increase `chunkSizeWarningLimit` if acceptable

#### 6. Path Alias Resolution Errors

**Symptom:**
```
Cannot find module '@/components/TaskModal'
```

**Solution:**
- Verify `tsconfig.json` has `"@/*": ["./src/*"]`
- Verify `vite.config.ts` has matching alias
- Restart TypeScript server in IDE
- Rebuild: `npm run clean && npm run build`

### Performance Optimization Tips

#### 1. Analyze Bundle Size

```bash
# Install bundle analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  react(),
  tailwindcss(),
  visualizer({ open: true })
]

# Build and view report
npm run build
```

#### 2. Optimize Images

- Use WebP format for images
- Compress images before adding to `public/`
- Consider lazy loading images with `loading="lazy"`

#### 3. Reduce Dependency Size

```bash
# Analyze dependency sizes
npx vite-bundle-visualizer

# Replace heavy dependencies with lighter alternatives
# Example: moment.js (288 KB) → date-fns (13 KB)
```

#### 4. Enable Compression

Configure hosting provider to serve gzip/brotli compressed assets:

```
Content-Encoding: br
```

**Typical compression ratios:**
- JavaScript: 70-80% reduction
- CSS: 80-85% reduction
- HTML: 60-70% reduction

---

## Build System Maintenance

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies (careful!)
npm update

# Update specific package
npm install vite@latest

# Rebuild after updates
npm run clean && npm run build
```

### Vite Version Upgrades

When upgrading Vite major versions:

1. Review [Vite migration guide](https://vitejs.dev/guide/migration.html)
2. Update `vite.config.ts` for breaking changes
3. Test dev server: `npm run dev`
4. Test production build: `npm run build && npm run preview`
5. Run full test suite: `npm test`

### TypeScript Version Upgrades

When upgrading TypeScript:

1. Review [TypeScript release notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
2. Update `tsconfig.json` for new features/options
3. Run type checker: `npm run lint`
4. Fix any new type errors
5. Test build: `npm run build`

---

## Build System Best Practices

### 1. Keep Dependencies Updated

- Review dependencies monthly
- Update patch versions weekly
- Test thoroughly after major version updates

### 2. Monitor Bundle Size

- Set up CI/CD bundle size checks
- Alert on significant size increases
- Review bundle analyzer reports regularly

### 3. Use Strict TypeScript

- Keep `strict: true` in `tsconfig.json`
- Fix type errors immediately
- Avoid `any` types

### 4. Optimize for Production

- Always run `npm run build` before deployment
- Test production build locally with `npm run preview`
- Verify all features work in production mode

### 5. Cache Optimization

- Use long cache times for hashed assets
- Implement proper cache invalidation
- Monitor cache hit rates

### 6. Security

- Run `npm audit` regularly
- Update vulnerable dependencies promptly
- Use `npm ci` in CI/CD for reproducible builds

---

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Rollup Documentation](https://rollupjs.org/)
- [ESBuild Documentation](https://esbuild.github.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

## Summary

The Trygc Hub Manager build system is optimized for:

✅ **Fast development** with HMR and pre-bundling  
✅ **Efficient production bundles** with code splitting  
✅ **Type safety** with strict TypeScript  
✅ **Modern browser targets** (ES2022)  
✅ **Edge deployment** via Cloudflare Workers  
✅ **Long-term maintainability** with clear configuration

**Key Commands:**
```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Type checking
npm run clean    # Clean build artifacts
```
