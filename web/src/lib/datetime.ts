/**
 * Datas e horas SEMPRE em America/Sao_Paulo (spec 5.5), nunca no fuso do aparelho.
 * "Chave de dia" = data de calendário local de SP no formato AAAA-MM-DD.
 */
export const FUSO = 'America/Sao_Paulo'

export const SEMANA_CURTA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const
const SEMANA_LONGA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
] as const
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const

const formatador = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

interface Partes { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number }

function paraData(valor: Date | string): Date {
  return typeof valor === 'string' ? new Date(valor) : valor
}

/** Relógio de parede de São Paulo para um instante. */
export function partesSP(valor: Date | string): Partes {
  const p: Record<string, string> = {}
  for (const parte of formatador.formatToParts(paraData(valor))) p[parte.type] = parte.value
  return {
    ano: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    hora: Number(p.hour) % 24, minuto: Number(p.minute), segundo: Number(p.second),
  }
}

const dois = (n: number) => String(n).padStart(2, '0')

export function chaveDiaSP(valor: Date | string): string {
  const p = partesSP(valor)
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`
}

export function formatarHora(valor: Date | string): string {
  const p = partesSP(valor)
  return `${dois(p.hora)}:${dois(p.minuto)}`
}

export function formatarIntervalo(inicio: Date | string, duracaoMin: number): string {
  const fim = new Date(paraData(inicio).getTime() + duracaoMin * 60_000)
  return `${formatarHora(inicio)} – ${formatarHora(fim)}`
}

export function formatarDataHoraCurta(valor: Date | string): string {
  const p = partesSP(valor)
  return `${dois(p.dia)}/${dois(p.mes)} · ${dois(p.hora)}:${dois(p.minuto)}`
}

function decompor(chave: string): [number, number, number] {
  const [a, m, d] = chave.split('-').map(Number)
  return [a!, m!, d!]
}

/** Aritmética de calendário pura (sem fuso): soma N dias a uma chave. */
export function somarDias(chave: string, dias: number): string {
  const [a, m, d] = decompor(chave)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return `${dt.getUTCFullYear()}-${dois(dt.getUTCMonth() + 1)}-${dois(dt.getUTCDate())}`
}

export function diaDaSemana(chave: string): number {
  const [a, m, d] = decompor(chave)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

/** Instante (UTC) em que começa o dia `chave` em São Paulo. */
export function inicioDoDiaSP(chave: string): Date {
  const [a, m, d] = decompor(chave)
  const palpite = Date.UTC(a, m - 1, d)
  // Deslocamento do fuso naquele instante (ex.: -3h), calculado pelo Intl.
  const p = partesSP(new Date(palpite))
  const paredeComoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo)
  const deslocamento = paredeComoUtc - palpite
  return new Date(palpite - deslocamento)
}

export function rotuloDiaLongo(chave: string): string {
  const [, m, d] = decompor(chave)
  return `${SEMANA_LONGA[diaDaSemana(chave)]}, ${dois(d)} de ${MESES[m - 1]}`
}

export interface DiaSeletor {
  chave: string
  semanaCurta: string
  numero: string
  hoje: boolean
}

/** Hoje (em SP) + os próximos `quantidade - 1` dias. */
export function proximosDias(agora: Date, quantidade = 14): DiaSeletor[] {
  const hoje = chaveDiaSP(agora)
  return Array.from({ length: quantidade }, (_, i) => {
    const chave = somarDias(hoje, i)
    return {
      chave,
      semanaCurta: SEMANA_CURTA[diaDaSemana(chave)]!,
      numero: chave.slice(8, 10),
      hoje: i === 0,
    }
  })
}

/**
 * Semana do "spoiler" (spec 7.3): primeira segunda-feira estritamente depois de
 * hoje até o domingo seguinte. Mesma regra de publicar_treinos_semana no banco.
 */
export function semanaSeguinte(chaveHoje: string): { inicio: string; fim: string } {
  const dow = diaDaSemana(chaveHoje)
  const inicio = somarDias(chaveHoje, 7 - ((dow + 6) % 7))
  return { inicio, fim: somarDias(inicio, 6) }
}

/** 60 -> "1h", 90 -> "1h30", 45 -> "45 min". */
export function formatarPrazo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h${dois(m)}`
}
