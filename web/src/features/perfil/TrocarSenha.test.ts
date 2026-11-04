import { describe, expect, it } from 'vitest'
import { mensagemSenhaProvisoria } from '../treinador/alunos/NovaSenhaAluno'
import { validarNovaSenha } from './TrocarSenha'

describe('validarNovaSenha', () => {
  it('exige 8 caracteres e confirmação igual', () => {
    expect(validarNovaSenha('curta', 'curta')).toMatch(/pelo menos 8/)
    expect(validarNovaSenha('senhaboa123', 'outra12345')).toMatch(/não são iguais/)
    expect(validarNovaSenha('senhaboa123', 'senhaboa123')).toBeNull()
  })
})

describe('mensagemSenhaProvisoria', () => {
  it('usa o primeiro nome, a senha e o endereço do app', () => {
    const m = mensagemSenhaProvisoria('Ana Souza', 'Ab3xYz9Kq2', 'https://app.exemplo')
    expect(m).toContain('Oi, Ana!')
    expect(m).toContain('Ab3xYz9Kq2')
    expect(m).toContain('https://app.exemplo')
  })
})
