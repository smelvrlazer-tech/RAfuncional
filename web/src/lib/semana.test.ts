// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  diasDaSemana, formatarDataCurta, inicioSemana, intervaloDiaSP, intervaloSemanaSP, rotuloRelativo,
} from './semana'

describe('semana (America/Sao_Paulo, segunda a domingo)', () => {
  it('inicioSemana devolve a segunda-feira da semana do dia', () => {
    expect(inicioSemana('2026-09-26')).toBe('2026-09-21') // sábado
    expect(inicioSemana('2026-09-27')).toBe('2026-09-21') // domingo pertence à semana que começou na segunda
    expect(inicioSemana('2026-09-28')).toBe('2026-09-28') // segunda
    expect(inicioSemana('2027-01-01')).toBe('2026-12-28') // atravessa o ano
  })

  it('diasDaSemana lista os 7 dias a partir da segunda', () => {
    const dias = diasDaSemana('2026-09-24', '2026-09-26')
    expect(dias.map((d) => d.chave)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ])
    expect(dias[0]).toMatchObject({ semanaCurta: 'SEG', numero: '21', hoje: false })
    expect(dias[5]).toMatchObject({ semanaCurta: 'SÁB', hoje: true })
  })

  it('intervalo do dia em SP: [03:00Z do dia, 03:00Z do dia seguinte)', () => {
    const { inicio, fim } = intervaloDiaSP('2026-09-26')
    expect(inicio.toISOString()).toBe('2026-09-26T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-09-27T03:00:00.000Z')
  })

  it('intervalo da semana em SP cobre segunda 00:00 até a segunda seguinte', () => {
    const { inicio, fim } = intervaloSemanaSP('2026-09-23')
    expect(inicio.toISOString()).toBe('2026-09-21T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-09-28T03:00:00.000Z')
  })

  it('rótulo relativo: Ontem / Hoje / Amanhã, senão null', () => {
    expect(rotuloRelativo('2026-09-26', '2026-09-26')).toBe('Hoje')
    expect(rotuloRelativo('2026-09-25', '2026-09-26')).toBe('Ontem')
    expect(rotuloRelativo('2026-09-27', '2026-09-26')).toBe('Amanhã')
    expect(rotuloRelativo('2026-09-29', '2026-09-26')).toBeNull()
  })

  it('data curta DD/MM', () => {
    expect(formatarDataCurta('2026-09-05')).toBe('05/09')
  })
})
