/** Agrupamento dos check-ins do dia para o painel do treinador. */

export type StatusCheckin = 'confirmado' | 'espera' | 'cancelado'

/** Linha de `checkins` com o embed `perfis(nome)` do PostgREST. */
export interface LinhaCheckin {
  sessao_id: string
  aluno_id: string
  status: StatusCheckin
  posicao_fila: number | null
  perfis: { nome: string } | { nome: string }[] | null
}

export interface AlunoNaSessao {
  alunoId: string
  nome: string
  /** Posição na fila (só para quem está em espera). */
  posicao: number | null
}

export interface ListaSessao {
  confirmados: AlunoNaSessao[]
  espera: AlunoNaSessao[]
}

export const LISTA_VAZIA: ListaSessao = { confirmados: [], espera: [] }

function nomeDe(p: LinhaCheckin['perfis']): string {
  const perfil = Array.isArray(p) ? p[0] : p
  return perfil?.nome?.trim() || 'Aluno sem nome'
}

/** Confirmados em ordem alfabética (chamada); fila em ordem FIFO. Cancelados ficam de fora. */
export function agruparCheckins(linhas: LinhaCheckin[]): Map<string, ListaSessao> {
  const grupos = new Map<string, ListaSessao>()
  for (const l of linhas) {
    if (l.status === 'cancelado') continue
    const g = grupos.get(l.sessao_id) ?? { confirmados: [], espera: [] }
    const aluno = { alunoId: l.aluno_id, nome: nomeDe(l.perfis), posicao: l.status === 'espera' ? l.posicao_fila : null }
    ;(l.status === 'confirmado' ? g.confirmados : g.espera).push(aluno)
    grupos.set(l.sessao_id, g)
  }
  for (const g of grupos.values()) {
    g.confirmados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    g.espera.sort((a, b) => (a.posicao ?? Infinity) - (b.posicao ?? Infinity))
  }
  return grupos
}

export interface ResumoDia { aulas: number; canceladas: number; confirmados: number; fila: number; vagas: number }

export function resumoDia(sessoes: { cancelada: boolean; confirmados: number; na_espera: number; vagas: number }[]): ResumoDia {
  const r: ResumoDia = { aulas: 0, canceladas: 0, confirmados: 0, fila: 0, vagas: 0 }
  for (const s of sessoes) {
    if (s.cancelada) { r.canceladas++; continue }
    r.aulas++
    r.confirmados += s.confirmados
    r.fila += s.na_espera
    r.vagas += s.vagas
  }
  return r
}
