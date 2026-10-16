import { supabase } from './supabase'

export interface InfoEstudio {
  treinador_nome: string | null
  treinador_foto_url: string | null
}

export interface MeuPainel {
  reservas_mes: number
  compareceu_mes: number
  compareceu_trimestre: number
  meta_trimestre: number
  plano_aulas_semana: number | null
  semanas_seguidas: number
}

export interface UltimoAviso {
  texto: string
  criado_em: string
}

export interface ColegaConfirmado {
  aluno_id: string
  nome: string
  foto_url: string | null
}

export async function buscarEstudio(): Promise<InfoEstudio> {
  const { data, error } = await supabase.rpc('info_estudio')
  if (error) throw error
  const d = (data ?? {}) as Partial<InfoEstudio>
  return { treinador_nome: d.treinador_nome ?? null, treinador_foto_url: d.treinador_foto_url ?? null }
}

export async function buscarMeuPainel(): Promise<MeuPainel> {
  const { data, error } = await supabase.rpc('meu_painel')
  if (error) throw error
  const d = (data ?? {}) as Partial<MeuPainel>
  return {
    reservas_mes: d.reservas_mes ?? 0,
    compareceu_mes: d.compareceu_mes ?? 0,
    compareceu_trimestre: d.compareceu_trimestre ?? 0,
    meta_trimestre: d.meta_trimestre ?? 39,
    plano_aulas_semana: d.plano_aulas_semana ?? null,
    semanas_seguidas: d.semanas_seguidas ?? 0,
  }
}

export async function buscarUltimoAviso(): Promise<UltimoAviso | null> {
  const { data, error } = await supabase.rpc('ultimo_aviso')
  if (error) throw error
  const d = data as Partial<UltimoAviso> | null
  return d?.texto ? { texto: d.texto, criado_em: d.criado_em ?? '' } : null
}

export async function buscarQuemVai(sessaoId: string): Promise<ColegaConfirmado[]> {
  const { data, error } = await supabase.rpc('quem_vai', { p_sessao_id: sessaoId })
  if (error) throw error
  return (Array.isArray(data) ? data : []) as ColegaConfirmado[]
}

export async function enviarAviso(texto: string): Promise<number> {
  const { data, error } = await supabase.rpc('treinador_enviar_aviso', { p_texto: texto })
  if (error) throw error
  return Number((data as { enviados?: number } | null)?.enviados ?? 0)
}

/* ------------------------------------------------------------ nível da meta do trimestre */

export type NivelMeta = 'sem' | 'bronze' | 'prata' | 'ouro'

export interface ResumoMeta {
  nivel: NivelMeta
  /** "Bronze", "Prata", "Ouro" ou "Em construção". */
  rotulo: string
  percentual: number
  /** Treinos que faltam para chegar ao Ouro (a meta inteira). */
  faltamParaOuro: number
}

/** Bronze a partir de 50% da meta, Prata a partir de 75% e Ouro ao cumprir a meta do trimestre. */
export function resumoDaMeta(compareceu: number, meta: number): ResumoMeta {
  const m = Math.max(meta, 1)
  const razao = compareceu / m
  const nivel: NivelMeta = razao >= 1 ? 'ouro' : razao >= 0.75 ? 'prata' : razao >= 0.5 ? 'bronze' : 'sem'
  const rotulos: Record<NivelMeta, string> = { sem: 'Em construção', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro' }
  return {
    nivel,
    rotulo: rotulos[nivel],
    percentual: Math.min(100, Math.round(razao * 100)),
    faltamParaOuro: Math.max(0, m - compareceu),
  }
}

/** Constância do mês: presenças sobre as aulas reservadas que já terminaram (0 se ainda não houve aula). */
export function constanciaDoMes(compareceu: number, reservas: number): number {
  return reservas > 0 ? Math.round((compareceu / reservas) * 100) : 0
}
