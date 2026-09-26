import { formatarPrazo } from './datetime'

/**
 * Tradução de erros para mensagens amigáveis em português.
 * Backend: as RPCs fazem `raise exception '<codigo>'`, que chega em `error.message`.
 * Auth: o supabase-js expõe `error.code` (ex.: invalid_credentials).
 */
const BACKEND = [
  'sessao_bloqueada', 'sessao_cancelada', 'aluno_inativo', 'checkin_ja_existe', 'checkin_inexistente',
  'convite_invalido', 'perfil_ja_existe', 'nome_obrigatorio', 'nao_autenticado', 'sessao_inexistente',
  'acesso_negado',
] as const

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

export function mensagemErro(erro: unknown, opcoes: { limiteMin?: number } = {}): string {
  const prazo = formatarPrazo(opcoes.limiteMin ?? 60)
  const codigo = codigoErro(erro)
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
  }
  if (codigo && AUTH[codigo]) return AUTH[codigo]

  const mensagem = campo(erro, 'message') ?? ''
  if (erro instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(mensagem)) {
    return REDE
  }
  return GENERICA
}
