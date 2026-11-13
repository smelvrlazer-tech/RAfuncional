import { supabase } from '../../lib/supabase'

export interface AulaDoHistorico {
  sessao_id: string
  turma_nome: string
  inicia_em: string
  duracao_min: number
  presenca: 'compareceu' | 'faltou'
  /** false = o treinador ainda não marcou; a aula conta como falta até ele marcar. */
  marcada: boolean
}

export interface MeuPlano {
  aulas_semana: number | null
  usadas_semana: number
}

export async function buscarHistorico(): Promise<AulaDoHistorico[]> {
  const { data, error } = await supabase.rpc('meu_historico', { p_limite: 60 })
  if (error) throw error
  return (data ?? []) as AulaDoHistorico[]
}

export async function buscarMeuPlano(): Promise<MeuPlano> {
  const { data, error } = await supabase.rpc('meu_plano')
  if (error) throw error
  const d = (data ?? {}) as Partial<MeuPlano>
  return { aulas_semana: d.aulas_semana ?? null, usadas_semana: d.usadas_semana ?? 0 }
}

export interface SemanaDoAluno {
  semana_inicio: string
  reservas: number
  compareceu: number
  faltas: number
}

/** Últimas semanas do aluno (da mais antiga para a atual). Exige a migration 0020; sem ela, lança erro. */
export async function buscarMinhasSemanas(semanas = 8): Promise<SemanaDoAluno[]> {
  const { data, error } = await supabase.rpc('meu_historico_semanal', { p_semanas: semanas })
  if (error) throw error
  return (data ?? []) as SemanaDoAluno[]
}
