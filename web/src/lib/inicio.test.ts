import { describe, expect, it } from 'vitest'
import { constanciaDoMes, resumoDaMeta } from './inicio'

describe('resumoDaMeta', () => {
  it('sem nível até metade da meta; bronze, prata e ouro nos limiares', () => {
    expect(resumoDaMeta(10, 39)).toMatchObject({ nivel: 'sem', rotulo: 'Em construção', percentual: 26, faltamParaOuro: 29 })
    expect(resumoDaMeta(20, 39).nivel).toBe('bronze')
    expect(resumoDaMeta(30, 39).nivel).toBe('prata')
    expect(resumoDaMeta(39, 39)).toMatchObject({ nivel: 'ouro', percentual: 100, faltamParaOuro: 0 })
  })

  it('passar da meta não ultrapassa 100%', () => {
    expect(resumoDaMeta(50, 39).percentual).toBe(100)
  })

  it('meta zero não divide por zero', () => {
    expect(resumoDaMeta(0, 0).percentual).toBe(0)
  })
})

describe('constanciaDoMes', () => {
  it('presenças sobre reservas encerradas, e zero quando ainda não houve aula', () => {
    expect(constanciaDoMes(7, 8)).toBe(88)
    expect(constanciaDoMes(0, 0)).toBe(0)
  })
})
