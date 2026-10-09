import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartaoAvisos } from './CartaoAvisos'
import type { EstadoAvisos } from '../../lib/push'

const ativar = vi.fn()
const desativar = vi.fn()
let hook: { estado: EstadoAvisos; erro: string | null; trabalhando: boolean }
vi.mock('../../avisos', () => ({
  useAvisos: () => ({ ...hook, ativar, desativar }),
}))

function montar(estado: EstadoAvisos, extra: Partial<typeof hook> = {}) {
  hook = { estado, erro: null, trabalhando: false, ...extra }
  return render(<CartaoAvisos />)
}

describe('CartaoAvisos', () => {
  beforeEach(() => {
    ativar.mockReset()
    desativar.mockReset()
  })

  it.each<EstadoAvisos>(['carregando', 'indisponivel'])('%s: não ocupa espaço', (estado) => {
    const { container } = montar(estado)
    expect(container).toBeEmptyDOMElement()
  })

  it('inativo: explica o benefício e oferece ativar', async () => {
    montar('inativo')
    expect(screen.getByRole('heading', { name: 'Avisos no celular' })).toBeInTheDocument()
    expect(screen.getByText(/vaga na lista de espera/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ativar avisos/ }))
    expect(ativar).toHaveBeenCalledTimes(1)
  })

  it('ativo: confirma e deixa desativar discretamente', async () => {
    montar('ativo')
    expect(screen.getByText('Ativados neste aparelho.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ativar avisos/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(desativar).toHaveBeenCalledTimes(1)
  })

  it('bloqueado: explica como liberar, sem botão', () => {
    montar('bloqueado')
    expect(screen.getByText(/bloqueados neste navegador/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('iPhone sem o app instalado: manda instalar primeiro, sem botão', () => {
    montar('instalar-ios')
    expect(screen.getByText(/adicione o app à tela de início/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('mostra o erro como alerta', () => {
    montar('inativo', { erro: 'Não foi possível ativar os avisos neste aparelho. Tente de novo.' })
    expect(screen.getByRole('alert')).toHaveTextContent(/ativar os avisos/)
  })

  it('enquanto trabalha, o botão fica indisponível', () => {
    montar('inativo', { trabalhando: true })
    expect(screen.getByRole('button', { name: /Ativar avisos/ })).toBeDisabled()
  })
})
