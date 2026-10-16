/** Espelho das estruturas do banco (supabase/migrations) usadas pelo app do aluno. */

export type Papel = 'aluno' | 'treinador'
export type MeuStatus = 'confirmado' | 'espera'

/** Linha da view v_agenda (0009_agenda.sql). */
export interface LinhaAgenda {
  id: string
  turma_id: string
  turma_nome: string
  inicia_em: string
  duracao_min: number
  vagas: number
  cancelada: boolean
  observacao: string | null
  confirmados: number
  vagas_restantes: number
  na_espera: number
  bloqueada: boolean
  meu_status: MeuStatus | null
  minha_posicao: number | null
  treino_titulo: string | null
  treino_descricao: string | null
  treino_video_url: string | null
}

export interface Perfil {
  id: string
  nome: string
  telefone: string | null
  papel: Papel
  ativo: boolean
  /** Aulas por semana do plano do aluno; null = sem plano definido. */
  plano_aulas_semana?: number | null
  foto_url?: string | null
}

export interface Notificacao {
  id: string
  titulo: string
  corpo: string
  link: string | null
  lida_em: string | null
  criado_em: string
}

/* ------------------------------------------------------------ painel do treinador */

/** Linha de `turmas` (0002_turmas_sessoes.sql). hora_inicio vem como "HH:MM:SS". */
export interface Turma {
  id: string
  nome: string
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  vagas: number
  ativa: boolean
}

/** Linha de `treinos` (0005_treinos.sql). publicado_em nulo = rascunho. */
export interface Treino {
  id: string
  data: string
  titulo: string
  descricao: string
  video_url: string | null
  publicado_em: string | null
}

export type StatusConvite = 'pendente' | 'usado' | 'revogado'

/** Linha de `convites` (0006_convites.sql) com o nome de quem usou. */
export interface Convite {
  id: string
  codigo: string
  nome_previsto: string | null
  status: StatusConvite
  expira_em: string
  criado_em: string
  usado_por_nome: string | null
}
