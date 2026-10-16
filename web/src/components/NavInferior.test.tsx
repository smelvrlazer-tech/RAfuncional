import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavInferior } from './NavInferior'

function montar(rota: string) {
  return render(<MemoryRouter initialEntries={[rota]}><NavInferior /></MemoryRouter>)
}

describe('NavInferior', () => {
  it('tem as cinco abas do aluno', () => {
    montar('/')
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda')
    expect(screen.getByRole('link', { name: 'Aulas' })).toHaveAttribute('href', '/minhas-aulas')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('marca só a aba da página atual', () => {
    montar('/minhas-aulas')
    expect(screen.getByRole('link', { name: 'Aulas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current')
  })

  it('a Agenda não fica marcada em outras páginas', () => {
    montar('/perfil')
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
  })
})
