import { supabase } from '../../../lib/supabase'
import type { DadosTurma } from '../../../lib/turmas'
import type { Turma } from '../../../lib/tipos'

const COLUNAS = 'id, nome, dia_semana, hora_inicio, duracao_min, vagas, ativa'

export async function listarTurmas(): Promise<Turma[]> {
  const { data, error } = await supabase
    .from('turmas')
    .select(COLUNAS)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true })
  if (error) throw error
  return (data ?? []) as Turma[]
}

/** O RLS (turmas_treinador) deixa o treinador escrever. As sessões são geradas pelo job diário. */
export async function criarTurma(dados: DadosTurma): Promise<void> {
  const { error } = await supabase.from('turmas').insert({ ...dados, ativa: true })
  if (error) throw error
}

/** Na edição, dia e horário não mudam (ver FormTurma): só nome, duração e vagas. */
export async function atualizarTurma(id: string, dados: Pick<DadosTurma, 'nome' | 'duracao_min' | 'vagas'>): Promise<void> {
  const { error } = await supabase.from('turmas').update(dados).eq('id', id)
  if (error) throw error
}

/** Desativar só para de gerar aulas novas. Nunca apagamos turmas (o delete apagaria o histórico em cascata). */
export async function definirTurmaAtiva(id: string, ativa: boolean): Promise<void> {
  const { error } = await supabase.from('turmas').update({ ativa }).eq('id', id)
  if (error) throw error
}

/** Aulas futuras não canceladas já geradas para a turma (continuam na agenda ao desativar). */
export async function contarAulasFuturas(turmaId: string, agora = new Date()): Promise<number> {
  const { count, error } = await supabase
    .from('sessoes')
    .select('id', { count: 'exact', head: true })
    .eq('turma_id', turmaId)
    .eq('cancelada', false)
    .gt('inicia_em', agora.toISOString())
  if (error) throw error
  return count ?? 0
}
