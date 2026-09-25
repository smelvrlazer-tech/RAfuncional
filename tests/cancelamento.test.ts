import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

/**
 * Novo início para a sessão, a N minutos do "agora" do servidor.
 * Deriva do inicia_em gravado por criarSessao (que já usa o relógio do Postgres),
 * não de Date.now(): o relógio local pode estar adiantado em relação ao banco.
 */
function iniciaEmServidor(sessao: { inicia_em: string }, minutosOriginais: number, minutosNovos: number) {
  const agoraServidor = new Date(sessao.inicia_em).getTime() - minutosOriginais * 60_000
  return new Date(agoraServidor + minutosNovos * 60_000).toISOString()
}

describe('cancelamento e fila de espera', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('promove o primeiro da fila quando alguém cancela', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { error } = await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()

    const { data } = await admin.from('checkins')
      .select('status, posicao_fila').eq('sessao_id', sessao.id).eq('aluno_id', a2.id).single()
    expect(data!.status).toBe('confirmado')
    expect(data!.posicao_fila).toBeNull()
  })

  it('respeita a ordem FIFO da fila', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const a3 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a3.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await admin.from('checkins')
      .select('aluno_id, status').eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(data!.map(c => c.aluno_id)).toEqual([a2.id])
  })

  it('registra notificação para o aluno promovido', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await admin.from('notificacoes').select('titulo, corpo').eq('perfil_id', a2.id)
    expect(data!.length).toBe(1)
    expect(data![0].titulo).toContain('Vaga liberada')
    expect(data![0].corpo).toMatch(/\d{2}\/\d{2} às \d{2}:\d{2}/)
  })

  it('bloqueia cancelamento de confirmado faltando 59 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: iniciaEmServidor(sessao, 120, 59) })
      .eq('id', sessao.id)

    const { error } = await aluno.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('permite sair da fila de espera mesmo após o bloqueio', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: iniciaEmServidor(sessao, 120, 30) })
      .eq('id', sessao.id)

    const { error } = await a2.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
  })

  it('não promove ninguém depois do bloqueio', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: iniciaEmServidor(sessao, 120, 30) })
      .eq('id', sessao.id)

    // Treinador remove o confirmado: vaga abre, mas a fila está congelada.
    await admin.from('checkins').update({ status: 'cancelado' })
      .eq('sessao_id', sessao.id).eq('aluno_id', a1.id)
    const { data: promovido, error } = await admin.rpc('promover_da_espera', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(promovido).toBeNull()

    const { data } = await admin.from('checkins')
      .select('status').eq('sessao_id', sessao.id).eq('aluno_id', a2.id).single()
    expect(data!.status).toBe('espera')
  })

  it('promover_da_espera é interna: aluno autenticado não pode chamá-la', async () => {
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.rpc('promover_da_espera', { p_sessao_id: sessao.id })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
  })

  it('dois cancelamentos simultâneos não promovem duas pessoas para uma vaga', async () => {
    const sessao = await criarSessao(120, 2)
    const c1 = await criarUsuario('aluno')
    const c2 = await criarUsuario('aluno')
    const e1 = await criarUsuario('aluno')
    for (const a of [c1, c2, e1]) {
      await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    }

    const resultados = await Promise.all([
      c1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
      c2.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
    ])
    for (const r of resultados) expect(r.error).toBeNull()

    const { count } = await admin.from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(count).toBe(1)
  })

  it('dois cancelamentos simultâneos promovem exatamente os dois primeiros da fila', async () => {
    const sessao = await criarSessao(120, 2)
    const c1 = await criarUsuario('aluno')
    const c2 = await criarUsuario('aluno')
    const e1 = await criarUsuario('aluno')
    const e2 = await criarUsuario('aluno')
    const e3 = await criarUsuario('aluno')
    for (const a of [c1, c2, e1, e2, e3]) {
      await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    }

    const resultados = await Promise.all([
      c1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
      c2.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
    ])
    for (const r of resultados) expect(r.error).toBeNull()

    const { data } = await admin.from('checkins')
      .select('aluno_id, status').eq('sessao_id', sessao.id).neq('status', 'cancelado')
    const confirmados = data!.filter(c => c.status === 'confirmado').map(c => c.aluno_id).sort()
    const espera = data!.filter(c => c.status === 'espera').map(c => c.aluno_id)
    expect(confirmados).toEqual([e1.id, e2.id].sort())
    expect(espera).toEqual([e3.id])
  })
})
