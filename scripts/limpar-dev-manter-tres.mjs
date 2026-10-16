// Deixa o projeto DEV só com Rafael (treinador), Ana e Bruno (alunos): apaga os demais usuários
// do Auth (cascata leva perfis e check-ins), turmas de teste e convites soltos.
// Uso: node scripts/limpar-dev-manter-tres.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.test' })

const url = process.env.SUPABASE_URL
if (!url || !url.includes('mixrbjskhftungppggow')) {
  console.error('Recusado: SUPABASE_URL não aponta para o projeto ra-funcional-dev.')
  process.exit(1)
}
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MANTER = new Set(['rafael.dev@ra-funcional.local', 'ana.dev@ra-funcional.local', 'bruno.dev@ra-funcional.local'])

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

const turmas = await admin.from('turmas').delete().ilike('nome', '%teste%').select('id')
console.log('Turmas de teste apagadas:', turmas.error ? turmas.error.message : turmas.data.length)
const convites = await admin.from('convites').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
console.log('Convites apagados:', convites.error ? convites.error.message : convites.data.length)

const { data: perfis } = await admin.from('perfis').select('nome, papel, ativo').order('papel')
console.log('Perfis restantes:', perfis)
