import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, criarUsuario, limparDados } from './helpers/db'

describe('senha provisória', () => {
  beforeEach(async () => { await limparDados() })

  it('só o treinador redefine, só de aluno; a senha provisória entra e a troca libera o app', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const outro = await criarUsuario('aluno')

    const negado = await outro.cliente.rpc('treinador_redefinir_senha', { p_aluno_id: aluno.id })
    expect(negado.error?.code).toBe('42501')
    const emTreinador = await treinador.cliente.rpc('treinador_redefinir_senha', { p_aluno_id: treinador.id })
    expect(emTreinador.error?.message).toContain('apenas_alunos')

    const { data, error } = await treinador.cliente.rpc('treinador_redefinir_senha', { p_aluno_id: aluno.id })
    expect(error).toBeNull()
    const provisoria: string = data.senha_provisoria
    expect(provisoria).toHaveLength(10)
    expect(provisoria).not.toMatch(/[lIO01]/)

    const { data: perfil } = await admin.from('perfis').select('trocar_senha').eq('id', aluno.id).single()
    expect(perfil!.trocar_senha).toBe(true)

    // Entra com a provisória (e a anterior deixa de valer).
    const novo = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const login = await novo.auth.signInWithPassword({ email: aluno.email, password: provisoria })
    expect(login.error).toBeNull()

    // Troca a senha e conclui: o aviso some.
    const troca = await novo.auth.updateUser({ password: 'SenhaNovaSegura9' })
    expect(troca.error).toBeNull()
    expect((await novo.rpc('concluir_troca_senha')).error).toBeNull()
    const { data: depois } = await admin.from('perfis').select('trocar_senha').eq('id', aluno.id).single()
    expect(depois!.trocar_senha).toBe(false)

    const relogin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    expect((await relogin.auth.signInWithPassword({ email: aluno.email, password: 'SenhaNovaSegura9' })).error).toBeNull()
  })
})
