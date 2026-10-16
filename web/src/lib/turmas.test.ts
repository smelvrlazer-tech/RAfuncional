// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  descreverOcupacao, formatarHoraTurma, gradeSemanal, lerRelatorioTurma, resumoEdicaoTurma, validarTurma,
} from './turmas'

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

describe('relatório da edição (treinador_atualizar_turma)', () => {
  const vazio = lerRelatorioTurma({})

  it('normaliza o jsonb: campos ausentes viram 0 e listas vazias', () => {
    expect(vazio).toEqual({ movidas: 0, atualizadas: 0, removidas: 0, criadas: 0, preservadas: [], canceladas: [] })
    expect(lerRelatorioTurma(null)).toEqual(vazio)
    expect(lerRelatorioTurma({ movidas: 3, preservadas: 'x' }).preservadas).toEqual([])
  })

  it('resume o que mudou, no singular e no plural', () => {
    expect(resumoEdicaoTurma(vazio, 10)).toBe('Turma atualizada. Nome e duração já valem em todas as aulas.')
    expect(resumoEdicaoTurma({ ...vazio, movidas: 1, atualizadas: 1, criadas: 1, removidas: 1 }, 10)).toBe(
      'Turma atualizada. 1 aula sem check-in foi para o novo dia e horário. 1 aula nova criada no novo horário. ' +
      '1 aula sem check-in que não cabia no novo horário foi removida. Nome e duração já valem em todas as aulas.',
    )
    expect(resumoEdicaoTurma({ ...vazio, movidas: 3, atualizadas: 3, criadas: 2 }, 10))
      .toMatch(/3 aulas sem check-in foram para o novo dia e horário\. 2 aulas novas criadas/)
    // Só vagas: atualizadas sem movidas.
    expect(resumoEdicaoTurma({ ...vazio, atualizadas: 4 }, 14)).toMatch(/4 aulas sem check-in passaram a ter 14 vagas\./)
  })

  it('descreve quem segura a aula preservada', () => {
    const a = { id: 's', inicia_em: '2026-10-05T09:00:00Z', vagas: 10 }
    expect(descreverOcupacao({ ...a, confirmados: 2, na_espera: 1 })).toBe('2 confirmados, 1 na espera')
    expect(descreverOcupacao({ ...a, confirmados: 1, na_espera: 0 })).toBe('1 confirmado')
    expect(descreverOcupacao({ ...a, confirmados: 0, na_espera: 3 })).toBe('3 na espera')
  })
})

describe('gradeSemanal', () => {
  const t = (nome: string, dia_semana: number, hora_inicio: string) => ({ nome, dia_semana, hora_inicio })

  it('dias de segunda a domingo com turma, horários em ordem e células por horário e dia', () => {
    const g = gradeSemanal([
      t('Noite', 1, '18:30:00'), t('Manhã', 1, '06:00:00'), t('Manhã', 3, '06:00:00'), t('Domingo', 0, '09:00:00'),
    ])
    expect(g.dias).toEqual([1, 3, 0])
    expect(g.horarios).toEqual(['06:00', '09:00', '18:30'])
    expect(g.celula('06:00', 1).map((x) => x.nome)).toEqual(['Manhã'])
    expect(g.celula('06:00', 0)).toEqual([])
    expect(g.celula('09:00', 0).map((x) => x.nome)).toEqual(['Domingo'])
  })

  it('duas turmas no mesmo horário e dia ficam juntas, em ordem alfabética', () => {
    const g = gradeSemanal([t('Zumba', 2, '07:00'), t('Alongamento', 2, '07:00')])
    expect(g.celula('07:00', 2).map((x) => x.nome)).toEqual(['Alongamento', 'Zumba'])
  })

  it('sem turmas: grade vazia', () => {
    expect(gradeSemanal([])).toMatchObject({ dias: [], horarios: [] })
  })
})
