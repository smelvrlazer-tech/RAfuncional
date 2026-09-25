import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, criarUsuario, limparDados } from './helpers/db'

/** Usuário do Auth sem perfil: é assim que alguém chega ao aceitar_convite. */
async function criarAuthSemPerfil() {
  const email = `n${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.local`
  const password = 'senha-de-teste-123'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (erroLogin) throw erroLogin
  return { id: data.user!.id, cliente }
}

async function novoConvite(nome = 'Convidado'): Promise<string> {
  const treinador = await criarUsuario('treinador')
  const { data, error } = await treinador.cliente.rpc('criar_convite', { p_nome: nome })
  if (error) throw error
  return data.codigo as string
}

async function perfilExiste(id: string): Promise<boolean> {
  const { count } = await admin.from('perfis').select('*', { count: 'exact', head: true }).eq('id', id)
  return count === 1
}

describe('convites', () => {
  beforeEach(limparDados)

  it('treinador gera convite com código de 12 caracteres', async () => {
    const treinador = await criarUsuario('treinador')
    const { data, error } = await treinador.cliente.rpc('criar_convite', { p_nome: 'João' })
    expect(error).toBeNull()
    expect(data.codigo).toHaveLength(12)
    expect(data.codigo).toMatch(/^[0-9A-F]{12}$/)

    const { data: convite } = await admin.from('convites')
      .select('nome_previsto, status, expira_em').eq('codigo', data.codigo).single()
    expect(convite!.nome_previsto).toBe('João')
    expect(convite!.status).toBe('pendente')
  })

  it('códigos gerados em sequência são distintos', async () => {
    const treinador = await criarUsuario('treinador')
    const codigos = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const { data } = await treinador.cliente.rpc('criar_convite', {})
      codigos.add(data.codigo)
    }
    expect(codigos.size).toBe(5)
  })

  it('aluno não pode gerar convite', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.rpc('criar_convite', { p_nome: 'Maria' })
    expect(error!.message).toContain('acesso_negado')
  })

  it('anônimo não pode chamar criar_convite nem aceitar_convite', async () => {
    const anonimo = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    const r1 = await anonimo.rpc('criar_convite', { p_nome: 'X' })
    expect(r1.error!.message).toMatch(/permission denied/i)
    const r2 = await anonimo.rpc('aceitar_convite', { p_codigo: 'QUALQUER', p_nome: 'X', p_telefone: null })
    expect(r2.error!.message).toMatch(/permission denied/i)
  })

  it('aceitar convite cria o perfil como aluno e marca como usado', async () => {
    const codigo = await novoConvite('Ana')
    const novo = await criarAuthSemPerfil()

    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Ana Silva', p_telefone: '11999999999',
    })
    expect(error).toBeNull()

    const { data: perfil } = await admin.from('perfis')
      .select('nome, telefone, papel, ativo').eq('id', novo.id).single()
    expect(perfil).toEqual({ nome: 'Ana Silva', telefone: '11999999999', papel: 'aluno', ativo: true })

    const { data: usado } = await admin.from('convites')
      .select('status, usado_por').eq('codigo', codigo).single()
    expect(usado!.status).toBe('usado')
    expect(usado!.usado_por).toBe(novo.id)
  })

  it('o cliente não consegue escolher o papel ao aceitar', async () => {
    const codigo = await novoConvite()
    const novo = await criarAuthSemPerfil()
    // A função não tem parâmetro de papel: o PostgREST nem encontra essa assinatura.
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Esperto', p_telefone: null, p_papel: 'treinador',
    })
    expect(error).not.toBeNull()
    expect(await perfilExiste(novo.id)).toBe(false)
  })

  it('recusa código inexistente', async () => {
    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: 'INEXISTENTE', p_nome: 'X', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
    expect(await perfilExiste(novo.id)).toBe(false)
  })

  it('recusa nome vazio', async () => {
    const codigo = await novoConvite()
    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: '   ', p_telefone: null,
    })
    expect(error!.message).toContain('nome_obrigatorio')

    const { data } = await admin.from('convites').select('status').eq('codigo', codigo).single()
    expect(data!.status).toBe('pendente')
  })

  it('recusa convite já usado', async () => {
    const codigo = await novoConvite('Bia')
    const primeiro = await criarAuthSemPerfil()
    const r1 = await primeiro.cliente.rpc('aceitar_convite', { p_codigo: codigo, p_nome: 'Bia', p_telefone: null })
    expect(r1.error).toBeNull()

    const segundo = await criarAuthSemPerfil()
    const { error } = await segundo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Intruso', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
    expect(await perfilExiste(segundo.id)).toBe(false)
  })

  it('recusa convite expirado', async () => {
    const codigo = await novoConvite('Caio')
    await admin.from('convites')
      .update({ expira_em: new Date(Date.now() - 86_400_000).toISOString() })
      .eq('codigo', codigo)

    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Caio', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
  })

  it('recusa convite revogado', async () => {
    const codigo = await novoConvite('Dani')
    await admin.from('convites').update({ status: 'revogado' }).eq('codigo', codigo)

    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Dani', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
  })

  it('quem já tem perfil não consome convite', async () => {
    const codigo = await novoConvite()
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.rpc('aceitar_convite', {
      p_codigo: codigo, p_nome: 'Outra conta', p_telefone: null,
    })
    expect(error!.message).toContain('perfil_ja_existe')

    const { data } = await admin.from('convites').select('status').eq('codigo', codigo).single()
    expect(data!.status).toBe('pendente')
  })

  it('dois usuários aceitando o mesmo convite ao mesmo tempo: só um entra', async () => {
    const codigo = await novoConvite('Disputado')
    const u1 = await criarAuthSemPerfil()
    const u2 = await criarAuthSemPerfil()

    const resultados = await Promise.all([
      u1.cliente.rpc('aceitar_convite', { p_codigo: codigo, p_nome: 'U1', p_telefone: null }),
      u2.cliente.rpc('aceitar_convite', { p_codigo: codigo, p_nome: 'U2', p_telefone: null }),
    ])
    const sucessos = resultados.filter(r => r.error === null)
    const falhas = resultados.filter(r => r.error !== null)
    expect(sucessos).toHaveLength(1)
    expect(falhas).toHaveLength(1)
    expect(falhas[0].error!.message).toContain('convite_invalido')

    const vencedor = resultados[0].error === null ? u1 : u2
    const perdedor = vencedor === u1 ? u2 : u1
    const { data } = await admin.from('convites').select('usado_por').eq('codigo', codigo).single()
    expect(data!.usado_por).toBe(vencedor.id)
    expect(await perfilExiste(vencedor.id)).toBe(true)
    expect(await perfilExiste(perdedor.id)).toBe(false)
  })
})
