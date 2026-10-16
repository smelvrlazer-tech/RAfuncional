import { describe, it, expect } from 'vitest'
import { contarPorAluno, filtrarAlunos } from './alunos'
import type { Perfil } from './tipos'

const p = (id: string, nome: string, ativo = true, telefone: string | null = null): Perfil =>
  ({ id, nome, telefone, papel: 'aluno', ativo }) as Perfil

const LISTA = [
  p('1', 'Ágata Ribeiro', true, '(11) 98888-1111'),
  p('2', 'Bruno Lima', false),
  p('3', 'Carla Agatha', true, '(21) 97777-2222'),
]

describe('filtrarAlunos', () => {
  it('sem busca e sem filtro: todos', () => {
    expect(filtrarAlunos(LISTA, '', 'todos')).toHaveLength(3)
  })

  it('busca ignora acento e maiúsculas', () => {
    expect(filtrarAlunos(LISTA, 'AGAT', 'todos').map((a) => a.id)).toEqual(['1', '3'])
    expect(filtrarAlunos(LISTA, ' lima ', 'todos').map((a) => a.id)).toEqual(['2'])
  })

  it('busca por telefone usa só os dígitos (3 ou mais)', () => {
    expect(filtrarAlunos(LISTA, '97777', 'todos').map((a) => a.id)).toEqual(['3'])
    expect(filtrarAlunos(LISTA, '(21)', 'todos')).toEqual([])
  })

  it('filtro de situação combina com a busca', () => {
    expect(filtrarAlunos(LISTA, '', 'ativos').map((a) => a.id)).toEqual(['1', '3'])
    expect(filtrarAlunos(LISTA, '', 'inativos').map((a) => a.id)).toEqual(['2'])
    expect(filtrarAlunos(LISTA, 'agat', 'inativos')).toEqual([])
  })
})

describe('contarPorAluno', () => {
  it('conta as aulas de cada aluno', () => {
    const m = contarPorAluno([{ aluno_id: 'a' }, { aluno_id: 'b' }, { aluno_id: 'a' }])
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
    expect(m.get('c')).toBeUndefined()
  })
})
