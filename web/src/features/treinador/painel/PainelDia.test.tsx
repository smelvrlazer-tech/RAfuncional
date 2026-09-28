import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { EstadoMock } from '../../../test/supabaseMock'
import { PainelDia } from './PainelDia'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

const AULA = {
  id: 's1', turma_nome: 'Funcional Manhã', inicia_em: '2030-09-26T09:00:00Z', duracao_min: 60, vagas: 12,
  cancelada: false, observacao: null, confirmados: 2, na_espera: 1, bloqueada: false, treino_titulo: 'Força',
}
const CHECKINS = [
  { sessao_id: 's1', aluno_id: 'b', status: 'confirmado', posicao_fila: null, perfis: { nome: 'Bruno Lima' } },
  { sessao_id: 's1', aluno_id: 'a', status: 'confirmado', posicao_fila: null, perfis: { nome: 'Ana Souza' } },
  { sessao_id: 's1', aluno_id: 'c', status: 'espera', posicao_fila: 4, perfis: { nome: 'Carla Dias' } },
]

function montar(dia = '2030-09-26') {
  render(<MemoryRouter initialEntries={[`/treinador?dia=${dia}`]}><PainelDia /></MemoryRouter>)
}

describe('PainelDia', () => {
  beforeEach(() => { h.estado.chamadas.length = 0 })

  it('mostra as aulas do dia com confirmados, fila e posição — em duas consultas', async () => {
    h.estado.responder = (c) => ({
      data: c.tabela === 'v_agenda' ? [AULA] : c.tabela === 'checkins' ? CHECKINS : [],
      error: null,
    })
    montar()
    expect(screen.getByRole('status', { name: 'Carregando as aulas do dia…' })).toBeInTheDocument()
    const cartao = await screen.findByRole('article', { name: 'Funcional Manhã' })
    const c = within(cartao)
    expect(c.getByText('06:00')).toBeInTheDocument()
    expect(c.getByLabelText('2 confirmados de 12 vagas')).toBeInTheDocument()
    expect(c.getByText('Fila: 1')).toBeInTheDocument()
    const [confirmados, fila] = c.getAllByRole('list')
    expect(within(confirmados!).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['ASAna SouzaRA', 'BLBruno LimaRA'])
    expect(within(fila!).getByRole('listitem')).toHaveTextContent('1ºCarla Dias')
    expect(within(fila!).getByLabelText('1º da fila')).toBeInTheDocument()
    expect(c.getByRole('link', { name: 'Funcional Manhã' })).toHaveAttribute('href', '/treinador/sessao/s1')

    const agenda = h.estado.chamadas.find((x) => x.tabela === 'v_agenda')!
    expect(agenda.args('gte')).toEqual(['inicia_em', '2030-09-26T03:00:00.000Z'])
    expect(agenda.args('lt')).toEqual(['inicia_em', '2030-09-27T03:00:00.000Z'])
    const checkins = h.estado.chamadas.filter((x) => x.tabela === 'checkins')
    expect(checkins).toHaveLength(1)
    expect(checkins[0]!.args('select')![0]).toContain('perfis(nome)')
    expect(checkins[0]!.args('in')).toEqual(['sessao_id', ['s1']])
  })

  it('dia sem aulas: estado vazio e nenhuma consulta de check-ins', async () => {
    h.estado.responder = () => ({ data: [], error: null })
    montar()
    expect(await screen.findByText('Nenhuma aula neste dia')).toBeInTheDocument()
    expect(h.estado.chamadas.some((x) => x.tabela === 'checkins')).toBe(false)
  })

  it('erro: mensagem amigável e "Tentar de novo" recarrega', async () => {
    let falhar = true
    h.estado.responder = (c) => falhar && c.tabela === 'v_agenda'
      ? { data: null, error: { message: 'Failed to fetch' } }
      : { data: c.tabela === 'v_agenda' ? [AULA] : [], error: null }
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/Sem conexão/)
    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('article', { name: 'Funcional Manhã' })).toBeInTheDocument()
  })

  it('navega para o dia seguinte pela seta', async () => {
    h.estado.responder = () => ({ data: [], error: null })
    montar('2030-09-26')
    await screen.findByText('Nenhuma aula neste dia')
    await userEvent.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(await screen.findByRole('heading', { level: 2, name: /27 de setembro/ })).toBeInTheDocument()
  })
})
