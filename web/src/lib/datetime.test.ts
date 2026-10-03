import { describe, it, expect } from 'vitest'
import {
  chaveDiaSP,
  formatarHora,
  formatarIntervalo,
  inicioDoDiaSP,
  proximosDias,
  rotuloDiaLongo,
  semanaSeguinte,
  somarDias,
  formatarDataHoraCurta,
  formatarPrazo,
  formatarPrazoExtenso,
} from './datetime'

describe('datetime (America/Sao_Paulo, independente do fuso do aparelho)', () => {
  it('formata a hora local de São Paulo a partir de um instante UTC', () => {
    // 09:00 UTC = 06:00 em São Paulo (UTC-3)
    expect(formatarHora('2026-08-04T09:00:00Z')).toBe('06:00')
    expect(formatarHora('2026-08-04T21:30:00+00:00')).toBe('18:30')
  })

  it('não usa o fuso do aparelho: 02:00 UTC ainda é o dia anterior em SP', () => {
    expect(chaveDiaSP('2026-08-05T02:00:00Z')).toBe('2026-08-04')
    expect(formatarHora('2026-08-05T02:00:00Z')).toBe('23:00')
  })

  it('formata intervalo com a duração', () => {
    expect(formatarIntervalo('2026-08-04T09:00:00Z', 60)).toBe('06:00 – 07:00')
    expect(formatarIntervalo('2026-08-04T21:30:00Z', 45)).toBe('18:30 – 19:15')
  })

  it('início do dia em SP é 03:00 UTC', () => {
    expect(inicioDoDiaSP('2026-08-04').toISOString()).toBe('2026-08-04T03:00:00.000Z')
  })

  it('soma dias de calendário atravessando mês e ano', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('rótulo longo em português', () => {
    expect(rotuloDiaLongo('2026-08-04')).toBe('Terça-feira, 04 de agosto')
    expect(rotuloDiaLongo('2026-08-02')).toBe('Domingo, 02 de agosto')
  })

  it('lista hoje + 13 dias com chips no estilo SÁB 02', () => {
    // 2026-08-01 12:00 UTC = sábado 09:00 em SP
    const dias = proximosDias(new Date('2026-08-01T12:00:00Z'), 14)
    expect(dias).toHaveLength(14)
    expect(dias[0]).toMatchObject({ chave: '2026-08-01', semanaCurta: 'SÁB', numero: '01', hoje: true })
    expect(dias[1]).toMatchObject({ chave: '2026-08-02', semanaCurta: 'DOM', numero: '02', hoje: false })
    expect(dias[13]!.chave).toBe('2026-08-14')
  })

  it('"hoje" respeita São Paulo mesmo perto da meia-noite UTC', () => {
    // 2026-08-02 01:00 UTC = 2026-08-01 22:00 em SP
    const dias = proximosDias(new Date('2026-08-02T01:00:00Z'), 2)
    expect(dias[0]!.chave).toBe('2026-08-01')
  })

  it('semana seguinte = primeira segunda estritamente depois de hoje até o domingo', () => {
    expect(semanaSeguinte('2026-08-01')).toEqual({ inicio: '2026-08-03', fim: '2026-08-09' }) // sábado
    expect(semanaSeguinte('2026-08-02')).toEqual({ inicio: '2026-08-03', fim: '2026-08-09' }) // domingo
    expect(semanaSeguinte('2026-08-03')).toEqual({ inicio: '2026-08-10', fim: '2026-08-16' }) // segunda
  })

  it('data e hora curtas para notificações', () => {
    expect(formatarDataHoraCurta('2026-08-04T09:05:00Z')).toBe('04/08 · 06:05')
  })

  it('formata o prazo de bloqueio', () => {
    expect(formatarPrazoExtenso(60)).toBe('1 hora')
    expect(formatarPrazoExtenso(120)).toBe('2 horas')
    expect(formatarPrazoExtenso(90)).toBe('1 hora e 30 minutos')
    expect(formatarPrazoExtenso(45)).toBe('45 minutos')
    expect(formatarPrazoExtenso(1)).toBe('1 minuto')
    expect(formatarPrazo(60)).toBe('1h')
    expect(formatarPrazo(120)).toBe('2h')
    expect(formatarPrazo(90)).toBe('1h30')
    expect(formatarPrazo(45)).toBe('45 min')
  })
})
