import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EstadoMock } from '../../test/supabaseMock'
import { EvolucaoSemanal } from './EvolucaoSemanal'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../lib/supabase', async () => {
  const m = await import('../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

describe('EvolucaoSemanal', () => {
  beforeEach(() => h.estado.rpc.mockReset())

  it('mostra as semanas com presença e o plano como referência', async () => {
    h.estado.rpc.mockImplementation(async (nome) => nome === 'meu_historico_semanal'
      ? { data: [
        { semana_inicio: '2026-11-02', reservas: 3, compareceu: 2, faltas: 1 },
        { semana_inicio: '2026-11-09', reservas: 2, compareceu: 2, faltas: 0 },
      ], error: null }
      : { data: { aulas_semana: 3, usadas_semana: 2 }, error: null })
    render(<EvolucaoSemanal />)
    expect(await screen.findByRole('heading', { name: /Suas últimas 2 semanas/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Semana de 02\/11: 2 aulas com presença de 3 reservadas/ })).toBeInTheDocument()
    expect(await screen.findByText('Seu plano: 3 por semana')).toBeInTheDocument()
  })

  it('não aparece sem dados ou se a consulta falhar', async () => {
    h.estado.rpc.mockResolvedValue({ data: null, error: { message: 'x', code: '42883' } })
    const { container } = render(<EvolucaoSemanal />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container).toBeEmptyDOMElement()
  })
})
