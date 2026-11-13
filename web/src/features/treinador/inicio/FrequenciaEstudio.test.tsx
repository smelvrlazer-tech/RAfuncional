import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { EstadoMock } from '../../../test/supabaseMock'
import { FrequenciaEstudio } from './FrequenciaEstudio'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

const SEMANAS = [
  { semana_inicio: '2026-11-02', aulas: 12, vagas: 120, confirmados: 60, compareceu: 50 },
  { semana_inicio: '2026-11-09', aulas: 6, vagas: 60, confirmados: 45, compareceu: 40 },
]

describe('FrequenciaEstudio', () => {
  beforeEach(() => h.estado.rpc.mockReset())

  it('mostra as barras de ocupação e a lista "Precisa de atenção"', async () => {
    h.estado.rpc.mockImplementation(async (nome) => nome === 'treinador_estudio_semanal'
      ? { data: SEMANAS, error: null }
      : { data: [{ aluno_id: 'a1', nome: 'Bruno Lima', faltas_30d: 3, dias_sem_aula: 20, motivo: 'faltas_e_afastado' }], error: null })
    render(<MemoryRouter><FrequenciaEstudio /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Frequência do estúdio' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Semana de 09\/11: 75% de ocupação, 45 de 60 vagas em 6 aulas \(semana atual\)/ })).toBeInTheDocument()
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.getByText(/3 faltas em 30 dias · sem aula há 20 dias/)).toBeInTheDocument()
  })

  it('some em silêncio se a consulta ainda não existe no banco', async () => {
    h.estado.rpc.mockResolvedValue({ data: null, error: { message: 'function not found', code: '42883' } })
    const { container } = render(<MemoryRouter><FrequenciaEstudio /></MemoryRouter>)
    await new Promise((r) => setTimeout(r, 20))
    expect(container).toBeEmptyDOMElement()
  })
})
