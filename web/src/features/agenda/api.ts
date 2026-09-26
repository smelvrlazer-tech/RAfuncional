import { supabase } from '../../lib/supabase'
import type { Acao } from '../../lib/estadoSessao'
import type { LinhaAgenda } from '../../lib/tipos'

const COLUNAS =
  'id, turma_id, turma_nome, inicia_em, duracao_min, vagas, cancelada, observacao, confirmados, ' +
  'vagas_restantes, na_espera, bloqueada, meu_status, minha_posicao, treino_titulo, treino_descricao, treino_video_url'

export async function buscarAgenda(inicio: Date, fim: Date): Promise<LinhaAgenda[]> {
  const { data, error } = await supabase
    .from('v_agenda')
    .select(COLUNAS)
    .gte('inicia_em', inicio.toISOString())
    .lt('inicia_em', fim.toISOString())
    .order('inicia_em', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as LinhaAgenda[]
}

export async function buscarSessao(id: string): Promise<LinhaAgenda | null> {
  const { data, error } = await supabase.from('v_agenda').select(COLUNAS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as LinhaAgenda | null) ?? null
}

let limiteEmCache: number | null = null

/** configuracoes.limite_bloqueio_min (o aluno pode ler essa chave). Padrão 60. */
export async function buscarLimiteBloqueio(): Promise<number> {
  if (limiteEmCache !== null) return limiteEmCache
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'limite_bloqueio_min').maybeSingle()
  const n = Number((data as { valor?: string } | null)?.valor)
  limiteEmCache = Number.isFinite(n) && n > 0 ? n : 60
  return limiteEmCache
}

export interface ResultadoAcao {
  status?: 'confirmado' | 'espera'
  posicao_fila?: number | null
}

/** Toda mutação passa pelas RPCs, que validam 1h, vagas e fila no servidor. */
export async function executarAcao(acao: Acao, sessaoId: string): Promise<ResultadoAcao> {
  const rpc = acao === 'checkin' || acao === 'entrar_fila' ? 'fazer_checkin' : 'cancelar_checkin'
  const { data, error } = await supabase.rpc(rpc, { p_sessao_id: sessaoId })
  if (error) throw error
  return (data ?? {}) as ResultadoAcao
}
