import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const BACKEND = `http://localhost:${process.env.BACKEND_PORT ?? 3008}`

// Rutas del backend que el dev server debe redirigir hacia FastAPI.
const API_PATHS = ['/admin', '/upload', '/sign', '/list', '/files', '/health']

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PATHS.map((p) => [p, { target: BACKEND, changeOrigin: true, xfwd: true }])
    ),
  },
})
