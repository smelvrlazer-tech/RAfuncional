import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EstadoMock } from '../../../test/supabaseMock'
import { Turmas } from './Turmas'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

const TURMA = { id: 't1', nome: 'Funcional Manhã', dia_semana: 1, hora_inicio: '06:00:00', duracao_min: 60, vagas: 12, ativa: true }

describe('Turmas', () => {
  beforeEach(() => {
    h.estado.chamadas.length = 0
    h.estado.rpc.mockClear()
    h.estado.responder = (c) => ({ data: c.tabela === 'turmas' ? [TURMA] : [], error: null, count: 8 })
  })

  it('lista por dia da semana com status em texto', async () => {
    render(<Turmas />)
    const segunda = await screen.findByRole('region', { name: 'Segunda-feira' })
    expect(within(segunda).getByText('Funcional Manhã')).toBeInTheDocument()
    expect(within(segunda).getByText('60 min · 12 vagas')).toBeInTheDocument()
    expect(within(segunda).getByText('Ativa')).toBeInTheDocument()
    expect(screen.getByText(/Sem turmas: Terça-feira/)).toBeInTheDocument()
  })

  it('valida antes de gravar: vagas 0 e horário inválido não chegam ao banco', async () => {
    render(<Turmas />)
    await screen.findByText('Funcional Manhã')
    await userEvent.click(screen.getByRole('button', { name: 'Nova turma' }))
    await userEvent.type(screen.getByLabelText('Nome da turma'), 'Noite')
    await userEvent.type(screen.getByLabelText('Vagas'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Criar turma' }))
    expect(screen.getByText('Informe um número de vagas entre 1 e 500.')).toBeInTheDocument()
    expect(screen.getByText(/formato HH:MM/)).toBeInTheDocument()
    expect(h.estado.chamadas.some((c) => c.args('insert'))).toBe(false)
  })

  it('cria a turma e avisa sobre a próxima geração automática', async () => {
    render(<Turmas />)
    await screen.findByText('Funcional Manhã')
    await userEvent.click(screen.getByRole('button', { name: 'Nova turma' }))
    await userEvent.type(screen.getByLabelText('Nome da turma'), 'Funcional Noite')
    await userEvent.selectOptions(screen.getByLabelText('Dia da semana'), '3')
    await userEvent.type(screen.getByLabelText('Horário de início'), '18:30')
    await userEvent.clear(screen.getByLabelText('Vagas'))
    await userEvent.type(screen.getByLabelText('Vagas'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Criar turma' }))
    expect(await screen.findByText(/aparecem na agenda a partir da próxima geração automática \(diária\)/)).toBeInTheDocument()
    const insert = h.estado.chamadas.find((c) => c.args('insert'))!
    expect(insert.args('insert')![0]).toEqual({
      nome: 'Funcional Noite', dia_semana: 3, hora_inicio: '18:30:00', duracao_min: 60, vagas: 10, ativa: true,
    })
  })

  it('edição libera dia, horário e vagas e grava pela RPC (nunca UPDATE direto em turmas)', async () => {
    h.estado.rpc.mockResolvedValueOnce({
      data: { movidas: 4, atualizadas: 4, removidas: 0, criadas: 0, preservadas: [], canceladas: [] }, error: null,
    })
    render(<Turmas />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar Funcional Manhã/ }))
    const dia = screen.getByLabelText('Dia da semana')
    const hora = screen.getByLabelText('Horário de início')
    expect(dia).toBeEnabled()
    expect(hora).toBeEnabled()
    await userEvent.selectOptions(dia, '3')
    await userEvent.clear(hora)
    await userEvent.type(hora, '07:15')
    await userEvent.clear(screen.getByLabelText('Vagas'))
    await userEvent.type(screen.getByLabelText('Vagas'), '14')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText(/4 aulas sem check-in foram para o novo dia e horário/)).toBeInTheDocument()
    expect(h.estado.rpc).toHaveBeenCalledWith('treinador_atualizar_turma', {
      p_turma_id: 't1', p_nome: 'Funcional Manhã', p_dia_semana: 3, p_hora_inicio: '07:15:00',
      p_duracao_min: 60, p_vagas: 14,
    })
    expect(h.estado.chamadas.some((c) => c.tabela === 'turmas' && c.args('update'))).toBe(false)
    expect(screen.queryByRole('list', { name: /ficaram como estavam/ })).not.toBeInTheDocument()
  })

  it('depois de salvar, lista as aulas com alunos que ficaram como estavam (data e hora de SP) e as canceladas', async () => {
    h.estado.rpc.mockResolvedValueOnce({
      data: {
        movidas: 2, atualizadas: 2, removidas: 0, criadas: 2,
        preservadas: [
          { id: 's1', inicia_em: '2026-10-05T09:00:00+00:00', vagas: 12, confirmados: 2, na_espera: 1 },
          { id: 's2', inicia_em: '2026-10-12T09:00:00+00:00', vagas: 12, confirmados: 0, na_espera: 1 },
        ],
        canceladas: [{ id: 's3', inicia_em: '2026-10-19T09:00:00+00:00' }],
      },
      error: null,
    })
    render(<Turmas />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar Funcional Manhã/ }))
    await userEvent.clear(screen.getByLabelText('Horário de início'))
    await userEvent.type(screen.getByLabelText('Horário de início'), '07:00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText(/Atenção: 2 aulas com alunos ficaram como estavam/)).toBeInTheDocument()
    expect(screen.getByText('2 aulas com alunos ficaram como estavam')).toBeInTheDocument()
    const lista = screen.getByRole('list', { name: 'Aulas com alunos que ficaram como estavam' })
    const itens = within(lista).getAllByRole('listitem').map((li) => li.textContent)
    // 09:00 UTC = 06:00 em São Paulo.
    expect(itens).toEqual([
      'SEG 05/10 · 06:00 · 12 vagas · 2 confirmados, 1 na espera',
      'SEG 12/10 · 06:00 · 12 vagas · 1 na espera',
    ])
    const canceladas = screen.getByRole('list', { name: 'Aulas canceladas' })
    expect(within(canceladas).getByText('SEG 19/10 · 06:00')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('list', { name: 'Aulas com alunos que ficaram como estavam' })).not.toBeInTheDocument()
  })

  it('com a RPC ainda não aplicada no banco, mostra erro amigável, mantém o formulário e não grava nada', async () => {
    h.estado.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.treinador_atualizar_turma(p_dia_semana, p_duracao_min, p_hora_inicio, p_nome, p_turma_id, p_vagas) in the schema cache',
      },
    })
    render(<Turmas />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar Funcional Manhã/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ainda não está disponível no servidor/)
    expect(screen.queryByText(/schema cache/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()
    expect(h.estado.chamadas.some((c) => c.tabela === 'turmas' && c.args('update'))).toBe(false)
  })

  it('desativar confirma, conta as aulas já geradas e só faz UPDATE (nunca DELETE)', async () => {
    render(<Turmas />)
    await userEvent.click(await screen.findByRole('button', { name: /Desativar Funcional Manhã/ }))
    const dialogo = screen.getByRole('dialog', { name: 'Desativar Funcional Manhã?' })
    expect(await within(dialogo).findByText(/As 8 aulas futuras já geradas continuam na agenda/)).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desativar turma' }))
    expect(await screen.findByText(/Funcional Manhã desativada/)).toBeInTheDocument()
    const update = h.estado.chamadas.find((c) => c.tabela === 'turmas' && c.args('update'))!
    expect(update.args('update')).toEqual([{ ativa: false }])
    expect(update.args('eq')).toEqual(['id', 't1'])
    expect(h.estado.chamadas.some((c) => c.args('delete'))).toBe(false)
  })
})
