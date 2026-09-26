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
}

export interface Notificacao {
  id: string
  titulo: string
  corpo: string
  link: string | null
  lida_em: string | null
  criado_em: string
}
