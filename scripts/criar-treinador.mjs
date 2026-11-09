// Cria (ou redefine a senha de) uma conta de treinador que entra por CÓDIGO DE ACESSO, sem e-mail de verdade.
// Uso:  node scripts/criar-treinador.mjs <arquivo .env> <codigo> "<Nome completo>"
//   ex.: node scripts/criar-treinador.mjs .env.producao rafael "Rafael Alvarenga"
// O .env precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. A senha é sorteada e mostrada UMA vez.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomBytes } from 'node:crypto'

const [arquivoEnv, codigoBruto, nome] = process.argv.slice(2)
if (!arquivoEnv || !codigoBruto || !nome) {
  console.error('Uso: node scripts/criar-treinador.mjs <arquivo .env> <codigo> "<Nome completo>"')
  process.exit(1)
}
config({ path: arquivoEnv })
const codigo = codigoBruto.toLowerCase().replace(/\s+/g, '')
const email = `${codigo}@acesso.ra-funcional.local`
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 12 caracteres sem letras/números ambíguos (l, I, O, 0, 1)
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const senha = Array.from(randomBytes(12), (b) => ALFABETO[b % ALFABETO.length]).join('')

let id
const { data: criado, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
if (error) {
  if (!/already|registered|exists/i.test(error.message)) throw error
  // Já existe: redefine a senha.
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  id = lista.users.find((u) => u.email === email)?.id
  if (!id) throw error
  const { error: e2 } = await admin.auth.admin.updateUserById(id, { password: senha })
  if (e2) throw e2
} else {
  id = criado.user.id
}

const { error: e3 } = await admin.from('perfis').upsert({ id, nome, papel: 'treinador', ativo: true }, { onConflict: 'id' })
if (e3) throw e3

console.log(`Treinador pronto: ${nome}`)
console.log(`  Código de acesso: ${codigo}`)
console.log(`  Senha provisória: ${senha}   (anote agora: não será mostrada de novo; troque no Perfil)`)
