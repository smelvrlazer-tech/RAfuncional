// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatarHoraTurma, validarTurma } from './turmas'

const base = { nome: 'Funcional Manhã', dia_semana: '1', hora_inicio: '06:00', duracao_min: '60', vagas: '12' }

describe('validarTurma', () => {
  it('aceita e normaliza (hora com segundos, números inteiros)', () => {
    expect(validarTurma(base)).toEqual({
      erros: {},
      dados: { nome: 'Funcional Manhã', dia_semana: 1, hora_inicio: '06:00:00', duracao_min: 60, vagas: 12 },
    })
    expect(validarTurma({ ...base, hora_inicio: '18:30:00' }).dados?.hora_inicio).toBe('18:30:00')
  })

  it.each(['0', '-1', '2.5', 'abc', '', '1000'])('rejeita vagas = %s', (vagas) => {
    const r = validarTurma({ ...base, vagas })
    expect(r.dados).toBeNull()
    expect(r.erros.vagas).toBeTruthy()
  })

  it.each(['6', '24:00', '6:0', '12:60', 'manhã', ''])('rejeita horário %s', (hora_inicio) => {
    expect(validarTurma({ ...base, hora_inicio }).erros.hora_inicio).toMatch(/HH:MM/)
  })

  it('rejeita duração fora de 1..600 e dia inválido e nome vazio', () => {
    const r = validarTurma({ nome: ' ', dia_semana: '7', hora_inicio: '06:00', duracao_min: '0', vagas: '5' })
    expect(Object.keys(r.erros).sort()).toEqual(['dia_semana', 'duracao_min', 'nome'])
  })

  it('formata a hora da turma sem segundos', () => {
    expect(formatarHoraTurma('06:00:00')).toBe('06:00')
    expect(formatarHoraTurma('18:30')).toBe('18:30')
  })
})
