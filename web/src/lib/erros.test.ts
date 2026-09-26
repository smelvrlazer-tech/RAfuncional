import { describe, it, expect } from 'vitest'
import { mensagemErro, codigoErro } from './erros'

// Formato de erro do PostgREST quando uma RPC faz `raise exception 'codigo'`.
const rpc = (codigo: string) => ({ code: 'P0001', message: codigo, details: null, hint: null })
// Formato de AuthApiError do supabase-js.
const auth = (code: string, message = '') => ({ name: 'AuthApiError', status: 400, code, message })

describe('mensagemErro', () => {
  it.each([
    ['sessao_bloqueada', /faltam menos de 1h/],
    ['sessao_cancelada', /cancelada pelo treinador/],
    ['aluno_inativo', /desativada/],
    ['checkin_ja_existe', /já está nessa aula/],
    ['checkin_inexistente', /não tem check-in/],
    ['convite_invalido', /convite não é válido/],
    ['perfil_ja_existe', /já está cadastrada/],
    ['nome_obrigatorio', /seu nome/],
    ['nao_autenticado', /Entre novamente/],
    ['sessao_inexistente', /não existe mais/],
    ['acesso_negado', /permissão/],
  ])('código do backend %s', (codigo, esperado) => {
    expect(mensagemErro(rpc(codigo))).toMatch(esperado)
  })

  it('usa o prazo configurado na mensagem de bloqueio', () => {
    expect(mensagemErro(rpc('sessao_bloqueada'), { limiteMin: 90 })).toMatch(/faltam menos de 1h30/)
  })

  it.each([
    ['invalid_credentials', /E-mail ou senha incorretos/],
    ['user_already_exists', /já existe uma conta/i],
    ['email_exists', /já existe uma conta/i],
    ['email_not_confirmed', /confirme seu e-mail/i],
    ['weak_password', /pelo menos 8/],
    ['over_email_send_rate_limit', /Muitas tentativas/],
    ['over_request_rate_limit', /Muitas tentativas/],
    ['email_address_invalid', /e-mail válido/],
  ])('erro de auth %s', (code, esperado) => {
    expect(mensagemErro(auth(code))).toMatch(esperado)
  })

  it('auth antigo sem code, pela mensagem', () => {
    expect(mensagemErro({ message: 'Invalid login credentials' })).toMatch(/E-mail ou senha incorretos/)
  })

  it('falha de rede vira mensagem de conexão', () => {
    expect(mensagemErro(new TypeError('Failed to fetch'))).toMatch(/conexão/)
    expect(mensagemErro({ message: 'TypeError: NetworkError when attempting to fetch resource.' })).toMatch(/conexão/)
  })

  it('desconhecido nunca mostra texto técnico', () => {
    expect(mensagemErro({ message: 'relation "x" does not exist' })).toBe('Algo deu errado. Tente de novo em instantes.')
    expect(mensagemErro(null)).toBe('Algo deu errado. Tente de novo em instantes.')
    expect(mensagemErro('qualquer')).toBe('Algo deu errado. Tente de novo em instantes.')
  })
})

describe('mensagemErro — painel do treinador', () => {
  it.each([
    ['apenas_alunos', /só alunos/i],
    ['perfil_inexistente', /aluno não foi encontrado/],
    ['ativo_obrigatorio', /ativar ou desativar/],
  ])('código do backend %s', (codigo, esperado) => {
    expect(mensagemErro(rpc(codigo), { treinador: true })).toMatch(esperado)
  })

  it('reescreve as mensagens que no app do aluno falam com o aluno', () => {
    expect(mensagemErro(rpc('checkin_inexistente'), { treinador: true })).toMatch(/aluno já não está nessa aula/)
    expect(mensagemErro(rpc('sessao_cancelada'), { treinador: true })).toMatch(/já estava cancelada/)
    expect(mensagemErro(rpc('checkin_inexistente'))).toMatch(/Você não tem check-in/)
  })

  it('erros do Postgres vindos de escrita direta nas tabelas', () => {
    expect(mensagemErro({ code: '23505', message: 'duplicate key value violates unique constraint "treinos_data_key"' }))
      .toMatch(/Já existe um registro/)
    expect(mensagemErro({ code: '23514', message: 'new row violates check constraint "turmas_vagas_check"' }))
      .toMatch(/Confira os valores/)
    expect(mensagemErro({ code: '42501', message: 'new row violates row-level security policy for table "turmas"' }))
      .toMatch(/permissão/)
  })
})

describe('codigoErro', () => {
  it('extrai o código do backend ou do auth', () => {
    expect(codigoErro(rpc('sessao_bloqueada'))).toBe('sessao_bloqueada')
    expect(codigoErro(auth('invalid_credentials'))).toBe('invalid_credentials')
    expect(codigoErro({ message: 'outra coisa' })).toBeNull()
  })
})
