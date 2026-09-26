import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Um worker só: a máquina de desenvolvimento tem pouca memória livre.
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.teste.local',
      VITE_SUPABASE_ANON_KEY: 'chave-anon-de-teste',
    },
  },
})
