import { supabase } from '../../../lib/supabase'
import type { ConfigSpoiler, DadosTreino } from '../../../lib/treinos'
import type { Treino } from '../../../lib/tipos'

const COLUNAS = 'id, data, titulo, descricao, video_url, publicado_em'

/** Treinos entre duas datas (inclusive). O treinador vê rascunhos (política treinos_treinador). */
export async function listarTreinos(inicio: string, fim: string): Promise<Treino[]> {
  const { data, error } = await supabase
    .from('treinos')
    .select(COLUNAS)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as Treino[]
}

/** Cria (um por data: unique(data)) ou atualiza. `publicar` marca publicado_em = agora. */
export async function salvarTreino(
  existente: Treino | null, data: string, dados: DadosTreino, publicar = false,
): Promise<void> {
  const publicacao = publicar ? { publicado_em: new Date().toISOString() } : {}
  const { error } = existente
    ? await supabase.from('treinos').update({ ...dados, ...publicacao }).eq('id', existente.id)
    : await supabase.from('treinos').insert({ data, ...dados, ...publicacao })
  if (error) throw error
}

/** Publicar agora (sem notificar) ou voltar para rascunho (publicado_em = null). */
export async function definirPublicacao(id: string, publicado: boolean): Promise<void> {
  const { error } = await supabase
    .from('treinos')
    .update({ publicado_em: publicado ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

/** Dia/hora do job de publicação (configuracoes). Padrão: sábado 08:00. */
export async function buscarConfigSpoiler(): Promise<Required<ConfigSpoiler>> {
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['spoiler_dia_semana', 'spoiler_hora'])
  const mapa = new Map(((data ?? []) as { chave: string; valor: string }[]).map((l) => [l.chave, Number(l.valor)]))
  const dia = mapa.get('spoiler_dia_semana')
  const hora = mapa.get('spoiler_hora')
  return {
    diaSemana: Number.isInteger(dia) && dia! >= 0 && dia! <= 6 ? dia! : 6,
    hora: Number.isInteger(hora) && hora! >= 0 && hora! <= 23 ? hora! : 8,
  }
}
