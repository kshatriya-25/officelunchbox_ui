import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Third arg '' loads every var, not just VITE_-prefixed ones, so dev-only
  // settings like the proxy target stay out of the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'
  const proxy = { target, changeOrigin: true }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      // Talk to FastAPI through the dev server so the browser sees one origin
      // and never hits CORS. Only needed when VITE_API_BASE_URL is a path.
      proxy: {
        '/api': proxy,
        '/uploads': proxy,
        '/health': proxy,
      },
    },
  }
})
