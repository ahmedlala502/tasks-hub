import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Pre-bundle heavy deps for faster dev startup
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'motion', 'date-fns'],
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      reportCompressedSize: false,
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
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
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/ai': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
