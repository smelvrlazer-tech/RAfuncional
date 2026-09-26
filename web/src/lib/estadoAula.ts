import type { Tom } from './estadoSessao'

export interface DadosAula {
  inicia_em: string
  duracao_min: number
  vagas: number
  confirmados: number
  cancelada: boolean
  bloqueada: boolean
}

export interface EstadoAula {
  tom: Tom
  rotulo: string
  /** A aula já começou (ou terminou): cancelar deixa de fazer sentido. */
  comecou: boolean
  /** Check-in/cancelamento de aluno fechado (fila congelada, sem promoção). */
  fechada: boolean
}

/** Estado de uma aula para o treinador. Sempre exibido com ícone + texto (Chip). */
export function estadoAula(a: DadosAula, agora: Date, limiteMin = 60): EstadoAula {
  const t = agora.getTime()
  const inicio = new Date(a.inicia_em).getTime()
  const fim = inicio + a.duracao_min * 60_000
  const fechada = a.bloqueada || inicio - limiteMin * 60_000 <= t
  const comecou = t >= inicio
  if (a.cancelada) return { tom: 'cancelada', rotulo: 'Cancelada', comecou, fechada }
  if (t >= fim) return { tom: 'encerrada', rotulo: 'Encerrada', comecou, fechada }
  if (comecou) return { tom: 'encerrada', rotulo: 'Em andamento', comecou, fechada }
  if (fechada) return { tom: 'bloqueada', rotulo: 'Check-in fechado', comecou, fechada }
  if (a.confirmados >= a.vagas) return { tom: 'lotada', rotulo: 'Lotada', comecou, fechada }
  return { tom: 'disponivel', rotulo: 'Check-in aberto', comecou, fechada }
}
