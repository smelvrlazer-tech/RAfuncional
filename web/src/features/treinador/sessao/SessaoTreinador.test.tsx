import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EstadoMock } from '../../../test/supabaseMock'
import { SessaoTreinador } from './SessaoTreinador'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

// Aula daqui a muitos anos: check-in aberto, fila promove.
const AULA = {
  id: 's1', turma_nome: 'Funcional Cedo', inicia_em: '2030-09-26T10:00:00Z', duracao_min: 60, vagas: 1,
  cancelada: false, observacao: null, confirmados: 1, na_espera: 1, bloqueada: false, treino_titulo: null,
}
let checkins: unknown[]

function montar() {
  render(
    <MemoryRouter initialEntries={['/treinador/sessao/s1']}>
      <Routes><Route path="/treinador/sessao/:id" element={<SessaoTreinador />} /></Routes>
    </MemoryRouter>,
  )
}

describe('SessaoTreinador', () => {
  beforeEach(() => {
    checkins = [
      { sessao_id: 's1', aluno_id: 'b', status: 'confirmado', posicao_fila: null, perfis: { nome: 'Bruno Lima' } },
      { sessao_id: 's1', aluno_id: 'c', status: 'espera', posicao_fila: 1, perfis: { nome: 'Carla Dias' } },
    ]
    h.estado.responder = (c) => ({ data: c.tabela === 'v_agenda' ? AULA : checkins, error: null })
    h.estado.rpc.mockReset()
  })

  it('remover confirmado: explica notificação e promoção, chama a RPC e anuncia quem subiu', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Bruno Lima' }))
    const dialogo = screen.getByRole('dialog', { name: 'Remover Bruno Lima?' })
    expect(dialogo).toHaveAccessibleDescription(/recebe uma notificação.*passa automaticamente para Carla Dias/)
    h.estado.rpc.mockImplementation(async () => {
      checkins = [{ sessao_id: 's1', aluno_id: 'c', status: 'confirmado', posicao_fila: null, perfis: { nome: 'Carla Dias' } }]
      return { data: { removido: true }, error: null }
    })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Sim, remover' }))
    expect(h.estado.rpc).toHaveBeenCalledWith('treinador_remover_aluno', { p_sessao_id: 's1', p_aluno_id: 'b' })
    expect(await screen.findByText(/Bruno Lima foi removido\(a\) e notificado\(a\)\. Carla Dias saiu da fila/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('erro da RPC aparece no diálogo com texto do treinador', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Carla Dias' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/sai da lista de espera/)
    h.estado.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'checkin_inexistente' } })
    await userEvent.click(screen.getByRole('button', { name: 'Sim, remover' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(/já não está nessa aula/)
  })

  it('cancelar a aula exige motivo e informa quantas pessoas serão avisadas', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar esta aula' }))
    const dialogo = screen.getByRole('dialog', { name: 'Cancelar esta aula?' })
    expect(dialogo).toHaveAccessibleDescription(/2 pessoas serão avisadas \(1 confirmado e 1 na fila\)/)
    const confirmar = within(dialogo).getByRole('button', { name: 'Cancelar a aula' })
    expect(confirmar).toBeDisabled()
    expect(within(dialogo).getByLabelText('Motivo (obrigatório)')).toHaveFocus()
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obrigatório)'), 'Chuva forte')
    h.estado.rpc.mockResolvedValue({ data: { cancelada: true, avisados: 2 }, error: null })
    await userEvent.click(confirmar)
    expect(h.estado.rpc).toHaveBeenCalledWith('treinador_cancelar_sessao', { p_sessao_id: 's1', p_observacao: 'Chuva forte' })
    expect(await screen.findByText('Aula cancelada. 2 pessoas avisadas.')).toBeInTheDocument()
  })

  it('aula já cancelada: mostra o motivo e esconde as ações', async () => {
    h.estado.responder = (c) => ({
      data: c.tabela === 'v_agenda' ? { ...AULA, cancelada: true, observacao: 'Feriado' } : checkins, error: null,
    })
    montar()
    expect(await screen.findByText('Esta aula foi cancelada')).toBeInTheDocument()
    expect(screen.getByText('Motivo informado aos alunos: Feriado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remover|Cancelar esta aula/ })).toBeNull()
  })
})
