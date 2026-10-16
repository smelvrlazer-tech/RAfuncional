import { chaveDiaSP, diaDaSemana, somarDias } from './datetime'
import type { LinhaAgenda } from './tipos'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'] as const

export interface FrequenciaMes {
  /** "outubro" */
  mes: string
  /** Aulas feitas no mês até agora (confirmadas, não canceladas e já terminadas). */
  total: number
  /** Dias (AAAA-MM-DD, fuso SP) em que a pessoa fez pelo menos uma aula. */
  dias: Set<string>
}

/** "outubro" para "2026-10-15". */
export function nomeDoMes(chave: string): string {
  return MESES[Number(chave.slice(5, 7)) - 1] ?? ''
}

/** Primeiro dia do mês de `chaveHoje` (AAAA-MM-01). */
export function inicioDoMes(chaveHoje: string): string {
  return `${chaveHoje.slice(0, 7)}-01`
}

export function frequenciaDoMes(linhas: LinhaAgenda[], agora: Date): FrequenciaMes {
  const hoje = chaveDiaSP(agora)
  const prefixo = hoje.slice(0, 7)
  const t = agora.getTime()
  const feitas = linhas.filter((l) => {
    const fim = new Date(l.inicia_em).getTime() + l.duracao_min * 60_000
    return l.meu_status === 'confirmado' && !l.cancelada && fim <= t && chaveDiaSP(l.inicia_em).startsWith(prefixo)
  })
  return {
    mes: nomeDoMes(hoje),
    total: feitas.length,
    dias: new Set(feitas.map((l) => chaveDiaSP(l.inicia_em))),
  }
}

/** Semanas do mês de `chaveHoje`, de segunda a domingo; null preenche antes do dia 1 e depois do último. */
export function semanasDoMes(chaveHoje: string): Array<Array<string | null>> {
  const primeiro = inicioDoMes(chaveHoje)
  const mes = chaveHoje.slice(0, 7)
  const recuo = (diaDaSemana(primeiro) + 6) % 7 // segunda = 0
  const semanas: Array<Array<string | null>> = []
  let atual: Array<string | null> = Array.from({ length: recuo }, () => null)
  for (let d = primeiro; d.startsWith(mes); d = somarDias(d, 1)) {
    atual.push(d)
    if (atual.length === 7) {
      semanas.push(atual)
      atual = []
    }
  }
  if (atual.length) semanas.push([...atual, ...Array.from({ length: 7 - atual.length }, () => null)])
  return semanas
}
