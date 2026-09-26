/** Regras puras dos treinos (tela Treinos do treinador). */
import { inicioDoDiaSP, somarDias } from './datetime'
import { inicioSemana } from './semana'

const ERRO_URL = 'Use um link completo começando com http:// ou https:// (YouTube, Instagram, Drive…).'

/**
 * O vídeo é renderizado como link para o aluno: só http(s) é aceito
 * (bloqueia javascript:, data:, vbscript: etc.). Vazio = sem vídeo.
 */
export function validarUrlVideo(entrada: string): { valor: string | null; erro: string | null } {
  const texto = entrada.trim()
  if (!texto) return { valor: null, erro: null }
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return { valor: null, erro: ERRO_URL }
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) {
    return { valor: null, erro: ERRO_URL }
  }
  return { valor: texto, erro: null }
}

export interface EntradaTreino { titulo: string; descricao: string; video: string }
export interface DadosTreino { titulo: string; descricao: string; video_url: string | null }
export type ErrosTreino = Partial<Record<'titulo' | 'descricao' | 'video', string>>

export function validarTreino(e: EntradaTreino): { dados: DadosTreino | null; erros: ErrosTreino } {
  const erros: ErrosTreino = {}
  const titulo = e.titulo.trim()
  const descricao = e.descricao.trim()
  if (!titulo) erros.titulo = 'Informe o título do treino.'
  else if (titulo.length > 120) erros.titulo = 'Use no máximo 120 caracteres.'
  if (!descricao) erros.descricao = 'Descreva o treino.'
  const video = validarUrlVideo(e.video)
  if (video.erro) erros.video = video.erro
  if (Object.keys(erros).length) return { dados: null, erros }
  return { dados: { titulo, descricao, video_url: video.valor }, erros }
}

export interface ConfigSpoiler {
  /** configuracoes.spoiler_dia_semana (0=domingo … 6=sábado). */
  diaSemana?: number
  /** configuracoes.spoiler_hora (hora cheia, horário de SP). */
  hora?: number
}

/**
 * Quando o job `publicar_treinos_semana` vai publicar um rascunho da data `data`.
 * O job roda no dia/hora configurados e publica a semana (seg–dom) que começa na
 * primeira segunda estritamente depois. Devolve null se essa execução já passou.
 */
export function publicacaoAutomatica(data: string, agora: Date, config: ConfigSpoiler = {}): Date | null {
  const { diaSemana = 6, hora = 8 } = config
  const segunda = inicioSemana(data)
  const antes = ((1 - diaSemana + 7) % 7) || 7
  const execucao = new Date(inicioDoDiaSP(somarDias(segunda, -antes)).getTime() + hora * 3_600_000)
  return execucao.getTime() > agora.getTime() ? execucao : null
}
