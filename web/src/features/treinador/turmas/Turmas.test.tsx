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

  it('edição trava dia e horário', async () => {
    render(<Turmas />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar Funcional Manhã/ }))
    expect(screen.getByLabelText('Dia da semana')).toBeDisabled()
    expect(screen.getByLabelText('Horário de início')).toBeDisabled()
    expect(screen.getByText('Dia e horário não mudam na edição')).toBeInTheDocument()
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
