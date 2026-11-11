import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Campo } from './Basicos'

describe('Campo de senha', () => {
  it('o olho mostra e oculta o que foi digitado', async () => {
    render(<MemoryRouter><Campo rotulo="Senha" type="password" defaultValue="segredo123" /></MemoryRouter>)
    const campo = screen.getByLabelText('Senha')
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('campos que não são de senha não ganham o botão', () => {
    render(<MemoryRouter><Campo rotulo="Nome" type="text" /></MemoryRouter>)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
