// Deixa o banco real só com as contas listadas em MANTER (apaga o resto: usuários de teste, convites soltos).
// Uso: node scripts/limpar-producao.mjs .env.producao
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: process.argv[2] ?? '.env.producao' })
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MANTER = new Set([
  'rafael@acesso.ra-funcional.local', // professor (código de acesso: rafael)
  'ana.dev@ra-funcional.local', // aluna de demonstração
  'bruno.dev@ra-funcional.local', // aluno de demonstração
])
let apagados = 0
for (let pagina = 1; ; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 })
  if (error) throw error
  for (const u of data.users.filter((x) => !MANTER.has(x.email ?? ''))) {
    const { error: e } = await admin.auth.admin.deleteUser(u.id)
    if (e) console.error('falhou:', u.email, e.message)
    else apagados++
  }
  if (data.users.length < 1000) break
}
console.log('Usuários apagados:', apagados)
const { data: perfis } = await admin.from('perfis').select('nome, papel, ativo').order('papel')
console.log('Perfis restantes:', perfis)
