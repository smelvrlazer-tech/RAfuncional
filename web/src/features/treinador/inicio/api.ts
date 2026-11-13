import { intervaloSemanaSP } from '../../../lib/semana'
import { supabase } from '../../../lib/supabase'
import type { AulaTreinador } from '../painel/api'

const COLUNAS = 'id, turma_nome, inicia_em, duracao_min, vagas, cancelada, observacao, confirmados, na_espera, bloqueada, treino_titulo'

/** Aulas da semana (segunda a domingo) que contém `chave`, para o gráfico de ocupação. */
export async function buscarSemana(chave: string): Promise<AulaTreinador[]> {
  const { inicio, fim } = intervaloSemanaSP(chave)
  const { data, error } = await supabase
    .from('v_agenda')
    .select(COLUNAS)
    .gte('inicia_em', inicio.toISOString())
    .lt('inicia_em', fim.toISOString())
    .order('inicia_em', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AulaTreinador[]
}

/** Quantos confirmados já foram marcados "compareceu" nas aulas dadas. */
export async function contarPresencas(sessaoIds: string[]): Promise<number> {
  if (!sessaoIds.length) return 0
  const { count, error } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .in('sessao_id', sessaoIds)
    .eq('status', 'confirmado')
    .eq('presenca', 'compareceu')
  if (error) throw error
  return count ?? 0
}

export interface TreinoDoDia {
  titulo: string
  descricao: string | null
  publicado: boolean
}

export async function buscarTreinoDoDia(chave: string): Promise<TreinoDoDia | null> {
  const { data, error } = await supabase
    .from('treinos')
    .select('titulo, descricao, publicado_em')
    .eq('data', chave)
    .maybeSingle()
  if (error) throw error
  const t = data as { titulo: string; descricao: string | null; publicado_em: string | null } | null
  return t ? { titulo: t.titulo, descricao: t.descricao, publicado: t.publicado_em !== null } : null
}

export interface SemanaEstudio {
  semana_inicio: string
  aulas: number
  vagas: number
  confirmados: number
  compareceu: number
}

export interface AlunoEmAtencao {
  aluno_id: string
  nome: string
  faltas_30d: number
  dias_sem_aula: number | null
  motivo: 'faltas' | 'afastado' | 'faltas_e_afastado'
}

/** Ocupação das últimas semanas (exige a migration 0020; sem ela, lança erro). */
export async function buscarEstudioSemanal(semanas = 8): Promise<SemanaEstudio[]> {
  const { data, error } = await supabase.rpc('treinador_estudio_semanal', { p_semanas: semanas })
  if (error) throw error
  return (data ?? []) as SemanaEstudio[]
}

export async function buscarAlunosAtencao(): Promise<AlunoEmAtencao[]> {
  const { data, error } = await supabase.rpc('treinador_alunos_atencao')
  if (error) throw error
  return (data ?? []) as AlunoEmAtencao[]
}
