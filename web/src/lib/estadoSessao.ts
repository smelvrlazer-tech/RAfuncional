import { formatarPrazo } from './datetime'
import type { LinhaAgenda } from './tipos'

/**
 * Estado visual de uma sessão para o aluno, derivado de uma linha de v_agenda.
 * O front só REFLETE o estado: quem decide é o servidor (RPCs). Por isso
 * qualquer erro de uma RPC é mostrado ao aluno e a agenda é recarregada.
 */
export type Tom = 'disponivel' | 'confirmado' | 'espera' | 'bloqueada' | 'cancelada' | 'lotada' | 'encerrada'
export type Acao = 'checkin' | 'cancelar' | 'entrar_fila' | 'sair_fila'

export interface EstadoSessao {
  tom: Tom
  /** Ação disponível agora, ou null se não há nada a fazer. */
  acao: Acao | null
  /** Texto do chip de status. */
  rotulo: string
  /** Texto do botão da ação. */
  rotuloAcao: string | null
  /** Por que a ação não está disponível (ou aviso complementar). Nunca escondido. */
  motivo: string | null
}

export interface OpcoesEstado {
  agora: Date
  /** perfis.ativo — aluno desativado vê tudo, mas não age. */
  ativo?: boolean
  /** configuracoes.limite_bloqueio_min */
  limiteMin?: number
}

const MSG_INATIVO = 'Sua conta está desativada. Fale com o seu treinador.'

export function estadoSessao(s: LinhaAgenda, opcoes: OpcoesEstado): EstadoSessao {
  const { agora, ativo = true, limiteMin = 60 } = opcoes
  const prazo = formatarPrazo(limiteMin)
  const inicio = new Date(s.inicia_em).getTime()
  const fim = inicio + s.duracao_min * 60_000
  const t = agora.getTime()
  // O servidor decide (bloqueada veio da view no momento da consulta), mas se a
  // tela ficou aberta o prazo pode ter passado desde então: reflete localmente.
  const bloqueada = s.bloqueada || inicio - limiteMin * 60_000 <= t

  const base = ((): EstadoSessao => {
    if (s.cancelada) {
      return { tom: 'cancelada', acao: null, rotulo: 'Aula cancelada', rotuloAcao: null, motivo: s.observacao?.trim() || null }
    }
    if (t >= inicio) {
      const rotulo = t >= fim
        ? (s.meu_status === 'confirmado' ? 'Aula encerrada · você estava confirmado(a)' : 'Aula encerrada')
        : (s.meu_status === 'confirmado' ? 'Aula em andamento · você está confirmado(a)' : 'Aula em andamento')
      return { tom: 'encerrada', acao: null, rotulo, rotuloAcao: null, motivo: null }
    }
    if (s.meu_status === 'confirmado') {
      return bloqueada
        ? { tom: 'confirmado', acao: null, rotulo: 'Confirmado', rotuloAcao: null, motivo: `Cancelamento bloqueado — faltam menos de ${prazo}` }
        : { tom: 'confirmado', acao: 'cancelar', rotulo: 'Confirmado', rotuloAcao: 'Cancelar', motivo: null }
    }
    if (s.meu_status === 'espera') {
      const rotulo = s.minha_posicao ? `Fila de espera · Nº${s.minha_posicao}` : 'Fila de espera'
      return {
        tom: 'espera', acao: 'sair_fila', rotulo, rotuloAcao: 'Sair da fila',
        motivo: bloqueada ? `A fila congelou — faltam menos de ${prazo} para a aula` : null,
      }
    }
    if (bloqueada) {
      return {
        tom: 'bloqueada', acao: null, rotulo: `Bloqueado — faltam menos de ${prazo}`, rotuloAcao: null,
        motivo: `Check-in e cancelamento fecham ${prazo} antes da aula.`,
      }
    }
    if (s.vagas_restantes <= 0) {
      return { tom: 'lotada', acao: 'entrar_fila', rotulo: 'Lotada', rotuloAcao: 'Entrar na lista de espera', motivo: null }
    }
    return { tom: 'disponivel', acao: 'checkin', rotulo: 'Vagas abertas', rotuloAcao: 'Fazer check-in', motivo: null }
  })()

  if (!ativo && base.acao) {
    return { ...base, acao: null, rotuloAcao: null, motivo: MSG_INATIVO }
  }
  return base
}

