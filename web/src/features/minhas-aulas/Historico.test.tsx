import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EstadoMock } from '../../test/supabaseMock'
import { Historico } from './Historico'
import { PlanoSemana } from './PlanoSemana'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../lib/supabase', async () => {
  const m = await import('../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

describe('Histórico do aluno', () => {
  beforeEach(() => h.estado.rpc.mockReset())

  it('mostra compareceu, faltou e sem marcação, com o resumo de presenças', async () => {
    h.estado.rpc.mockResolvedValue({
      error: null,
      data: [
        { sessao_id: '1', turma_nome: 'Funcional Noite', inicia_em: '2026-10-14T21:30:00Z', duracao_min: 50, presenca: 'compareceu', marcada: true },
        { sessao_id: '2', turma_nome: 'Funcional Manhã', inicia_em: '2026-10-13T09:00:00Z', duracao_min: 60, presenca: 'faltou', marcada: true },
        { sessao_id: '3', turma_nome: 'Funcional Cedo', inicia_em: '2026-10-12T10:00:00Z', duracao_min: 60, presenca: 'faltou', marcada: false },
      ],
    })
    render(<Historico />)
    expect(await screen.findByText('1 de 3 com presença')).toBeInTheDocument()
    expect(screen.getByText('Compareceu')).toBeInTheDocument()
    expect(screen.getByText('Faltou')).toBeInTheDocument()
    expect(screen.getByText('Sem marcação')).toBeInTheDocument()
    expect(h.estado.rpc).toHaveBeenCalledWith('meu_historico', { p_limite: 60 })
  })

  it('sem aulas encerradas mostra estado vazio', async () => {
    h.estado.rpc.mockResolvedValue({ data: [], error: null })
    render(<Historico />)
    expect(await screen.findByText('Nada por aqui ainda')).toBeInTheDocument()
  })
})

describe('Plano da semana', () => {
  beforeEach(() => h.estado.rpc.mockReset())

  it('mostra o uso e não aparece sem plano', async () => {
    h.estado.rpc.mockResolvedValue({ data: { aulas_semana: 3, usadas_semana: 2 }, error: null })
    const { unmount } = render(<PlanoSemana versao={0} />)
    expect(await screen.findByText('Plano de 3 aulas por semana')).toBeInTheDocument()
    expect(screen.getByText(/de 3 nesta semana/)).toBeInTheDocument()
    unmount()

    h.estado.rpc.mockResolvedValue({ data: { aulas_semana: null, usadas_semana: 1 }, error: null })
    render(<PlanoSemana versao={0} />)
    await Promise.resolve()
    expect(screen.queryByText(/Plano de/)).not.toBeInTheDocument()
  })

  it('avisa, sem bloquear, quando passa do plano', async () => {
    h.estado.rpc.mockResolvedValue({ data: { aulas_semana: 2, usadas_semana: 3 }, error: null })
    render(<PlanoSemana versao={0} />)
    expect(await screen.findByText(/passou do seu plano/)).toBeInTheDocument()
  })
})
