// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { agruparCheckins, resumoDia, type LinhaCheckin } from './checkins'

const l = (p: Partial<LinhaCheckin>): LinhaCheckin => ({
  sessao_id: 's1', aluno_id: 'a', status: 'confirmado', posicao_fila: null, perfis: { nome: 'Ana' }, ...p,
})

describe('agruparCheckins', () => {
  it('separa confirmados (por nome) e fila (por posição) por sessão, ignora cancelados', () => {
    const grupos = agruparCheckins([
      l({ aluno_id: 'z', perfis: { nome: 'Zeca' } }),
      l({ aluno_id: 'a', perfis: { nome: 'Ângela' } }),
      l({ aluno_id: 'b', perfis: { nome: 'Bruno' } }),
      l({ aluno_id: 'q2', status: 'espera', posicao_fila: 2, perfis: { nome: 'Quinto' } }),
      l({ aluno_id: 'q1', status: 'espera', posicao_fila: 1, perfis: { nome: 'Xavier' } }),
      l({ aluno_id: 'c', status: 'cancelado', perfis: { nome: 'Carla' } }),
      l({ sessao_id: 's2', aluno_id: 'd', perfis: { nome: 'Davi' } }),
    ])
    const s1 = grupos.get('s1')!
    expect(s1.confirmados.map((a) => a.nome)).toEqual(['Ângela', 'Bruno', 'Zeca'])
    expect(s1.espera.map((a) => [a.nome, a.posicao])).toEqual([['Xavier', 1], ['Quinto', 2]])
    expect(grupos.get('s2')!.confirmados).toEqual([{ alunoId: 'd', nome: 'Davi', posicao: null }])
  })

  it('aceita o embed como lista e perfil ausente', () => {
    const grupos = agruparCheckins([
      l({ perfis: [{ nome: 'Lista' }] }),
      l({ aluno_id: 'x', perfis: null }),
    ])
    expect(grupos.get('s1')!.confirmados.map((a) => a.nome)).toEqual(['Aluno sem nome', 'Lista'])
  })

  it('sessão sem check-in não aparece (quem consulta usa o vazio padrão)', () => {
    expect(agruparCheckins([]).size).toBe(0)
  })
})

describe('resumoDia', () => {
  it('soma aulas não canceladas, confirmados, fila e vagas', () => {
    expect(resumoDia([
      { cancelada: false, confirmados: 3, na_espera: 1, vagas: 10 },
      { cancelada: false, confirmados: 8, na_espera: 0, vagas: 8 },
      { cancelada: true, confirmados: 0, na_espera: 0, vagas: 12 },
    ])).toEqual({ aulas: 2, canceladas: 1, confirmados: 11, fila: 1, vagas: 18 })
  })
})
