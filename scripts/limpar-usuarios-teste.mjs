// Apaga usuários de teste (email @teste.local, criados por tests/helpers/db.ts) do
// projeto Supabase DEV. Nunca toca em contas @ra-funcional.local (seed do front) nem
// em nada fora do domínio de teste. Uso: node scripts/limpar-usuarios-teste.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.test' })

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !url.includes('mixrbjskhftungppggow')) {
  console.error('Recusado: SUPABASE_URL não aponta para o projeto ra-funcional-dev.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

let pagina = 1
let apagados = 0
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 })
  if (error) throw error
  const alvos = data.users.filter(u => (u.email || '').endsWith('@teste.local'))
  for (const u of alvos) {
    const { error: erroDelete } = await admin.auth.admin.deleteUser(u.id)
    if (erroDelete) console.error('falhou:', u.email, erroDelete.message)
    else apagados++
  }
  if (data.users.length < 1000) break
  pagina++
}

console.log(`Usuários de teste apagados: ${apagados}`)
