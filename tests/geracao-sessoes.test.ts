import { describe, it, expect, beforeEach } from 'vitest'
import { admin, limparDados, definirConfig } from './helpers/db'

describe('geração de sessões', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('janela_geracao_semanas', '4')
  })

  it('gera uma sessão por semana dentro da janela', async () => {
    await admin.from('turmas').insert({
      nome: 'Funcional Manhã', dia_semana: 1, hora_inicio: '06:00',
      duracao_min: 60, vagas: 10, ativa: true,
    })
    await admin.rpc('gerar_sessoes')

    const { data } = await admin.from('sessoes').select('inicia_em')
    expect(data!.length).toBeGreaterThanOrEqual(4)
    expect(data!.length).toBeLessThanOrEqual(5)
  })

  it('é idempotente: rodar duas vezes não duplica', async () => {
    await admin.from('turmas').insert({
      nome: 'Funcional Tarde', dia_semana: 3, hora_inicio: '18:00',
      duracao_min: 60, vagas: 8, ativa: true,
    })
    await admin.rpc('gerar_sessoes')
    const { count: primeira } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    await admin.rpc('gerar_sessoes')
    const { count: segunda } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    expect(segunda).toBe(primeira)
  })

  it('ignora turmas inativas', async () => {
    await admin.from('turmas').insert({
      nome: 'Turma Desativada', dia_semana: 5, hora_inicio: '07:00',
      duracao_min: 60, vagas: 5, ativa: false,
    })
    await admin.rpc('gerar_sessoes')
    const { count } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('grava o horário no fuso de São Paulo', async () => {
    await admin.from('turmas').insert({
      nome: 'Seis da Manhã', dia_semana: 2, hora_inicio: '06:00',
      duracao_min: 60, vagas: 10, ativa: true,
    })
    await admin.rpc('gerar_sessoes')
    const { data } = await admin.rpc('debug_hora_local')
    expect(data).toContain('06:00')
  })
})
