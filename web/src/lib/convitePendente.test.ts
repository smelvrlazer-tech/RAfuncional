import { describe, it, expect, beforeEach } from 'vitest'
import { salvarConvitePendente, lerConvitePendente, limparConvitePendente } from './convitePendente'

describe('convite pendente (sobrevive à confirmação de e-mail)', () => {
  beforeEach(() => localStorage.clear())

  it('salva, lê e limpa', () => {
    salvarConvitePendente({ codigo: 'ABC123ABC123', nome: 'Ana', telefone: null, email: 'ana@x.com' })
    expect(lerConvitePendente()).toEqual({ codigo: 'ABC123ABC123', nome: 'Ana', telefone: null, email: 'ana@x.com' })
    limparConvitePendente()
    expect(lerConvitePendente()).toBeNull()
  })

  it('ignora conteúdo corrompido', () => {
    localStorage.setItem('ra.convitePendente', '{quebrado')
    expect(lerConvitePendente()).toBeNull()
    localStorage.setItem('ra.convitePendente', JSON.stringify({ nome: 'sem código' }))
    expect(lerConvitePendente()).toBeNull()
  })
})
