import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.SUPABASE_ANON_KEY!

/** Cliente com service_role: ignora RLS. Só para preparar cenário nos testes. */
export const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

export interface Usuario {
  id: string
  email: string
  cliente: SupabaseClient
}

/** Cria um usuário autenticado de verdade e devolve um cliente logado como ele. */
export async function criarUsuario(
  papel: 'aluno' | 'treinador' = 'aluno',
  opcoes: { ativo?: boolean } = {},
): Promise<Usuario> {
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.local`
  const password = 'senha-de-teste-123'

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error

  const { error: erroPerfil } = await admin.from('perfis').insert({
    id: data.user!.id, nome: 'Aluno Teste', papel, ativo: opcoes.ativo ?? true,
  })
  if (erroPerfil) throw erroPerfil

  const cliente = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (erroLogin) throw erroLogin

  return { id: data.user!.id, email, cliente }
}

/** Apaga dados transacionais entre testes. Configurações e perfis permanecem. */
export async function limparDados(): Promise<void> {
  const tabelas = ['checkins', 'notificacoes', 'inscricoes_push', 'sessoes', 'turmas', 'treinos', 'convites']
  for (const tabela of tabelas) {
    const { error } = await admin.from(tabela).delete().gte('criado_em', '1970-01-01')
    if (error && !error.message.includes('does not exist')) throw error
  }
}

export async function definirConfig(chave: string, valor: string): Promise<void> {
  const { error } = await admin.from('configuracoes').update({ valor }).eq('chave', chave)
  if (error) throw error
}
