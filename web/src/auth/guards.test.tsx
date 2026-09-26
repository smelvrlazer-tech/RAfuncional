import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type EstadoAuth } from './AuthContext'
import { ExigeTreinador } from './guards'
import type { Perfil } from '../lib/tipos'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

function montar(perfil: Perfil | null, sessao: Session | null = {} as Session) {
  const valor: EstadoAuth = {
    carregando: false, sessao, perfil, erroPerfil: null, recarregarPerfil: vi.fn(), sair: vi.fn(),
  }
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter initialEntries={['/treinador']}>
        <Routes>
          <Route path="/" element={<p>agenda do aluno</p>} />
          <Route path="/entrar" element={<p>tela de login</p>} />
          <Route path="/treinador" element={<ExigeTreinador><p>painel do treinador</p></ExigeTreinador>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const perfil = (papel: Perfil['papel']): Perfil => ({ id: 'x', nome: 'X', telefone: null, papel, ativo: true })

describe('ExigeTreinador', () => {
  it('treinador entra', () => {
    montar(perfil('treinador'))
    expect(screen.getByText('painel do treinador')).toBeInTheDocument()
  })

  it('aluno volta para a agenda', () => {
    montar(perfil('aluno'))
    expect(screen.getByText('agenda do aluno')).toBeInTheDocument()
  })

  it('sem login vai para /entrar', () => {
    montar(null, null)
    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })
})
