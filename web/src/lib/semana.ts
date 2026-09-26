/**
 * Dias e semanas do painel do treinador. Semana = segunda a domingo (mesma regra
 * de publicar_treinos_semana). Chaves AAAA-MM-DD sempre no calendário de São Paulo.
 */
import { SEMANA_CURTA, diaDaSemana, inicioDoDiaSP, somarDias, type DiaSeletor } from './datetime'

/** Segunda-feira da semana que contém `chave`. */
export function inicioSemana(chave: string): string {
  return somarDias(chave, -((diaDaSemana(chave) + 6) % 7))
}

/** Os 7 dias (segunda..domingo) da semana que contém `chave`. */
export function diasDaSemana(chave: string, hoje: string): DiaSeletor[] {
  const segunda = inicioSemana(chave)
  return Array.from({ length: 7 }, (_, i) => {
    const c = somarDias(segunda, i)
    return { chave: c, semanaCurta: SEMANA_CURTA[diaDaSemana(c)]!, numero: c.slice(8, 10), hoje: c === hoje }
  })
}

/** [início, fim) do dia em SP, como instantes, para filtrar `inicia_em`. */
export function intervaloDiaSP(chave: string): { inicio: Date; fim: Date } {
  return { inicio: inicioDoDiaSP(chave), fim: inicioDoDiaSP(somarDias(chave, 1)) }
}

/** [segunda 00:00, segunda seguinte 00:00) em SP. */
export function intervaloSemanaSP(chave: string): { inicio: Date; fim: Date } {
  const segunda = inicioSemana(chave)
  return { inicio: inicioDoDiaSP(segunda), fim: inicioDoDiaSP(somarDias(segunda, 7)) }
}

export function rotuloRelativo(chave: string, hoje: string): 'Ontem' | 'Hoje' | 'Amanhã' | null {
  if (chave === hoje) return 'Hoje'
  if (chave === somarDias(hoje, -1)) return 'Ontem'
  if (chave === somarDias(hoje, 1)) return 'Amanhã'
  return null
}

export function formatarDataCurta(chave: string): string {
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}`
}
