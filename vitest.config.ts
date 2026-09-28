import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  test: {
    // As regras moram no Postgres: testes rodam em série contra um banco real.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    // web/ tem sua própria suíte (ambiente jsdom, config própria) e roda com
    // `npm test` dentro de web/. Sem isso o vitest da raiz também coleta os
    // testes do front e falha com "document is not defined".
    include: ['tests/**/*.test.ts'],
  },
})
