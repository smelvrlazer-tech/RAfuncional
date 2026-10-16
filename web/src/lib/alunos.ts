import type { Perfil } from './tipos'

export type FiltroAlunos = 'todos' | 'ativos' | 'inativos'

/** Minúsculas e sem acento: "Ágata" acha "agata". */
function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

/** Busca por nome (sem acento, sem diferença de maiúscula) ou por dígitos do telefone. */
export function filtrarAlunos(lista: Perfil[], busca: string, filtro: FiltroAlunos): Perfil[] {
  const termo = normalizar(busca)
  const digitos = busca.replace(/\D/g, '')
  return lista.filter((a) => {
    if (filtro === 'ativos' && !a.ativo) return false
    if (filtro === 'inativos' && a.ativo) return false
    if (!termo) return true
    if (normalizar(a.nome).includes(termo)) return true
    return digitos.length >= 3 && (a.telefone ?? '').replace(/\D/g, '').includes(digitos)
  })
}

/** Quantas linhas (aulas) cada aluno tem: a consulta já traz só presenças confirmadas do período. */
export function contarPorAluno(linhas: { aluno_id: string }[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const l of linhas) mapa.set(l.aluno_id, (mapa.get(l.aluno_id) ?? 0) + 1)
  return mapa
}
