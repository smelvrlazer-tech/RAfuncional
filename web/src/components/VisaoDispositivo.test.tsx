import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisaoDispositivo } from './VisaoDispositivo'

function simularTela(larga: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: larga, media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

describe('VisaoDispositivo', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks() })

  it('em tela larga mostra o app e o seletor, com Computador marcado', () => {
    simularTela(true)
    render(<VisaoDispositivo><p>conteudo do app</p></VisaoDispositivo>)
    expect(screen.getByText('conteudo do app')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Computador/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Celular/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('em tela estreita (já é celular) não mostra o seletor', () => {
    simularTela(false)
    render(<VisaoDispositivo><p>conteudo do app</p></VisaoDispositivo>)
    expect(screen.getByText('conteudo do app')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Ver o app como' })).not.toBeInTheDocument()
  })

  it('Celular troca o app por um quadro de 390px e lembra a escolha', async () => {
    simularTela(true)
    render(<VisaoDispositivo><p>conteudo do app</p></VisaoDispositivo>)
    await userEvent.click(screen.getByRole('button', { name: /Celular/ }))
    expect(screen.queryByText('conteudo do app')).not.toBeInTheDocument()
    expect(screen.getByTitle('Visualização em celular')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Celular/ })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('ra.visao')).toBe('celular')
  })

  it('já abre no modo celular quando essa foi a última escolha', () => {
    simularTela(true)
    localStorage.setItem('ra.visao', 'celular')
    render(<VisaoDispositivo><p>conteudo do app</p></VisaoDispositivo>)
    expect(screen.getByTitle('Visualização em celular')).toBeInTheDocument()
  })
})
