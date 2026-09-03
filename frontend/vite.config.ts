import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // We don't need heavy plugins, just standard react
  server: {
    port: 3000,
    host: true
  }
})
