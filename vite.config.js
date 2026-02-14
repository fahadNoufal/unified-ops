import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// CHANGE THIS to your repository name
const REPO_NAME = '/unified-ops/' 

export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    base: '/', // Default for local development
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }

  // ONLY apply the repo name as base path when building for production
  if (command !== 'serve') {
    config.base = REPO_NAME
  }

  return config
})