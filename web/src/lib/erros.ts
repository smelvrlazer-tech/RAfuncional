import { formatarPrazo } from './datetime'

/**
 * Tradução de erros para mensagens amigáveis em português.
 * Backend: as RPCs fazem `raise exception '<codigo>'`, que chega em `error.message`.
 * Auth: o supabase-js expõe `error.code` (ex.: invalid_credentials).
 */
const BACKEND = [
  'sessao_bloqueada', 'sessao_cancelada', 'aluno_inativo', 'checkin_ja_existe', 'checkin_inexistente',
  'convite_invalido', 'perfil_ja_existe', 'nome_obrigatorio', 'nao_autenticado', 'sessao_inexistente',
  'acesso_negado', 'apenas_alunos', 'perfil_inexistente', 'ativo_obrigatorio',
  'turma_inexistente', 'turma_nome_obrigatorio', 'turma_dia_invalido', 'turma_hora_obrigatoria',
  'turma_duracao_invalida', 'turma_vagas_invalidas', 'push_invalido',
] as const

/** Códigos SQLSTATE de escrita direta nas tabelas (painel do treinador). */
const POSTGRES: Record<string, string> = {
  '23505': 'Já existe um registro com esses dados (ex.: um treino nessa data). Atualize a tela.',
  '23514': 'Confira os valores informados (ex.: as vagas precisam ser maiores que zero).',
  '42501': 'Você não tem permissão para fazer isso.',
  // PostgREST: a função não existe no banco (ex.: migration ainda não aplicada).
  PGRST202: 'Essa função ainda não está disponível no servidor. Nada foi alterado — tente mais tarde ou avise o suporte.',
}

/** No painel do treinador, algumas mensagens falam do aluno, não com o aluno. */
const TREINADOR: Record<string, string> = {
  checkin_inexistente: 'Esse aluno já não está nessa aula — a lista pode estar desatualizada. Atualizamos para você.',
  sessao_cancelada: 'Essa aula já estava cancelada.',
  sessao_inexistente: 'Essa aula não existe mais. Atualize o painel.',
}

const AUTH: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com esse e-mail. Tente entrar com sua senha.',
  email_exists: 'Já existe uma conta com esse e-mail. Tente entrar com sua senha.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  weak_password: 'A senha precisa ter pelo menos 8 caracteres.',
  over_email_send_rate_limit: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  email_address_invalid: 'Informe um e-mail válido.',
  validation_failed: 'Confira os dados informados.',
  signup_disabled: 'O cadastro está temporariamente fechado. Fale com o seu treinador.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
}

const AUTH_POR_MENSAGEM: [RegExp, string][] = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/user already registered/i, 'user_already_exists'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/password should be at least/i, 'weak_password'],
  [/rate limit/i, 'over_request_rate_limit'],
]

const GENERICA = 'Algo deu errado. Tente de novo em instantes.'
const REDE = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'

function campo(erro: unknown, nome: string): string | null {
  if (erro && typeof erro === 'object' && nome in erro) {
    const v = (erro as Record<string, unknown>)[nome]
    return typeof v === 'string' ? v : null
  }
  return null
}

export function codigoErro(erro: unknown): string | null {
  const mensagem = campo(erro, 'message')?.trim() ?? ''
  if ((BACKEND as readonly string[]).includes(mensagem)) return mensagem
  const code = campo(erro, 'code')
  if (code && code in AUTH) return code
  for (const [re, c] of AUTH_POR_MENSAGEM) if (re.test(mensagem)) return c
  return null
}

export function mensagemErro(erro: unknown, opcoes: { limiteMin?: number; treinador?: boolean } = {}): string {
  const prazo = formatarPrazo(opcoes.limiteMin ?? 60)
  const codigo = codigoErro(erro)
  if (opcoes.treinador && codigo && TREINADOR[codigo]) return TREINADOR[codigo]
  switch (codigo) {
    case 'sessao_bloqueada':
      return `Essa aula já está bloqueada: faltam menos de ${prazo} para começar. Check-in e cancelamento fecham ${prazo} antes.`
    case 'sessao_cancelada':
      return 'Essa aula foi cancelada pelo treinador.'
    case 'aluno_inativo':
      return 'Sua conta está desativada. Fale com o seu treinador para reativar.'
    case 'checkin_ja_existe':
      return 'Você já está nessa aula (confirmado ou na fila de espera).'
    case 'checkin_inexistente':
      return 'Você não tem check-in nessa aula — ele pode já ter sido cancelado.'
    case 'convite_invalido':
      return 'Esse convite não é válido: pode ter expirado, já ter sido usado ou o código está incorreto. Peça um novo link ao seu treinador.'
    case 'perfil_ja_existe':
      return 'Sua conta já está cadastrada. É só entrar com seu e-mail e senha.'
    case 'nome_obrigatorio':
      return 'Informe seu nome.'
    case 'nao_autenticado':
      return 'Sua sessão expirou. Entre novamente.'
    case 'sessao_inexistente':
      return 'Essa aula não existe mais. Atualize a agenda.'
    case 'acesso_negado':
      return 'Você não tem permissão para fazer isso.'
    case 'apenas_alunos':
      return 'Só alunos podem ser ativados ou desativados.'
    case 'perfil_inexistente':
      return 'Esse aluno não foi encontrado. Atualize a lista.'
    case 'ativo_obrigatorio':
      return 'Escolha se o aluno deve ficar ativo: não foi possível ativar ou desativar.'
    case 'turma_inexistente':
      return 'Essa turma não foi encontrada. Atualize a lista.'
    case 'turma_nome_obrigatorio':
      return 'Informe o nome da turma.'
    case 'turma_dia_invalido':
      return 'Escolha o dia da semana.'
    case 'turma_hora_obrigatoria':
      return 'Informe o horário de início.'
    case 'turma_duracao_invalida':
      return 'A duração precisa ser maior que zero.'
    case 'turma_vagas_invalidas':
      return 'As vagas precisam ser maiores que zero.'
    case 'push_invalido':
      return 'Não foi possível ativar os avisos neste aparelho. Tente de novo.'
  }
  if (codigo && AUTH[codigo]) return AUTH[codigo]
  const sqlstate = campo(erro, 'code')
  if (sqlstate && POSTGRES[sqlstate]) return POSTGRES[sqlstate]

  const mensagem = campo(erro, 'message') ?? ''
  if (erro instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(mensagem)) {
    return REDE
  }
  return GENERICA
}
