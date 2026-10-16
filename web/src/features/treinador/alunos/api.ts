import { contarPorAluno } from '../../../lib/alunos'
import { supabase } from '../../../lib/supabase'
import type { Convite, Perfil } from '../../../lib/tipos'

export async function listarAlunos(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, telefone, papel, ativo, plano_aulas_semana')
    .eq('papel', 'aluno')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as Perfil[]
}

/** `ativo` não é editável pela API: só pela RPC, que valida o papel. */
export async function definirAlunoAtivo(perfilId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.rpc('treinador_definir_ativo', { p_perfil_id: perfilId, p_ativo: ativo })
  if (error) throw error
}

/** Plano em aulas por semana (1 a 14); null remove o plano. */
export async function definirPlano(perfilId: string, aulas: number | null): Promise<void> {
  const { error } = await supabase.rpc('treinador_definir_plano', { p_perfil_id: perfilId, p_aulas: aulas })
  if (error) throw error
}

export interface LinhaRelatorio {
  aluno_id: string
  nome: string
  plano_aulas_semana: number | null
  reservas: number
  compareceu: number
  faltas: number
  sem_marcacao: number
  no_show: number
}

export async function relatorioMensal(ano: number, mes: number): Promise<LinhaRelatorio[]> {
  const { data, error } = await supabase.rpc('treinador_relatorio_mensal', { p_ano: ano, p_mes: mes })
  if (error) throw error
  return (Array.isArray(data) ? data : []) as LinhaRelatorio[]
}

export async function criarConvite(nome: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('criar_convite', { p_nome: nome })
  if (error) throw error
  const codigo = (data as { codigo?: string } | null)?.codigo
  if (!codigo) throw new Error('convite_sem_codigo')
  return codigo
}

interface LinhaConvite extends Omit<Convite, 'usado_por_nome'> {
  perfis: { nome: string } | { nome: string }[] | null
}

export async function listarConvites(): Promise<Convite[]> {
  const { data, error } = await supabase
    .from('convites')
    .select('id, codigo, nome_previsto, status, expira_em, criado_em, perfis(nome)')
    .order('criado_em', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as unknown as LinhaConvite[]).map(({ perfis, ...c }) => {
    const p = Array.isArray(perfis) ? perfis[0] : perfis
    return { ...c, usado_por_nome: p?.nome ?? null }
  })
}

/**
 * Revoga só se ainda estiver pendente (o filtro de status evita "desusar" um convite
 * que acabou de ser aceito). O RLS convites_treinador permite o UPDATE.
 */
export async function revogarConvite(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('convites')
    .update({ status: 'revogado' })
    .eq('id', id)
    .eq('status', 'pendente')
    .select('id')
  if (error) throw error
  return ((data ?? []) as unknown[]).length > 0
}

/**
 * Aulas de cada aluno no período: presenças confirmadas em aulas que começaram dentro dele e não
 * foram canceladas (o RLS deixa o treinador ler todos os check-ins).
 */
export async function contarAulasNoPeriodo(inicio: Date, fim: Date): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('checkins')
    .select('aluno_id, sessoes!inner(inicia_em, cancelada)')
    .eq('status', 'confirmado')
    .eq('sessoes.cancelada', false)
    .gte('sessoes.inicia_em', inicio.toISOString())
    .lt('sessoes.inicia_em', fim.toISOString())
  if (error) throw error
  return contarPorAluno((data ?? []) as { aluno_id: string }[])
}
