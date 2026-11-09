import { describe, expect, it } from 'vitest'
import { emailDoAcesso } from './acesso'

describe('emailDoAcesso', () => {
  it('e-mail com @ segue como digitado (só tira espaços das pontas)', () => {
    expect(emailDoAcesso('  ana@exemplo.com ')).toBe('ana@exemplo.com')
  })
  it('código de acesso vira o endereço interno em minúsculas', () => {
    expect(emailDoAcesso('Rafael')).toBe('rafael@acesso.ra-funcional.local')
    expect(emailDoAcesso(' RA 2026 ')).toBe('ra2026@acesso.ra-funcional.local')
  })
})
