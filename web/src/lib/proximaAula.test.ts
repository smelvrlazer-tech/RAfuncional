import { describe, it, expect } from 'vitest'
import { proximaAulaMinha, rotuloQuando } from './proximaAula'
import type { LinhaAgenda } from './tipos'

// Quinta-feira, 15/10/2026, 10:00 em São Paulo (13:00 UTC).
const AGORA = new Date('2026-10-15T13:00:00Z')

function linha(id: string, inicia_em: string, p: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    id, turma_id: 't', turma_nome: `Aula ${id}`, inicia_em, duracao_min: 60, vagas: 10, cancelada: false,
    observacao: null, confirmados: 3, vagas_restantes: 7, na_espera: 0, bloqueada: false,
    meu_status: 'confirmado', minha_posicao: null, treino_titulo: null, treino_descricao: null, treino_video_url: null, ...p,
  }
}

describe('proximaAulaMinha', () => {
  it('pega a primeira aula minha que ainda não terminou, mesmo fora de ordem', () => {
    const r = proximaAulaMinha([
      linha('depois', '2026-10-16T09:00:00Z'),
      linha('antes', '2026-10-15T21:30:00Z'),
    ], AGORA)
    expect(r?.id).toBe('antes')
  })

  it('aula em andamento ainda conta; aula que já terminou não', () => {
    expect(proximaAulaMinha([linha('andando', '2026-10-15T12:30:00Z')], AGORA)?.id).toBe('andando')
    expect(proximaAulaMinha([linha('acabou', '2026-10-15T11:00:00Z')], AGORA)).toBeNull()
  })

  it('fila de espera conta; aula sem vínculo ou cancelada não', () => {
    expect(proximaAulaMinha([linha('fila', '2026-10-16T09:00:00Z', { meu_status: 'espera' })], AGORA)?.id).toBe('fila')
    expect(proximaAulaMinha([
      linha('nao-e-minha', '2026-10-15T20:00:00Z', { meu_status: null }),
      linha('cancelada', '2026-10-15T21:00:00Z', { cancelada: true }),
    ], AGORA)).toBeNull()
  })

  it('lista vazia: nada a destacar', () => {
    expect(proximaAulaMinha([], AGORA)).toBeNull()
  })
})

describe('rotuloQuando', () => {
  it('hoje, amanhã e outros dias no fuso de São Paulo', () => {
    expect(rotuloQuando(linha('a', '2026-10-15T21:30:00Z'), AGORA)).toBe('Hoje, 18:30')
    expect(rotuloQuando(linha('a', '2026-10-16T09:00:00Z'), AGORA)).toBe('Amanhã, 06:00')
    expect(rotuloQuando(linha('a', '2026-10-17T10:00:00Z'), AGORA)).toBe('Sáb 17, 07:00')
    expect(rotuloQuando(linha('a', '2026-10-19T09:00:00Z'), AGORA)).toBe('Seg 19, 06:00')
  })

  it('aula das 22h de São Paulo é "hoje", mesmo já sendo amanhã em UTC', () => {
    expect(rotuloQuando(linha('a', '2026-10-16T01:00:00Z'), AGORA)).toBe('Hoje, 22:00')
  })

  it('durante a aula: "Agora"', () => {
    expect(rotuloQuando(linha('a', '2026-10-15T12:30:00Z'), AGORA)).toBe('Agora')
  })
})
