import { describe, it, expect, beforeEach } from 'vitest'
import {
  admin, criarUsuario, criarAuthSemPerfil, clienteAnonimo, criarSessao, limparDados, definirConfig,
} from './helpers/db'

const COLUNAS = [
  'id', 'turma_id', 'turma_nome', 'inicia_em', 'duracao_min', 'vagas', 'cancelada', 'observacao',
  'confirmados', 'vagas_restantes', 'na_espera', 'bloqueada', 'meu_status', 'minha_posicao',
  'treino_titulo', 'treino_descricao', 'treino_video_url',
].sort()

/** Data local (America/Sao_Paulo) de um instante, no formato AAAA-MM-DD. */
function dataSP(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

describe('view de agenda', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  // ---------------------------------------------------------------- casos do plano

  it('mostra vagas restantes e o status do próprio aluno', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data, error } = await aluno.cliente.from('v_agenda').select('*').eq('id', sessao.id).single()
    expect(error).toBeNull()
    expect(data!.confirmados).toBe(1)
    expect(data!.vagas_restantes).toBe(2)
    expect(data!.meu_status).toBe('confirmado')
    expect(data!.bloqueada).toBe(false)
  })

  it('marca como bloqueada quando falta menos de 1h', async () => {
    const sessao = await criarSessao(30, 3)
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('v_agenda').select('bloqueada').eq('id', sessao.id).single()
    expect(data!.bloqueada).toBe(true)
  })

  it('meu_status é nulo para quem não fez check-in', async () => {
    const sessao = await criarSessao(120, 3)
    const outro = await criarUsuario('aluno')
    await outro.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('v_agenda').select('meu_status, confirmados')
      .eq('id', sessao.id).single()
    expect(data!.meu_status).toBeNull()
    expect(data!.confirmados).toBe(1)
  })

  // ---------------------------------------------------------------- contagens para quem observa

  it('contagens corretas para um observador que nunca fez check-in', async () => {
    const sessao = await criarSessao(120, 2)
    const alunos = [await criarUsuario('aluno'), await criarUsuario('aluno'), await criarUsuario('aluno')]
    for (const a of alunos) await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const observador = await criarUsuario('aluno')

    const { data, error } = await observador.cliente.from('v_agenda').select('*').eq('id', sessao.id).single()
    expect(error).toBeNull()
    expect(data).toMatchObject({
      confirmados: 2, vagas_restantes: 0, na_espera: 1, meu_status: null, minha_posicao: null,
    })
  })

  it('quem está na fila vê o próprio status e posição', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const a3 = await criarUsuario('aluno')
    for (const a of [a1, a2, a3]) await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data } = await a3.cliente.from('v_agenda')
      .select('meu_status, minha_posicao, confirmados, na_espera').eq('id', sessao.id).single()
    expect(data).toEqual({ meu_status: 'espera', minha_posicao: 2, confirmados: 1, na_espera: 2 })
  })

  it('check-in cancelado não conta e não aparece como meu_status', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await aluno.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await aluno.cliente.from('v_agenda')
      .select('meu_status, confirmados, vagas_restantes').eq('id', sessao.id).single()
    expect(data).toEqual({ meu_status: null, confirmados: 0, vagas_restantes: 3 })
  })

  it('treinador vê as mesmas contagens', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    for (const a of [a1, a2]) await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const treinador = await criarUsuario('treinador')

    const { data } = await treinador.cliente.from('v_agenda')
      .select('confirmados, na_espera, meu_status').eq('id', sessao.id).single()
    expect(data).toEqual({ confirmados: 1, na_espera: 1, meu_status: null })
  })

  // ---------------------------------------------------------------- vazamento

  it('não expõe ids nem nomes de outros alunos', async () => {
    const sessao = await criarSessao(120, 2)
    const outro = await criarUsuario('aluno')
    await outro.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('perfis').update({ nome: 'Nome Secreto Do Colega' }).eq('id', outro.id)
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('v_agenda').select('*')
    expect(data!.length).toBe(1)
    expect(Object.keys(data![0]).sort()).toEqual(COLUNAS)
    const bruto = JSON.stringify(data)
    expect(bruto).not.toContain(outro.id)
    expect(bruto).not.toContain('Nome Secreto')
  })

  it('a função de contagem só devolve números', async () => {
    const sessao = await criarSessao(120, 2)
    const outro = await criarUsuario('aluno')
    await outro.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const aluno = await criarUsuario('aluno')

    const { data, error } = await aluno.cliente.rpc('contagem_checkins', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data).toEqual([{ total_confirmados: 1, total_espera: 0 }])
  })

  // ---------------------------------------------------------------- treino do dia

  it('aluno vê o treino do dia só depois de publicado; treinador vê o rascunho', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    const { data: treino } = await admin.from('treinos').insert({
      data: dataSP(sessao.inicia_em), titulo: 'Pernas', descricao: 'Agachamento', video_url: 'https://v/1',
    }).select('id').single()

    const campos = 'treino_titulo, treino_descricao, treino_video_url'
    const r1 = await aluno.cliente.from('v_agenda').select(campos).eq('id', sessao.id).single()
    expect(r1.data).toEqual({ treino_titulo: null, treino_descricao: null, treino_video_url: null })

    const r2 = await treinador.cliente.from('v_agenda').select(campos).eq('id', sessao.id).single()
    expect(r2.data).toEqual({ treino_titulo: 'Pernas', treino_descricao: 'Agachamento', treino_video_url: 'https://v/1' })

    await admin.from('treinos').update({ publicado_em: new Date().toISOString() }).eq('id', treino!.id)
    const r3 = await aluno.cliente.from('v_agenda').select(campos).eq('id', sessao.id).single()
    expect(r3.data!.treino_titulo).toBe('Pernas')
  })

  // ---------------------------------------------------------------- acesso

  it('anon não lê a view nem chama a função de contagem', async () => {
    const sessao = await criarSessao(120, 2)
    const anon = clienteAnonimo()
    const r1 = await anon.from('v_agenda').select('*')
    expect(r1.error!.message).toMatch(/permission denied/i)
    const r2 = await anon.rpc('contagem_checkins', { p_sessao_id: sessao.id })
    expect(r2.error!.message).toMatch(/permission denied/i)
  })

  it('usuário do Auth sem perfil não vê a agenda nem contagens', async () => {
    const sessao = await criarSessao(120, 2)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const novo = await criarAuthSemPerfil()

    const { data, error } = await novo.cliente.from('v_agenda').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
    const r = await novo.cliente.rpc('contagem_checkins', { p_sessao_id: sessao.id })
    expect(r.data).toEqual([{ total_confirmados: 0, total_espera: 0 }])
  })

  it('a view é somente leitura', async () => {
    const sessao = await criarSessao(120, 2)
    const treinador = await criarUsuario('treinador')
    const { error } = await treinador.cliente.from('v_agenda').update({ vagas: 99 }).eq('id', sessao.id)
    expect(error).not.toBeNull()
    const { data } = await admin.from('sessoes').select('vagas').eq('id', sessao.id).single()
    expect(data!.vagas).toBe(2)
  })
})
