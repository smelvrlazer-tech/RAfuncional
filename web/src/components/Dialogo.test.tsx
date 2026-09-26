import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialogo } from './Dialogo'

function Harness({ onConfirmar = vi.fn(), enviando = false }: { onConfirmar?: () => void; enviando?: boolean }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>Abrir</button>
      <Dialogo
        aberto={aberto}
        titulo="Remover aluno?"
        rotuloConfirmar="Sim, remover"
        onConfirmar={onConfirmar}
        onFechar={() => setAberto(false)}
        enviando={enviando}
        perigo
      >
        <p>O aluno recebe uma notificação.</p>
      </Dialogo>
    </>
  )
}

describe('Dialogo', () => {
  it('é um modal acessível: papel, aria-modal, título e descrição', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('dialog', { name: 'Remover aluno?' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveAccessibleDescription('O aluno recebe uma notificação.')
  })

  it('foca a opção segura, prende o Tab dentro e Escape fecha devolvendo o foco', async () => {
    render(<Harness />)
    const abrir = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(abrir)
    const voltar = screen.getByRole('button', { name: 'Voltar' })
    const confirmar = screen.getByRole('button', { name: 'Sim, remover' })
    expect(voltar).toHaveFocus()
    await userEvent.tab()
    expect(confirmar).toHaveFocus()
    await userEvent.tab()
    expect(voltar).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirmar).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
  })

  it('confirma pelo botão e não fecha com Escape enquanto envia', async () => {
    const onConfirmar = vi.fn()
    const { rerender } = render(<Harness onConfirmar={onConfirmar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, remover' }))
    expect(onConfirmar).toHaveBeenCalledOnce()
    rerender(<Harness onConfirmar={onConfirmar} enviando />)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
