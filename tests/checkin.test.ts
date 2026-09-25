import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

describe('check-in', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('confirma quando há vaga', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 2)
    const { data, error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data.status).toBe('confirmado')
  })

  it('coloca na espera quando lotada, em ordem FIFO', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const a3 = await criarUsuario('aluno')

    const r1 = await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const r2 = await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const r3 = await a3.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    expect(r1.data.status).toBe('confirmado')
    expect(r2.data.status).toBe('espera')
    expect(r2.data.posicao_fila).toBe(1)
    expect(r3.data.posicao_fila).toBe(2)
  })

  it('permite check-in faltando 61 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(61, 5)
    const { data, error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data.status).toBe('confirmado')
  })

  it('bloqueia check-in faltando 59 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(59, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('bloqueia check-in faltando exatamente 60 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(60, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('recusa aluno desativado', async () => {
    const aluno = await criarUsuario('aluno', { ativo: false })
    const sessao = await criarSessao(120, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('aluno_inativo')
  })

  it('recusa check-in duplicado', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('checkin_ja_existe')
  })

  it('recusa sessão cancelada', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await admin.from('sessoes').update({ cancelada: true }).eq('id', sessao.id)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('sessao_cancelada')
  })

  it('nunca ultrapassa o número de vagas com pedidos simultâneos', async () => {
    const sessao = await criarSessao(120, 2)
    const alunos = await Promise.all([
      criarUsuario('aluno'), criarUsuario('aluno'),
      criarUsuario('aluno'), criarUsuario('aluno'),
    ])
    await Promise.all(alunos.map(a => a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })))

    const { count } = await admin.from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(count).toBe(2)
  })
})
