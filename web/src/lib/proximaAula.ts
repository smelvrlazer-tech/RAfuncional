import { chaveDiaSP, diaDaSemana, formatarHora, SEMANA_CURTA, somarDias } from './datetime'
import type { LinhaAgenda } from './tipos'

/**
 * A aula do aluno que vem primeiro (confirmada ou na fila), entre as que ainda não terminaram.
 * Aula cancelada não conta. Sem nenhuma: null (a agenda não mostra o destaque).
 */
export function proximaAulaMinha(linhas: LinhaAgenda[], agora: Date): LinhaAgenda | null {
  const t = agora.getTime()
  let melhor: LinhaAgenda | null = null
  for (const l of linhas) {
    if (l.cancelada || (l.meu_status !== 'confirmado' && l.meu_status !== 'espera')) continue
    const inicio = new Date(l.inicia_em).getTime()
    if (inicio + l.duracao_min * 60_000 <= t) continue
    if (!melhor || inicio < new Date(melhor.inicia_em).getTime()) melhor = l
  }
  return melhor
}

/** "Agora", "Hoje, 06:00", "Amanhã, 07:00" ou "Qua 14, 18:30" (sempre no fuso de São Paulo). */
export function rotuloQuando(sessao: Pick<LinhaAgenda, 'inicia_em' | 'duracao_min'>, agora: Date): string {
  const inicio = new Date(sessao.inicia_em)
  const fim = inicio.getTime() + sessao.duracao_min * 60_000
  if (inicio.getTime() <= agora.getTime() && agora.getTime() < fim) return 'Agora'
  const hora = formatarHora(inicio)
  const dia = chaveDiaSP(inicio)
  const hoje = chaveDiaSP(agora)
  if (dia === hoje) return `Hoje, ${hora}`
  if (dia === somarDias(hoje, 1)) return `Amanhã, ${hora}`
  const semana = SEMANA_CURTA[diaDaSemana(dia)] ?? ''
  const nomeDia = semana.charAt(0) + semana.slice(1).toLowerCase()
  return `${nomeDia} ${Number(dia.slice(8, 10))}, ${hora}`
}
