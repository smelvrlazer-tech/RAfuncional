import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  test: {
    // As regras moram no Postgres: testes rodam em série contra um banco real.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
