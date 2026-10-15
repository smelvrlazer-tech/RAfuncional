import { describe, it, expect } from 'vitest'
import { frequenciaDoMes, inicioDoMes, semanasDoMes } from './frequencia'
import type { LinhaAgenda } from './tipos'

// Quinta, 15/10/2026, 10:00 em São Paulo.
const AGORA = new Date('2026-10-15T13:00:00Z')

function linha(inicia_em: string, p: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    id: inicia_em, turma_id: 't', turma_nome: 'Aula', inicia_em, duracao_min: 60, vagas: 10, cancelada: false,
    observacao: null, confirmados: 3, vagas_restantes: 7, na_espera: 0, bloqueada: false,
    meu_status: 'confirmado', minha_posicao: null, treino_titulo: null, treino_descricao: null, treino_video_url: null, ...p,
  }
}

describe('frequenciaDoMes', () => {
  it('conta só aulas do mês, confirmadas, não canceladas e já terminadas', () => {
    const f = frequenciaDoMes([
      linha('2026-10-01T09:00:00Z'),
      linha('2026-10-12T09:00:00Z'),
      linha('2026-10-12T21:30:00Z'), // mesmo dia: conta 2 aulas, 1 dia
      linha('2026-10-13T09:00:00Z', { meu_status: 'espera' }),
      linha('2026-10-14T09:00:00Z', { cancelada: true }),
      linha('2026-10-15T12:30:00Z'), // em andamento: ainda não conta
      linha('2026-10-16T09:00:00Z'), // futura
      linha('2026-09-30T09:00:00Z'), // mês anterior
    ], AGORA)
    expect(f.mes).toBe('outubro')
    expect(f.total).toBe(3)
    expect([...f.dias].sort()).toEqual(['2026-10-01', '2026-10-12'])
  })

  it('aula das 22h do último dia do mês anterior em SP não entra (é setembro no fuso)', () => {
    // 30/09 22:00 em SP = 01/10 01:00 UTC
    expect(frequenciaDoMes([linha('2026-10-01T01:00:00Z')], AGORA).total).toBe(0)
  })

  it('sem aulas: zero', () => {
    expect(frequenciaDoMes([], AGORA)).toMatchObject({ total: 0 })
  })
})

describe('semanasDoMes', () => {
  it('outubro de 2026 começa numa quinta: 3 vazios antes, semanas de segunda a domingo', () => {
    const s = semanasDoMes('2026-10-15')
    expect(s[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(s.every((sem) => sem.length === 7)).toBe(true)
    expect(s.flat().filter(Boolean)).toHaveLength(31)
    expect(s.at(-1)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null])
  })

  it('mês que começa na segunda não tem vazio no começo', () => {
    expect(semanasDoMes('2026-06-10')[0]![0]).toBe('2026-06-01')
  })

  it('inicioDoMes', () => {
    expect(inicioDoMes('2026-10-15')).toBe('2026-10-01')
  })
})
