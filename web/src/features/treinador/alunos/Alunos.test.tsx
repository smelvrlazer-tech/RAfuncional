import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EstadoMock } from '../../../test/supabaseMock'
import { Alunos } from './Alunos'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

const ALUNOS = [
  { id: 'a', nome: 'Ana Souza', telefone: '(11) 98888-1111', papel: 'aluno', ativo: true },
  { id: 'b', nome: 'Bruno Lima', telefone: null, papel: 'aluno', ativo: false },
]
const CONVITES = [
  { id: 'c1', codigo: 'ABCDEF123456', nome_previsto: 'Maria', status: 'pendente', expira_em: '2099-01-01T00:00:00Z', criado_em: '2026-09-20T12:00:00Z', perfis: null },
  { id: 'c2', codigo: '999999AAAAAA', nome_previsto: null, status: 'usado', expira_em: '2026-10-01T00:00:00Z', criado_em: '2026-09-01T12:00:00Z', perfis: { nome: 'Ana Souza' } },
]

describe('Alunos', () => {
  beforeEach(() => {
    h.estado.chamadas.length = 0
    h.estado.rpc.mockReset()
    h.estado.responder = (c) => ({
      data: c.tabela === 'perfis' ? ALUNOS : c.tabela === 'convites' ? (c.args('update') ? [{ id: 'c1' }] : CONVITES) : [],
      error: null,
    })
  })

  it('tabela de alunos com telefone e situação em texto; convites com estado', async () => {
    render(<Alunos />)
    const tabela = await screen.findByRole('table')
    const linhas = within(tabela).getAllByRole('row')
    expect(linhas[1]).toHaveTextContent(/Ana Souza.*\(11\) 98888-1111.*Ativo/)
    expect(linhas[2]).toHaveTextContent(/Bruno Lima.*—.*Inativo/)
    expect(await screen.findByText('Usado por Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(h.estado.chamadas.find((c) => c.tabela === 'perfis')!.args('eq')).toEqual(['papel', 'aluno'])
  })

  it('gera convite: link com a origem do app e WhatsApp com mensagem pronta', async () => {
    h.estado.rpc.mockResolvedValue({ data: { codigo: 'A1B2C3D4E5F6' }, error: null })
    render(<Alunos />)
    await userEvent.type(screen.getByLabelText('Nome do aluno (opcional)'), 'Maria Silva')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link de convite' }))
    expect(h.estado.rpc).toHaveBeenCalledWith('criar_convite', { p_nome: 'Maria Silva' })
    const link = `${window.location.origin}/convite/A1B2C3D4E5F6`
    expect(await screen.findByLabelText('Link do convite')).toHaveValue(link)
    const whats = screen.getByRole('link', { name: /Enviar no WhatsApp/ })
    expect(whats.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=Oi%2C%20Maria!/)
    expect(decodeURIComponent(whats.getAttribute('href')!)).toContain(link)
    expect(whats).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('desativar aluno: confirma avisando que os check-ins futuros não são cancelados e chama a RPC', async () => {
    h.estado.rpc.mockResolvedValue({ data: { id: 'a', ativo: false }, error: null })
    render(<Alunos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Ana Souza' }))
    const dialogo = screen.getByRole('dialog', { name: 'Desativar Ana Souza?' })
    expect(dialogo).toHaveAccessibleDescription(/não são cancelados automaticamente/)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desativar aluno' }))
    expect(h.estado.rpc).toHaveBeenCalledWith('treinador_definir_ativo', { p_perfil_id: 'a', p_ativo: false })
    expect(await screen.findByText('Ana Souza foi desativado(a).')).toBeInTheDocument()
  })

  it('revogar convite: confirma e só atualiza se ainda estiver pendente', async () => {
    render(<Alunos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revogar convite ABCDEF123456' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revogar convite' }))
    expect(await screen.findByText(/Convite ABCDEF123456 revogado/)).toBeInTheDocument()
    const upd = h.estado.chamadas.find((c) => c.tabela === 'convites' && c.args('update'))!
    expect(upd.args('update')).toEqual([{ status: 'revogado' }])
    expect(upd.metodos.filter(([m]) => m === 'eq').map(([, a]) => a)).toEqual([['id', 'c1'], ['status', 'pendente']])
  })
})
