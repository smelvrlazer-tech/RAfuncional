import { agruparCheckins, type LinhaCheckin, type ListaSessao, type Presenca } from '../../../lib/checkins'
import { intervaloDiaSP } from '../../../lib/semana'
import { supabase } from '../../../lib/supabase'

/** Colunas de v_agenda que interessam ao treinador (meu_status é sempre nulo para ele). */
export interface AulaTreinador {
  id: string
  turma_nome: string
  inicia_em: string
  duracao_min: number
  vagas: number
  cancelada: boolean
  observacao: string | null
  confirmados: number
  na_espera: number
  bloqueada: boolean
  treino_titulo: string | null
}

const COLUNAS = 'id, turma_nome, inicia_em, duracao_min, vagas, cancelada, observacao, confirmados, na_espera, bloqueada, treino_titulo'

/** Consulta 1: as aulas do dia (em SP), em ordem de horário. */
export async function buscarAulasDoDia(chave: string): Promise<AulaTreinador[]> {
  const { inicio, fim } = intervaloDiaSP(chave)
  const { data, error } = await supabase
    .from('v_agenda')
    .select(COLUNAS)
    .gte('inicia_em', inicio.toISOString())
    .lt('inicia_em', fim.toISOString())
    .order('inicia_em', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AulaTreinador[]
}

export async function buscarAula(id: string): Promise<AulaTreinador | null> {
  const { data, error } = await supabase.from('v_agenda').select(COLUNAS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as AulaTreinador | null) ?? null
}

/**
 * Consulta 2: todos os check-ins ativos das aulas, já com o nome do aluno
 * (embed perfis via checkins.aluno_id; o RLS deixa o treinador ler tudo).
 */
export async function buscarListas(sessaoIds: string[]): Promise<Map<string, ListaSessao>> {
  if (!sessaoIds.length) return new Map()
  const { data, error } = await supabase
    .from('checkins')
    .select('sessao_id, aluno_id, status, posicao_fila, presenca, perfis(nome, foto_url)')
    .in('sessao_id', sessaoIds)
    .in('status', ['confirmado', 'espera'])
  if (error) throw error
  return agruparCheckins((data ?? []) as unknown as LinhaCheckin[])
}

/** Exceção administrativa: notifica o aluno e promove o 1º da fila (se a aula não estiver bloqueada). */
export async function removerAluno(sessaoId: string, alunoId: string): Promise<void> {
  const { error } = await supabase.rpc('treinador_remover_aluno', { p_sessao_id: sessaoId, p_aluno_id: alunoId })
  if (error) throw error
}

/** Marca (ou limpa, com null) a presença de um confirmado em aula que já começou. */
export async function marcarPresenca(sessaoId: string, alunoId: string, presenca: Presenca | null): Promise<void> {
  const { error } = await supabase.rpc('treinador_marcar_presenca', { p_sessao_id: sessaoId, p_aluno_id: alunoId, p_presenca: presenca })
  if (error) throw error
}

/** Cancela a aula e notifica confirmados e fila. Devolve quantos foram avisados. */
export async function cancelarAula(sessaoId: string, observacao: string): Promise<number> {
  const { data, error } = await supabase.rpc('treinador_cancelar_sessao', {
    p_sessao_id: sessaoId,
    p_observacao: observacao,
  })
  if (error) throw error
  return Number((data as { avisados?: number } | null)?.avisados ?? 0)
}
