// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoAula } from './estadoAula'

const aula = (p: Partial<Parameters<typeof estadoAula>[0]> = {}) => ({
  inicia_em: '2026-09-26T12:00:00Z', duracao_min: 60, vagas: 10, confirmados: 3, cancelada: false, bloqueada: false, ...p,
})
const em = (iso: string) => new Date(iso)

describe('estadoAula (visão do treinador)', () => {
  it('aberta, lotada, check-in fechado (limite configurável)', () => {
    expect(estadoAula(aula(), em('2026-09-26T10:00:00Z'))).toMatchObject({ tom: 'disponivel', rotulo: 'Check-in aberto', comecou: false })
    expect(estadoAula(aula({ confirmados: 10 }), em('2026-09-26T10:00:00Z')).rotulo).toBe('Lotada')
    expect(estadoAula(aula(), em('2026-09-26T11:00:00Z'))).toMatchObject({ tom: 'bloqueada', rotulo: 'Check-in fechado' })
    expect(estadoAula(aula(), em('2026-09-26T10:30:00Z'), 90).tom).toBe('bloqueada')
    expect(estadoAula(aula({ bloqueada: true }), em('2026-09-26T08:00:00Z')).tom).toBe('bloqueada')
  })

  it('em andamento, encerrada e cancelada', () => {
    expect(estadoAula(aula(), em('2026-09-26T12:30:00Z'))).toMatchObject({ rotulo: 'Em andamento', comecou: true })
    expect(estadoAula(aula(), em('2026-09-26T13:00:00Z'))).toMatchObject({ tom: 'encerrada', rotulo: 'Encerrada', comecou: true })
    expect(estadoAula(aula({ cancelada: true }), em('2026-09-26T13:00:00Z'))).toMatchObject({ tom: 'cancelada', rotulo: 'Cancelada' })
  })
})
