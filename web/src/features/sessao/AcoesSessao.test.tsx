import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AcoesSessao } from './AcoesSessao'
import { estadoSessao } from '../../lib/estadoSessao'
import type { LinhaAgenda } from '../../lib/tipos'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const AGORA = new Date('2026-08-04T08:00:00Z')
function linha(p: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    id: 's1', turma_id: 't1', turma_nome: 'Funcional Manhã', inicia_em: '2026-08-04T12:00:00Z',
    duracao_min: 60, vagas: 10, cancelada: false, observacao: null, confirmados: 3, vagas_restantes: 7,
    na_espera: 0, bloqueada: false, meu_status: null, minha_posicao: null,
    treino_titulo: null, treino_descricao: null, treino_video_url: null, ...p,
  }
}
function montar(p: Partial<LinhaAgenda> = {}, onAtualizar = vi.fn()) {
  const s = linha(p)
  render(<AcoesSessao sessao={s} estado={estadoSessao(s, { agora: AGORA })} limiteMin={60} onAtualizar={onAtualizar} />)
  return onAtualizar
}

describe('AcoesSessao', () => {
  beforeEach(() => rpc.mockReset())

  it('faz check-in pela RPC, anuncia o resultado e recarrega', async () => {
    rpc.mockResolvedValue({ data: { status: 'confirmado', posicao_fila: null }, error: null })
    const onAtualizar = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Fazer check-in' }))
    expect(rpc).toHaveBeenCalledWith('fazer_checkin', { p_sessao_id: 's1' })
    expect(await screen.findByText('Check-in confirmado! Te esperamos às 09:00.')).toBeInTheDocument()
    expect(onAtualizar).toHaveBeenCalled()
  })

  it('corrida: o card dizia disponível mas o servidor bloqueou — mostra o motivo e recarrega', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'sessao_bloqueada' } })
    const onAtualizar = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Fazer check-in' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/faltam menos de 1h/)
    expect(onAtualizar).toHaveBeenCalled()
  })

  it('lotada: entra na fila e informa a posição', async () => {
    rpc.mockResolvedValue({ data: { status: 'espera', posicao_fila: 3 }, error: null })
    montar({ vagas_restantes: 0, confirmados: 10 })
    await userEvent.click(screen.getByRole('button', { name: 'Entrar na lista de espera' }))
    expect(await screen.findByText(/fila de espera \(Nº3\)/)).toBeInTheDocument()
  })

  it('cancelar pede confirmação antes de chamar a RPC', async () => {
    rpc.mockResolvedValue({ data: { cancelado: true }, error: null })
    montar({ meu_status: 'confirmado' })
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(rpc).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
    expect(rpc).toHaveBeenCalledWith('cancelar_checkin', { p_sessao_id: 's1' })
    expect(await screen.findByText('Presença cancelada.')).toBeInTheDocument()
  })

  it('"Manter presença" desiste do cancelamento', async () => {
    montar({ meu_status: 'confirmado' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Manter presença' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('sair da fila não pede confirmação', async () => {
    rpc.mockResolvedValue({ data: { cancelado: true }, error: null })
    montar({ meu_status: 'espera', minha_posicao: 2, vagas_restantes: 0 })
    expect(screen.getByText('Fila de espera · Nº2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da fila' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('cancelar_checkin', { p_sessao_id: 's1' }))
    expect(await screen.findByText('Você saiu da fila de espera.')).toBeInTheDocument()
  })

  it('bloqueada: sem botão e com o motivo visível', () => {
    montar({ bloqueada: true })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Bloqueado — faltam menos de 1h')).toBeInTheDocument()
    expect(screen.getByText('Check-in e cancelamento fecham 1h antes da aula.')).toBeInTheDocument()
  })

  it('cancelada: mostra a observação do treinador', () => {
    montar({ cancelada: true, observacao: 'Chuva forte' })
    expect(screen.getByText('Aula cancelada')).toBeInTheDocument()
    expect(screen.getByText('Chuva forte')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
