import { describe, expect, it } from 'vitest'
import { minhasAulas, textoResumoMinhasAulas } from './minhasAulas'
import type { LinhaAgenda } from './tipos'

function aula(sobrescreve: Partial<LinhaAgenda> & { id: string; inicia_em: string }): LinhaAgenda {
  return {
    turma_id: 't', turma_nome: 'Funcional', duracao_min: 60, vagas: 10, cancelada: false, observacao: null,
    confirmados: 0, vagas_restantes: 10, na_espera: 0, bloqueada: false, meu_status: null, minha_posicao: null,
    treino_titulo: null, treino_descricao: null, treino_video_url: null,
    ...sobrescreve,
  }
}

const AGORA = new Date('2026-10-05T12:00:00Z') // 09:00 em São Paulo

describe('minhasAulas', () => {
  it('guarda só confirmadas e na fila, em ordem de horário', () => {
    const r = minhasAulas([
      aula({ id: 'c', inicia_em: '2026-10-06T21:30:00Z', meu_status: 'confirmado' }),
      aula({ id: 'a', inicia_em: '2026-10-05T21:30:00Z', meu_status: 'espera', minha_posicao: 2 }),
      aula({ id: 'x', inicia_em: '2026-10-05T22:00:00Z', meu_status: null }),
    ], AGORA)
    expect(r.grupos.flatMap((g) => g.aulas.map((l) => l.id))).toEqual(['a', 'c'])
    expect(r.confirmadas).toBe(1)
    expect(r.naFila).toBe(1)
  })

  it('agrupa pelo dia de São Paulo, não pelo dia UTC', () => {
    // 02:00 UTC de terça = 23:00 de segunda em São Paulo
    const r = minhasAulas([
      aula({ id: 'noite', inicia_em: '2026-10-06T02:00:00Z', meu_status: 'confirmado' }),
      aula({ id: 'manha', inicia_em: '2026-10-05T21:00:00Z', meu_status: 'confirmado' }),
    ], AGORA)
    expect(r.grupos.map((g) => g.dia)).toEqual(['2026-10-05'])
    expect(r.grupos[0]!.aulas.map((l) => l.id)).toEqual(['manha', 'noite'])
  })

  it('ignora aula cancelada e aula que já terminou, mas mantém a que está em andamento', () => {
    const r = minhasAulas([
      aula({ id: 'cancelada', inicia_em: '2026-10-06T10:00:00Z', meu_status: 'confirmado', cancelada: true }),
      aula({ id: 'terminou', inicia_em: '2026-10-05T10:00:00Z', meu_status: 'confirmado' }), // 07:00-08:00 SP
      aula({ id: 'andamento', inicia_em: '2026-10-05T11:30:00Z', meu_status: 'confirmado' }), // 08:30-09:30 SP
    ], AGORA)
    expect(r.grupos.flatMap((g) => g.aulas.map((l) => l.id))).toEqual(['andamento'])
  })

  it('sem nada reservado devolve lista vazia', () => {
    expect(minhasAulas([aula({ id: 'a', inicia_em: '2026-10-06T10:00:00Z' })], AGORA))
      .toEqual({ grupos: [], confirmadas: 0, naFila: 0 })
  })
})

describe('textoResumoMinhasAulas', () => {
  it('descreve os totais em português', () => {
    expect(textoResumoMinhasAulas({ confirmadas: 1, naFila: 0 })).toBe('1 confirmada')
    expect(textoResumoMinhasAulas({ confirmadas: 3, naFila: 2 })).toBe('3 confirmadas · 2 na fila')
    expect(textoResumoMinhasAulas({ confirmadas: 0, naFila: 1 })).toBe('1 na fila')
    expect(textoResumoMinhasAulas({ confirmadas: 0, naFila: 0 })).toBe('Nada reservado por enquanto')
  })
})