export function textoVagas(s: LinhaAgenda): string {
  if (s.vagas_restantes <= 0) return s.na_espera > 0 ? `Lotada · ${s.na_espera} na fila` : 'Lotada'
  return s.vagas_restantes === 1 ? '1 vaga livre' : `${s.vagas_restantes} vagas livres`
}

/**
 * Linha de apoio da aula na lista da agenda, curta para caber ao lado do botão:
 * "10 vagas · 50 min", "Lotada · 2 na fila · 60 min", "Em andamento · 60 min", "Encerrada · 60 min".
 * Aula que já começou ou passou diz isso aqui, em vez de um selo inteiro (é a exceção mais fraca).
 */
export function resumoLinha(s: LinhaAgenda, agora: Date): string {
  const duracao = `${s.duracao_min} min`
  if (s.cancelada) return duracao
  const inicio = new Date(s.inicia_em).getTime()
  const t = agora.getTime()
  if (t >= inicio) return `${t < inicio + s.duracao_min * 60_000 ? 'Em andamento' : 'Encerrada'} · ${duracao}`
  if (s.vagas_restantes <= 0) return `${textoVagas(s)} · ${duracao}`
  return `${s.vagas_restantes === 1 ? '1 vaga' : `${s.vagas_restantes} vagas`} · ${duracao}`
}

/** Só nas últimas horas antes de o prazo fechar o tempo restante vira informação útil. */
export const JANELA_PRAZO_MIN = 180

export interface TempoParaFechar {
  /** Minutos até o check-in/cancelamento fechar (arredondado para cima). */
  restanteMin: number
  /** 1 no início da janela, 0 quando fecha: largura da barra. */
  fracao: number
}

/**
 * Tempo até o prazo fechar, ou null fora da janela final (sinaliza a exceção, não o padrão).
 * Depois que fecha, quem avisa é o estado "bloqueada" / o cartão "Check-in encerrado".
 */
export function tempoParaFechar(s: LinhaAgenda, opcoes: { agora: Date; limiteMin?: number }): TempoParaFechar | null {
  const { agora, limiteMin = 60 } = opcoes
  if (s.cancelada || s.bloqueada) return null
  const restanteMs = new Date(s.inicia_em).getTime() - limiteMin * 60_000 - agora.getTime()
  if (restanteMs <= 0 || restanteMs > JANELA_PRAZO_MIN * 60_000) return null
  return { restanteMin: Math.ceil(restanteMs / 60_000), fracao: restanteMs / (JANELA_PRAZO_MIN * 60_000) }
}

/** Primeira aula depois de `atual` com vaga, ainda dentro do prazo e sem o aluno já nela. */
export function proximaComVaga(
  candidatas: LinhaAgenda[],
  atual: LinhaAgenda,
  opcoes: { agora: Date; limiteMin?: number },
): LinhaAgenda | null {
  const { agora, limiteMin = 60 } = opcoes
  const t = agora.getTime()
  const inicioAtual = new Date(atual.inicia_em).getTime()
  return (
    [...candidatas]
      .sort((a, b) => new Date(a.inicia_em).getTime() - new Date(b.inicia_em).getTime())
      .find((c) => {
        const inicio = new Date(c.inicia_em).getTime()
        return (
          c.id !== atual.id && inicio > inicioAtual && !c.cancelada && !c.bloqueada &&
          c.vagas_restantes > 0 && c.meu_status === null && inicio - limiteMin * 60_000 > t
        )
      }) ?? null
  )
}

/** Ocupação 0..1 para a barra de progresso. */
export function fracaoOcupada(s: LinhaAgenda): number {
  if (s.vagas <= 0) return 1
  return Math.min(1, Math.max(0, s.confirmados / s.vagas))
}
