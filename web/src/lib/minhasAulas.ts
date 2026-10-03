import { chaveDiaSP } from './datetime'
import type { LinhaAgenda } from './tipos'

export interface GrupoDia {
  /** Dia no horário de São Paulo (AAAA-MM-DD). */
  dia: string
  aulas: LinhaAgenda[]
}

export interface ResumoMinhasAulas {
  grupos: GrupoDia[]
  confirmadas: number
  naFila: number
}

/**
 * Aulas em que a pessoa está confirmada ou na fila de espera, ainda não terminadas e não
 * canceladas, em ordem de horário e agrupadas por dia (fuso de São Paulo).
 */
export function minhasAulas(linhas: LinhaAgenda[], agora: Date): ResumoMinhasAulas {
  const termina = (l: LinhaAgenda) => new Date(l.inicia_em).getTime() + l.duracao_min * 60_000
  const minhas = linhas
    .filter((l) => l.meu_status !== null && !l.cancelada && termina(l) > agora.getTime())
    .sort((a, b) => new Date(a.inicia_em).getTime() - new Date(b.inicia_em).getTime())

  const porDia = new Map<string, LinhaAgenda[]>()
  for (const l of minhas) {
    const dia = chaveDiaSP(l.inicia_em)
    porDia.set(dia, [...(porDia.get(dia) ?? []), l])
  }

  return {
    grupos: [...porDia].map(([dia, aulas]) => ({ dia, aulas })),
    confirmadas: minhas.filter((l) => l.meu_status === 'confirmado').length,
    naFila: minhas.filter((l) => l.meu_status === 'espera').length,
  }
}

/** "2 confirmadas · 1 na fila" / "Nada reservado por enquanto". */
export function textoResumoMinhasAulas({ confirmadas, naFila }: Pick<ResumoMinhasAulas, 'confirmadas' | 'naFila'>): string {
  const partes: string[] = []
  if (confirmadas > 0) partes.push(`${confirmadas} ${confirmadas === 1 ? 'confirmada' : 'confirmadas'}`)
  if (naFila > 0) partes.push(`${naFila} na fila`)
  return partes.length ? partes.join(' · ') : 'Nada reservado por enquanto'
}
