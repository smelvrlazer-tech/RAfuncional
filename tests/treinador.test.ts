import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

/**
 * Novo início para a sessão, a N minutos do "agora" do servidor.
 * Deriva do inicia_em gravado por criarSessao (que usa o relógio do Postgres),
 * não de Date.now(): o relógio local pode estar adiantado em relação ao banco.
 */
function iniciaEmServidor(sessao: { inicia_em: string }, minutosOriginais: number, minutosNovos: number) {
  const agoraServidor = new Date(sessao.inicia_em).getTime() - minutosOriginais * 60_000
  return new Date(agoraServidor + minutosNovos * 60_000).toISOString()
}

async function statusDe(sessaoId: string, alunoId: string) {
  const { data, error } = await admin.from('checkins')
    .select('status, posicao_fila').eq('sessao_id', sessaoId).eq('aluno_id', alunoId).single()
  if (error) throw error
  return data!
}

describe('ações do treinador', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('remove aluno mesmo após o bloqueio e libera a vaga', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: iniciaEmServidor(sessao, 120, 30) })
      .eq('id', sessao.id)

    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id,
    })
    expect(error).toBeNull()
    expect((await statusDe(sessao.id, aluno.id)).status).toBe('cancelado')

    const { data } = await admin.from('notificacoes').select('titulo').eq('perfil_id', aluno.id)
    expect(data!.map(n => n.titulo)).toEqual(['Presença removida'])
  })

  it('remover confirmado antes do bloqueio promove o primeiro da fila', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const confirmado = await criarUsuario('aluno')
    const naFila = await criarUsuario('aluno')
    await confirmado.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await naFila.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: confirmado.id,
    })
    expect(error).toBeNull()
    expect(await statusDe(sessao.id, naFila.id)).toEqual({ status: 'confirmado', posicao_fila: null })

    const { data } = await admin.from('notificacoes').select('titulo').eq('perfil_id', naFila.id)
    expect(data!.map(n => n.titulo)).toEqual(['Vaga liberada!'])
  })

  it('remover confirmado depois do bloqueio não promove ninguém', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const confirmado = await criarUsuario('aluno')
    const naFila = await criarUsuario('aluno')
    await confirmado.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await naFila.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: iniciaEmServidor(sessao, 120, 30) })
      .eq('id', sessao.id)

    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: confirmado.id,
    })
    expect(error).toBeNull()
    expect((await statusDe(sessao.id, naFila.id)).status).toBe('espera')
  })

  it('remover alguém da fila não promove ninguém e mantém a ordem dos demais', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const confirmado = await criarUsuario('aluno')
    const e1 = await criarUsuario('aluno')
    const e2 = await criarUsuario('aluno')
    for (const a of [confirmado, e1, e2]) {
      await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    }

    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: e1.id,
    })
    expect(error).toBeNull()
    expect(await statusDe(sessao.id, e1.id)).toEqual({ status: 'cancelado', posicao_fila: null })
    expect((await statusDe(sessao.id, confirmado.id)).status).toBe('confirmado')
    expect((await statusDe(sessao.id, e2.id)).status).toBe('espera')
  })

  it('recusa remover quem não tem check-in ativo', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id,
    })
    expect(error!.message).toContain('checkin_inexistente')
  })

  it('aluno não consegue remover outro aluno', async () => {
    const sessao = await criarSessao(120, 2)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { error } = await a1.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: a2.id,
    })
    expect(error!.message).toContain('acesso_negado')
    expect((await statusDe(sessao.id, a2.id)).status).toBe('confirmado')
  })

  it('cancela a sessão e notifica confirmados e fila', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const confirmado = await criarUsuario('aluno')
    const naFila = await criarUsuario('aluno')
    const desistiu = await criarUsuario('aluno')
    await desistiu.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await desistiu.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    await confirmado.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await naFila.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data: resultado, error } = await treinador.cliente.rpc('treinador_cancelar_sessao', {
      p_sessao_id: sessao.id, p_observacao: 'Chuva forte',
    })
    expect(error).toBeNull()
    expect(resultado).toEqual({ cancelada: true, avisados: 2 })

    const { data } = await admin.from('notificacoes').select('perfil_id, corpo')
    expect(data!.map(n => n.perfil_id).sort()).toEqual([confirmado.id, naFila.id].sort())
    for (const n of data!) expect(n.corpo).toContain('Chuva forte')

    const { data: s } = await admin.from('sessoes').select('cancelada, observacao').eq('id', sessao.id).single()
    expect(s).toEqual({ cancelada: true, observacao: 'Chuva forte' })

    // Sessão cancelada não aceita novo check-in.
    const outro = await criarUsuario('aluno')
    const r = await outro.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(r.error!.message).toContain('sessao_cancelada')
  })

  it('cancelar de novo a mesma sessão é recusado e não notifica em dobro', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    await treinador.cliente.rpc('treinador_cancelar_sessao', { p_sessao_id: sessao.id, p_observacao: 'Chuva' })
    const { error } = await treinador.cliente.rpc('treinador_cancelar_sessao', {
      p_sessao_id: sessao.id, p_observacao: 'Chuva de novo',
    })
    expect(error!.message).toContain('sessao_cancelada')

    const { count } = await admin.from('notificacoes')
      .select('*', { count: 'exact', head: true }).eq('perfil_id', aluno.id)
    expect(count).toBe(1)
  })

  it('aluno não consegue cancelar a sessão', async () => {
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.rpc('treinador_cancelar_sessao', {
      p_sessao_id: sessao.id, p_observacao: 'Não quero',
    })
    expect(error!.message).toContain('acesso_negado')

    const { data } = await admin.from('sessoes').select('cancelada').eq('id', sessao.id).single()
    expect(data!.cancelada).toBe(false)
  })

  it('anônimo não pode chamar as ações do treinador', async () => {
    const anonimo = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    const sessao = await criarSessao(120, 1)
    const r1 = await anonimo.rpc('treinador_cancelar_sessao', { p_sessao_id: sessao.id, p_observacao: 'x' })
    expect(r1.error!.message).toMatch(/permission denied/i)
    const r2 = await anonimo.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(r2.error!.message).toMatch(/permission denied/i)
  })
})
