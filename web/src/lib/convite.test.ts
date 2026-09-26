// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoConvite, linkConvite, linkWhatsApp, mensagemConvite } from './convite'

describe('convite', () => {
  it('monta o link a partir da origem, sem barra dupla', () => {
    expect(linkConvite('https://ra.netlify.app', 'ABC123DEF456')).toBe('https://ra.netlify.app/convite/ABC123DEF456')
    expect(linkConvite('https://ra.netlify.app/', 'abc')).toBe('https://ra.netlify.app/convite/ABC')
  })

  it('mensagem em português, com e sem nome', () => {
    const link = 'https://x.app/convite/ABC'
    expect(mensagemConvite(link, 'Maria Silva')).toBe(
      'Oi, Maria! Aqui está o seu convite para o app do RA Funcional, onde você faz check-in nas aulas: ' +
        `${link} — é só abrir o link e criar sua senha.`,
    )
    expect(mensagemConvite(link, '  ')).toMatch(/^Oi! Aqui está o seu convite/)
  })

  it('link do WhatsApp com o texto codificado', () => {
    expect(linkWhatsApp('Oi & tchau? https://x.app/convite/ABC')).toBe(
      'https://wa.me/?text=Oi%20%26%20tchau%3F%20https%3A%2F%2Fx.app%2Fconvite%2FABC',
    )
  })

  it('estado: pendente vencido vira expirado', () => {
    const agora = new Date('2026-09-26T12:00:00Z')
    expect(estadoConvite({ status: 'pendente', expira_em: '2026-10-01T00:00:00Z' }, agora)).toBe('pendente')
    expect(estadoConvite({ status: 'pendente', expira_em: '2026-09-26T11:59:59Z' }, agora)).toBe('expirado')
    expect(estadoConvite({ status: 'usado', expira_em: '2026-09-01T00:00:00Z' }, agora)).toBe('usado')
    expect(estadoConvite({ status: 'revogado', expira_em: '2026-10-01T00:00:00Z' }, agora)).toBe('revogado')
  })
})
