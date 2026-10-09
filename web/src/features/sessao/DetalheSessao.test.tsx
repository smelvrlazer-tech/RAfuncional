import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DetalheSessao } from './DetalheSessao'
import type { LinhaAgenda } from '../../lib/tipos'

const buscarSessao = vi.fn()
const buscarAgenda = vi.fn()
vi.mock('../agenda/api', () => ({
  buscarSessao: (...a: unknown[]) => buscarSessao(...a),
  buscarAgenda: (...a: unknown[]) => buscarAgenda(...a),
  buscarLimiteBloqueio: () => Promise.resolve(60),
  executarAcao: vi.fn(),
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ perfil: { ativo: true } }) }))

const AGORA = new Date('2026-08-04T08:00:00Z') // 05:00 em SP

function linha(p: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    id: 's1', turma_id: 't1', turma_nome: 'Funcional Manhã', inicia_em: '2026-08-04T11:00:00Z',
    duracao_min: 60, vagas: 10, cancelada: false, observacao: null, confirmados: 3, vagas_restantes: 7,
    na_espera: 0, bloqueada: false, meu_status: null, minha_posicao: null,
    treino_titulo: null, treino_descricao: null, treino_video_url: null, ...p,
  }
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/sessao/s1']}>
      <Routes><Route path="/sessao/:id" element={<DetalheSessao />} /></Routes>
    </MemoryRouter>,
  )
}

describe('DetalheSessao', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(AGORA)
    buscarSessao.mockReset()
    buscarAgenda.mockReset().mockResolvedValue([])
  })
  afterEach(() => vi.useRealTimers())

  describe('relógio do prazo', () => {
    it('nas últimas horas mostra quanto falta e a barra', async () => {
      buscarSessao.mockResolvedValue(linha()) // fecha às 10:00Z: faltam 2h
      montar()
      expect(await screen.findByText(/Check-in fecha em/)).toHaveTextContent('Check-in fecha em 2h')
    })

    it('confirmado: fala em cancelamento', async () => {
      buscarSessao.mockResolvedValue(linha({ meu_status: 'confirmado' }))
      montar()
      expect(await screen.findByText(/Cancelamento fecha em/)).toBeInTheDocument()
    })

    it('longe do prazo não mostra nada', async () => {
      buscarSessao.mockResolvedValue(linha({ inicia_em: '2026-08-04T20:00:00Z' }))
      montar()
      await screen.findByRole('button', { name: 'Fazer check-in' })
      expect(screen.queryByText(/fecha em/)).not.toBeInTheDocument()
    })

    it('com o prazo vencido só aparece o cartão Check-in encerrado', async () => {
      buscarSessao.mockResolvedValue(linha({ inicia_em: '2026-08-04T08:30:00Z', bloqueada: true }))
      montar()
      expect(await screen.findByText('Check-in encerrado')).toBeInTheDocument()
      expect(screen.queryByText(/fecha em/)).not.toBeInTheDocument()
    })
  })

  describe('próxima aula com vaga', () => {
    const lotada = () => linha({ vagas_restantes: 0, confirmados: 10 })

    it('aula lotada: sugere a próxima com vaga', async () => {
      buscarSessao.mockResolvedValue(lotada())
      buscarAgenda.mockResolvedValue([
        lotada(),
        linha({ id: 's2', turma_nome: 'Funcional Noite', inicia_em: '2026-08-04T21:30:00Z', vagas_restantes: 4 }),
      ])
      montar()
      const link = await screen.findByRole('link', { name: /Próxima aula com vaga/ })
      expect(link).toHaveAttribute('href', '/sessao/s2')
      expect(link).toHaveTextContent('Funcional Noite · 18:30')
      expect(link).toHaveTextContent('4 vagas livres')
    })

    it('lotada mas sem nenhuma outra com vaga: não sugere', async () => {
      buscarSessao.mockResolvedValue(lotada())
      buscarAgenda.mockResolvedValue([lotada()])
      montar()
      await screen.findByRole('button', { name: 'Entrar na lista de espera' })
      expect(screen.queryByRole('link', { name: /Próxima aula com vaga/ })).not.toBeInTheDocument()
    })

    it('com vaga na própria aula não busca nem sugere', async () => {
      buscarSessao.mockResolvedValue(linha())
      montar()
      await screen.findByRole('button', { name: 'Fazer check-in' })
      expect(buscarAgenda).not.toHaveBeenCalled()
    })

    it('se a busca das próximas falhar, a página segue sem a sugestão', async () => {
      buscarSessao.mockResolvedValue(lotada())
      buscarAgenda.mockRejectedValue(new Error('rede'))
      montar()
      await screen.findByRole('button', { name: 'Entrar na lista de espera' })
      expect(screen.queryByRole('link', { name: /Próxima aula com vaga/ })).not.toBeInTheDocument()
    })
  })
})
