import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { EstadoMock } from '../../../test/supabaseMock'
import { Treinos } from './Treinos'

const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
vi.mock('../../../lib/supabase', async () => {
  const m = await import('../../../test/supabaseMock')
  h.estado = m.criarEstado()
  return { supabase: m.criarCliente(h.estado) }
})

// Semana distante no futuro: rascunhos ainda terão publicação automática.
const SEMANA = '2030-09-23'
const PUBLICADO = { id: 'p1', data: '2030-09-24', titulo: 'Força', descricao: 'A\n\nB', video_url: null, publicado_em: '2030-09-21T11:00:00Z' }
const RASCUNHO = { id: 'r1', data: '2030-09-25', titulo: 'Core', descricao: 'C', video_url: null, publicado_em: null }

function montar() {
  render(<MemoryRouter initialEntries={[`/treinador/treinos?semana=${SEMANA}`]}><Treinos /></MemoryRouter>)
}

describe('Treinos', () => {
  beforeEach(() => {
    h.estado.chamadas.length = 0
    h.estado.responder = (c) => ({ data: c.tabela === 'treinos' ? [PUBLICADO, RASCUNHO] : [], error: null })
  })

  it('mostra a semana (seg–dom) com status publicado / rascunho / sem treino', async () => {
    montar()
    expect(await screen.findByRole('button', { name: /Terça-feira, 24 de setembro: Força, publicado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quarta-feira, 25 de setembro: Core, rascunho/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Segunda-feira, 23 de setembro: sem treino/ })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    const consulta = h.estado.chamadas.find((c) => c.tabela === 'treinos')!
    expect(consulta.args('gte')).toEqual(['data', '2030-09-23'])
    expect(consulta.args('lte')).toEqual(['data', '2030-09-29'])
  })

  it('rejeita link de vídeo que não é http(s) e não grava', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: /Segunda-feira, 23 de setembro/ }))
    await userEvent.type(screen.getByLabelText('Título'), 'Novo')
    await userEvent.type(screen.getByLabelText('Descrição do treino'), 'Linha 1{enter}Linha 2')
    await userEvent.type(screen.getByLabelText(/Link do vídeo/), 'javascript:alert(1)')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(screen.getByText(/começando com http:\/\/ ou https:\/\//)).toBeInTheDocument()
    expect(h.estado.chamadas.some((c) => c.args('insert'))).toBe(false)
  })

  it('rascunho: explica a publicação automática de sábado e "Publicar agora" grava publicado_em', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: /Quarta-feira, 25 de setembro/ }))
    expect(screen.getByText(/publicados automaticamente em sábado, 21 de setembro, às 08:00/)).toBeInTheDocument()
    expect(screen.getByText(/Publicar agora” \(sem notificação\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Publicar agora' }))
    expect(await screen.findByText(/Treino publicado\. .*não envia notificação/)).toBeInTheDocument()
    const update = h.estado.chamadas.find((c) => c.args('update'))!
    const dados = update.args('update')![0] as Record<string, unknown>
    expect(dados).toMatchObject({ titulo: 'Core', descricao: 'C', video_url: null })
    expect(typeof dados.publicado_em).toBe('string')
    expect(update.args('eq')).toEqual(['id', 'r1'])
  })

  it('publicado: "Voltar para rascunho" pede confirmação e zera publicado_em', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: /Terça-feira, 24 de setembro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para rascunho' }))
    expect(screen.getByRole('dialog', { name: 'Voltar este treino para rascunho?' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Voltar para rascunho' }).at(-1)!)
    expect(await screen.findByText(/Treino voltou para rascunho/)).toBeInTheDocument()
    expect(h.estado.chamadas.find((c) => c.args('update'))!.args('update')).toEqual([{ publicado_em: null }])
  })
})
