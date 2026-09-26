import { describe, it, expect, beforeEach } from 'vitest'
import {
  admin, criarUsuario, criarAuthSemPerfil, clienteAnonimo, criarSessao, limparDados, definirConfig,
} from './helpers/db'

const ZERO = '00000000-0000-0000-0000-000000000000'
const PERMISSAO = /permission denied|row-level security/i

const TABELAS = [
  'perfis', 'configuracoes', 'turmas', 'sessoes', 'checkins', 'treinos', 'convites', 'notificacoes',
]

// Todas as funções do schema public até a 0008. Nenhuma pode ser chamada por anon.
const RPCS: Array<[string, Record<string, unknown>]> = [
  ['eh_treinador', {}],
  ['tem_perfil', {}],
  ['config_int', { p_chave: 'limite_bloqueio_min' }],
  ['config_texto', { p_chave: 'fuso' }],
  ['sessao_bloqueada', { p_inicia_em: '2030-01-01T00:00:00Z' }],
  ['gerar_sessoes', {}],
  ['debug_hora_local', {}],
  ['fazer_checkin', { p_sessao_id: ZERO }],
  ['cancelar_checkin', { p_sessao_id: ZERO }],
  ['promover_da_espera', { p_sessao_id: ZERO }],
  ['publicar_treinos_semana', {}],
  ['criar_convite', { p_nome: 'X' }],
  ['aceitar_convite', { p_codigo: 'X', p_nome: 'X', p_telefone: null }],
  ['treinador_remover_aluno', { p_sessao_id: ZERO, p_aluno_id: ZERO }],
  ['treinador_cancelar_sessao', { p_sessao_id: ZERO, p_observacao: 'X' }],
  ['treinador_definir_ativo', { p_perfil_id: ZERO, p_ativo: false }],
]

async function perfilDe(id: string) {
  const { data, error } = await admin.from('perfis').select('nome, telefone, papel, ativo').eq('id', id).single()
  if (error) throw error
  return data!
}

async function checkinDe(sessaoId: string, alunoId: string) {
  const { data, error } = await admin.from('checkins')
    .select('id, status, posicao_fila').eq('sessao_id', sessaoId).eq('aluno_id', alunoId).single()
  if (error) throw error
  return data!
}

async function valorConfig(chave: string) {
  const { data, error } = await admin.from('configuracoes').select('valor').eq('chave', chave).single()
  if (error) throw error
  return data!.valor as string
}

describe('autorização (RLS)', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  // ---------------------------------------------------------------- casos do plano

  it('aluno não enxerga check-in de outro aluno', async () => {
    const sessao = await criarSessao(120, 5)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data, error } = await a1.cliente.from('checkins').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('treinador enxerga todos os check-ins', async () => {
    const sessao = await criarSessao(120, 5)
    const treinador = await criarUsuario('treinador')
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data, error } = await treinador.cliente.from('checkins').select('aluno_id')
    expect(error).toBeNull()
    expect(data!.map(c => c.aluno_id).sort()).toEqual([a1.id, a2.id].sort())
  })

  it('aluno não escreve direto em checkins', async () => {
    const sessao = await criarSessao(120, 5)
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('checkins')
      .insert({ sessao_id: sessao.id, aluno_id: aluno.id, status: 'confirmado' })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(PERMISSAO)

    const { count } = await admin.from('checkins').select('*', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('aluno não cria nem edita turmas', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('turmas').insert({
      nome: 'Pirata', dia_semana: 1, hora_inicio: '06:00', duracao_min: 60, vagas: 99,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(PERMISSAO)
  })

  it('aluno só vê treinos publicados', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const { error } = await treinador.cliente.from('treinos').insert([
      { data: '2030-01-01', titulo: 'Rascunho', descricao: 'oculto' },
      { data: '2030-01-02', titulo: 'Publicado', descricao: 'visível', publicado_em: new Date().toISOString() },
    ])
    expect(error).toBeNull()

    const { data } = await aluno.cliente.from('treinos').select('titulo')
    expect(data!.map(t => t.titulo)).toEqual(['Publicado'])

    // O treinador sempre vê o rascunho.
    const { data: tudo } = await treinador.cliente.from('treinos').select('titulo').order('data')
    expect(tudo!.map(t => t.titulo)).toEqual(['Rascunho', 'Publicado'])
  })

  it('aluno não lê notificação de outro aluno', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const r = await treinador.cliente.rpc('treinador_remover_aluno', { p_sessao_id: sessao.id, p_aluno_id: a1.id })
    expect(r.error).toBeNull()

    const { data } = await a2.cliente.from('notificacoes').select('*')
    expect(data).toEqual([])

    // O dono lê a própria.
    const { data: minhas } = await a1.cliente.from('notificacoes').select('titulo')
    expect(minhas!.map(n => n.titulo)).toEqual(['Presença removida'])

    // O treinador não lê a caixa dos alunos.
    const { data: doTreinador } = await treinador.cliente.from('notificacoes').select('*')
    expect(doTreinador).toEqual([])
  })

  it('aluno não lê a lista de convites', async () => {
    const treinador = await criarUsuario('treinador')
    await treinador.cliente.rpc('criar_convite', { p_nome: 'Alguém' })
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('convites').select('*')
    expect(data).toEqual([])

    const { data: doTreinador } = await treinador.cliente.from('convites').select('nome_previsto')
    expect(doTreinador!.map(c => c.nome_previsto)).toEqual(['Alguém'])
  })

  // ---------------------------------------------------------------- anon

  it.each(TABELAS)('anon não lê a tabela %s', async (tabela) => {
    const { data, error } = await clienteAnonimo().from(tabela).select('*')
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
    expect(data).toBeNull()
  })

  it('anon não escreve em perfis, checkins nem convites', async () => {
    const anon = clienteAnonimo()
    const r1 = await anon.from('perfis').insert({ id: ZERO, nome: 'X', papel: 'treinador' })
    expect(r1.error!.message).toMatch(/permission denied/i)
    const r2 = await anon.from('checkins').insert({ sessao_id: ZERO, aluno_id: ZERO, status: 'confirmado' })
    expect(r2.error!.message).toMatch(/permission denied/i)
    const r3 = await anon.from('convites').insert({ codigo: 'ANON' })
    expect(r3.error!.message).toMatch(/permission denied/i)
  })

  it.each(RPCS)('anon não chama a função %s', async (nome, args) => {
    const { error } = await clienteAnonimo().rpc(nome, args)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
  })

  // ---------------------------------------------------------------- funções internas

  it('gerar_sessoes e debug_hora_local não são chamáveis por usuário autenticado', async () => {
    const aluno = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    for (const u of [aluno, treinador]) {
      for (const fn of ['gerar_sessoes', 'debug_hora_local']) {
        const { error } = await u.cliente.rpc(fn)
        expect(error, `${fn}`).not.toBeNull()
        expect(error!.message).toMatch(/permission denied/i)
      }
    }
    // O service_role (jobs e testes) continua podendo.
    const { error } = await admin.rpc('gerar_sessoes')
    expect(error).toBeNull()
  })

  // ---------------------------------------------------------------- perfis: escalada de privilégio

  it('usuário sem perfil não cria o próprio perfil como treinador (nem como aluno)', async () => {
    const novo = await criarAuthSemPerfil()
    for (const papel of ['treinador', 'aluno']) {
      const { error } = await novo.cliente.from('perfis').insert({ id: novo.id, nome: 'Hacker', papel })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(PERMISSAO)
    }
    const { count } = await admin.from('perfis').select('*', { count: 'exact', head: true }).eq('id', novo.id)
    expect(count).toBe(0)
  })

  it('aluno não se promove a treinador', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('perfis').update({ papel: 'treinador' }).eq('id', aluno.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
    expect((await perfilDe(aluno.id)).papel).toBe('aluno')

    const { data: souTreinador } = await aluno.cliente.rpc('eh_treinador')
    expect(souTreinador).toBe(false)
  })

  it('aluno desativado não se reativa', async () => {
    const aluno = await criarUsuario('aluno', { ativo: false })
    const { error } = await aluno.cliente.from('perfis').update({ ativo: true }).eq('id', aluno.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
    expect((await perfilDe(aluno.id)).ativo).toBe(false)

    // Nem misturando com uma coluna permitida.
    const r = await aluno.cliente.from('perfis').update({ nome: 'Ok', ativo: true }).eq('id', aluno.id)
    expect(r.error).not.toBeNull()
    expect(await perfilDe(aluno.id)).toMatchObject({ nome: 'Aluno Teste', ativo: false })
  })

  it('aluno edita só nome e telefone do próprio perfil', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('perfis')
      .update({ nome: 'Novo Nome', telefone: '11988887777' }).eq('id', aluno.id)
    expect(error).toBeNull()
    expect(await perfilDe(aluno.id)).toEqual({
      nome: 'Novo Nome', telefone: '11988887777', papel: 'aluno', ativo: true,
    })
  })

  it('aluno não edita nem lê o perfil de outro aluno', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')

    const { data: visiveis } = await a1.cliente.from('perfis').select('id')
    expect(visiveis!.map(p => p.id)).toEqual([a1.id])

    const { data: alvo } = await a1.cliente.from('perfis').select('*').eq('id', a2.id)
    expect(alvo).toEqual([])

    const { data: alterados } = await a1.cliente.from('perfis')
      .update({ nome: 'Invadido' }).eq('id', a2.id).select()
    expect(alterados ?? []).toEqual([])
    expect((await perfilDe(a2.id)).nome).toBe('Aluno Teste')
  })

  it('aluno não apaga perfil (nem o próprio)', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('perfis').delete().eq('id', aluno.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
    expect((await perfilDe(aluno.id)).ativo).toBe(true)
  })

  it('treinador lê todos os perfis e edita nome/telefone de aluno', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')

    const { data } = await treinador.cliente.from('perfis').select('id').in('id', [treinador.id, aluno.id])
    expect(data!.map(p => p.id).sort()).toEqual([treinador.id, aluno.id].sort())

    const { error } = await treinador.cliente.from('perfis').update({ telefone: '1133334444' }).eq('id', aluno.id)
    expect(error).toBeNull()
    expect((await perfilDe(aluno.id)).telefone).toBe('1133334444')
  })

  it('treinador não promove ninguém a treinador pela API', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const { error } = await treinador.cliente.from('perfis').update({ papel: 'treinador' }).eq('id', aluno.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)
    expect((await perfilDe(aluno.id)).papel).toBe('aluno')

    const r = await treinador.cliente.from('perfis').insert({ id: ZERO, nome: 'Fantasma', papel: 'treinador' })
    expect(r.error).not.toBeNull()
  })

  it('treinador desativa e reativa aluno pela RPC', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')

    const r1 = await treinador.cliente.rpc('treinador_definir_ativo', { p_perfil_id: aluno.id, p_ativo: false })
    expect(r1.error).toBeNull()
    expect((await perfilDe(aluno.id)).ativo).toBe(false)

    // Desativado: não faz check-in e não se reativa.
    const sessao = await criarSessao(120, 5)
    const ck = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(ck.error!.message).toContain('aluno_inativo')
    const auto = await aluno.cliente.rpc('treinador_definir_ativo', { p_perfil_id: aluno.id, p_ativo: true })
    expect(auto.error!.message).toContain('acesso_negado')
    expect((await perfilDe(aluno.id)).ativo).toBe(false)

    const r2 = await treinador.cliente.rpc('treinador_definir_ativo', { p_perfil_id: aluno.id, p_ativo: true })
    expect(r2.error).toBeNull()
    expect((await perfilDe(aluno.id)).ativo).toBe(true)
  })

  it('treinador não altera ativo direto na tabela nem desativa outro treinador', async () => {
    const treinador = await criarUsuario('treinador')
    const outro = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')

    const direto = await treinador.cliente.from('perfis').update({ ativo: false }).eq('id', aluno.id)
    expect(direto.error!.message).toMatch(/permission denied/i)
    expect((await perfilDe(aluno.id)).ativo).toBe(true)

    for (const alvo of [outro.id, treinador.id]) {
      const { error } = await treinador.cliente.rpc('treinador_definir_ativo', { p_perfil_id: alvo, p_ativo: false })
      expect(error!.message).toContain('apenas_alunos')
      expect((await perfilDe(alvo)).ativo).toBe(true)
    }
  })

  it('aluno não chama treinador_definir_ativo para desativar colega', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const { error } = await a1.cliente.rpc('treinador_definir_ativo', { p_perfil_id: a2.id, p_ativo: false })
    expect(error!.message).toContain('acesso_negado')
    expect((await perfilDe(a2.id)).ativo).toBe(true)
  })

  // ---------------------------------------------------------------- checkins

  it('aluno não altera nem apaga o próprio check-in direto (nem o treinador)', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const antes = await checkinDe(sessao.id, a2.id)
    expect(antes.status).toBe('espera')

    // Furar a fila: passar de espera para confirmado.
    const u = await a2.cliente.from('checkins')
      .update({ status: 'confirmado', posicao_fila: null }).eq('id', antes.id)
    expect(u.error!.message).toMatch(/permission denied/i)

    // Apagar o check-in de quem está confirmado (ou o próprio).
    const d = await a2.cliente.from('checkins').delete().eq('sessao_id', sessao.id)
    expect(d.error!.message).toMatch(/permission denied/i)

    // O treinador também só mexe via RPC (que valida fila e notifica).
    const t = await treinador.cliente.from('checkins').update({ status: 'cancelado' }).eq('sessao_id', sessao.id)
    expect(t.error!.message).toMatch(/permission denied/i)

    expect(await checkinDe(sessao.id, a2.id)).toEqual(antes)
    expect((await checkinDe(sessao.id, a1.id)).status).toBe('confirmado')
  })

  it('aluno vê só o próprio check-in mesmo filtrando pelo id do colega', async () => {
    const sessao = await criarSessao(120, 5)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data: meus } = await a1.cliente.from('checkins').select('aluno_id')
    expect(meus!.map(c => c.aluno_id)).toEqual([a1.id])

    const { data: alheio } = await a1.cliente.from('checkins').select('*').eq('aluno_id', a2.id)
    expect(alheio).toEqual([])

    const { count } = await a1.cliente.from('checkins')
      .select('*', { count: 'exact', head: true }).eq('sessao_id', sessao.id)
    expect(count).toBe(1)
  })

  // ---------------------------------------------------------------- notificacoes

  it('aluno só marca lida_em nas próprias notificações', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const { data: criadas, error: e0 } = await admin.from('notificacoes').insert([
      { perfil_id: a1.id, titulo: 'Para A1', corpo: 'x' },
      { perfil_id: a2.id, titulo: 'Para A2', corpo: 'y' },
    ]).select('id, perfil_id')
    expect(e0).toBeNull()
    const n1 = criadas!.find(n => n.perfil_id === a1.id)!.id
    const n2 = criadas!.find(n => n.perfil_id === a2.id)!.id
    const agora = new Date().toISOString()

    // Própria: pode marcar como lida.
    const ok = await a1.cliente.from('notificacoes').update({ lida_em: agora }).eq('id', n1)
    expect(ok.error).toBeNull()
    const { data: lida } = await admin.from('notificacoes').select('lida_em').eq('id', n1).single()
    expect(lida!.lida_em).not.toBeNull()

    // Própria: não reescreve o conteúdo.
    const texto = await a1.cliente.from('notificacoes').update({ titulo: 'Forjado' }).eq('id', n1)
    expect(texto.error!.message).toMatch(/permission denied/i)
    // Nem transfere para outro dono.
    const dono = await a1.cliente.from('notificacoes').update({ perfil_id: a2.id }).eq('id', n1)
    expect(dono.error!.message).toMatch(/permission denied/i)

    // Alheia: nenhuma linha afetada.
    await a1.cliente.from('notificacoes').update({ lida_em: agora }).eq('id', n2)
    const { data: alheia } = await admin.from('notificacoes').select('titulo, lida_em, perfil_id').eq('id', n2).single()
    expect(alheia).toEqual({ titulo: 'Para A2', lida_em: null, perfil_id: a2.id })

    const { data: n1Final } = await admin.from('notificacoes').select('titulo, perfil_id').eq('id', n1).single()
    expect(n1Final).toEqual({ titulo: 'Para A1', perfil_id: a1.id })
  })

  it('aluno não cria nem apaga notificação', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const ins = await a1.cliente.from('notificacoes').insert({ perfil_id: a2.id, titulo: 'Spam', corpo: 'x' })
    expect(ins.error!.message).toMatch(/permission denied/i)
    const insPropria = await a1.cliente.from('notificacoes').insert({ perfil_id: a1.id, titulo: 'Eu', corpo: 'x' })
    expect(insPropria.error!.message).toMatch(/permission denied/i)

    await admin.from('notificacoes').insert({ perfil_id: a1.id, titulo: 'Minha', corpo: 'x' })
    const del = await a1.cliente.from('notificacoes').delete().eq('perfil_id', a1.id)
    expect(del.error!.message).toMatch(/permission denied/i)

    const { count } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  // ---------------------------------------------------------------- escrita em tabelas do treinador

  it('aluno não altera nem apaga turmas e sessões', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    const { data: s0 } = await admin.from('sessoes').select('turma_id').eq('id', sessao.id).single()

    await aluno.cliente.from('turmas').update({ vagas: 99, nome: 'Pirata' }).eq('id', s0!.turma_id)
    await aluno.cliente.from('turmas').delete().eq('id', s0!.turma_id)
    await aluno.cliente.from('sessoes').update({ vagas: 99, cancelada: true, observacao: 'x' }).eq('id', sessao.id)
    await aluno.cliente.from('sessoes').delete().eq('id', sessao.id)
    const ins = await aluno.cliente.from('sessoes')
      .insert({ turma_id: s0!.turma_id, inicia_em: '2030-01-01T09:00:00Z', vagas: 50 })
    expect(ins.error!.message).toMatch(PERMISSAO)

    const { data: turma } = await admin.from('turmas').select('nome, vagas').eq('id', s0!.turma_id).single()
    expect(turma).toEqual({ nome: 'Turma Teste', vagas: 3 })
    const { data: s } = await admin.from('sessoes').select('vagas, cancelada, observacao').eq('id', sessao.id).single()
    expect(s).toEqual({ vagas: 3, cancelada: false, observacao: null })
    const { count } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  it('aluno lê turmas e sessões (a agenda é pública entre os membros)', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    const { data } = await aluno.cliente.from('sessoes').select('id')
    expect(data!.map(s => s.id)).toEqual([sessao.id])
    const { data: turmas } = await aluno.cliente.from('turmas').select('nome')
    expect(turmas!.map(t => t.nome)).toEqual(['Turma Teste'])
  })

  it('treinador cria e edita turmas e sessões', async () => {
    const treinador = await criarUsuario('treinador')
    const { data: turma, error } = await treinador.cliente.from('turmas')
      .insert({ nome: 'Nova', dia_semana: 2, hora_inicio: '07:00', vagas: 8 }).select('id').single()
    expect(error).toBeNull()
    const upd = await treinador.cliente.from('turmas').update({ vagas: 10 }).eq('id', turma!.id)
    expect(upd.error).toBeNull()
    const { data: t } = await admin.from('turmas').select('vagas').eq('id', turma!.id).single()
    expect(t!.vagas).toBe(10)

    const sess = await treinador.cliente.from('sessoes')
      .insert({ turma_id: turma!.id, inicia_em: '2030-01-01T10:00:00Z', vagas: 10 }).select('id').single()
    expect(sess.error).toBeNull()
    const obs = await treinador.cliente.from('sessoes').update({ observacao: 'Na praça' }).eq('id', sess.data!.id)
    expect(obs.error).toBeNull()
  })

  it('aluno não escreve em treinos nem vê rascunho pelo id', async () => {
    const aluno = await criarUsuario('aluno')
    const { data: rasc } = await admin.from('treinos')
      .insert({ data: '2030-02-01', titulo: 'Segredo', descricao: 'rascunho' }).select('id').single()

    const ins = await aluno.cliente.from('treinos').insert({ data: '2030-02-02', titulo: 'Falso', descricao: 'x' })
    expect(ins.error!.message).toMatch(PERMISSAO)
    await aluno.cliente.from('treinos').update({ publicado_em: new Date().toISOString() }).eq('id', rasc!.id)
    await aluno.cliente.from('treinos').delete().eq('id', rasc!.id)

    const { data: porId } = await aluno.cliente.from('treinos').select('*').eq('id', rasc!.id)
    expect(porId).toEqual([])
    const { data: t } = await admin.from('treinos').select('titulo, publicado_em').eq('id', rasc!.id).single()
    expect(t).toEqual({ titulo: 'Segredo', publicado_em: null })
  })

  it('aluno não cria, edita nem revoga convites', async () => {
    const treinador = await criarUsuario('treinador')
    const { data: c } = await treinador.cliente.rpc('criar_convite', { p_nome: 'Fulano' })
    const aluno = await criarUsuario('aluno')

    const ins = await aluno.cliente.from('convites').insert({ codigo: 'MEUCONVITE01', nome_previsto: 'Amigo' })
    expect(ins.error!.message).toMatch(PERMISSAO)
    await aluno.cliente.from('convites').update({ status: 'revogado' }).eq('codigo', c.codigo)
    await aluno.cliente.from('convites').update({ expira_em: '2099-01-01T00:00:00Z' }).eq('codigo', c.codigo)
    await aluno.cliente.from('convites').delete().eq('codigo', c.codigo)

    const { data } = await admin.from('convites').select('codigo, status')
    expect(data).toEqual([{ codigo: c.codigo, status: 'pendente' }])
  })

  // ---------------------------------------------------------------- configuracoes

  it('aluno lê só as configurações da lista liberada', async () => {
    const aluno = await criarUsuario('aluno')
    const { data } = await aluno.cliente.from('configuracoes').select('chave').order('chave')
    expect(data!.map(c => c.chave)).toEqual(['fuso', 'limite_bloqueio_min', 'spoiler_dia_semana', 'spoiler_hora'])

    // config_texto/config_int rodam com o RLS de quem chama: chave fora da lista vira nulo.
    const fora = await aluno.cliente.rpc('config_texto', { p_chave: 'janela_geracao_semanas' })
    expect(fora.error).toBeNull()
    expect(fora.data).toBeNull()
    const dentro = await aluno.cliente.rpc('config_texto', { p_chave: 'fuso' })
    expect(dentro.data).toBe('America/Sao_Paulo')
  })

  it('treinador lê todas as configurações', async () => {
    const treinador = await criarUsuario('treinador')
    const { data } = await treinador.cliente.from('configuracoes').select('chave')
    expect(data!.map(c => c.chave)).toContain('janela_geracao_semanas')
  })

  it('aluno não altera nem cria configuração; treinador altera', async () => {
    const aluno = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')

    await aluno.cliente.from('configuracoes').update({ valor: '0' }).eq('chave', 'limite_bloqueio_min')
    expect(await valorConfig('limite_bloqueio_min')).toBe('60')
    const ins = await aluno.cliente.from('configuracoes').insert({ chave: 'pirata', valor: '1' })
    expect(ins.error!.message).toMatch(/permission denied/i)
    const del = await aluno.cliente.from('configuracoes').delete().eq('chave', 'fuso')
    expect(del.error!.message).toMatch(/permission denied/i)

    try {
      const { error } = await treinador.cliente.from('configuracoes')
        .update({ valor: '45' }).eq('chave', 'limite_bloqueio_min')
      expect(error).toBeNull()
      expect(await valorConfig('limite_bloqueio_min')).toBe('45')
      // Nem o treinador troca a chave nem apaga linhas pela API.
      const troca = await treinador.cliente.from('configuracoes').update({ chave: 'x' }).eq('chave', 'fuso')
      expect(troca.error!.message).toMatch(/permission denied/i)
    } finally {
      await definirConfig('limite_bloqueio_min', '60')
    }
  })

  // ---------------------------------------------------------------- usuário sem perfil

  it('usuário do Auth sem perfil não lê nada', async () => {
    await criarSessao(120, 3)
    await admin.from('treinos').insert({
      data: '2030-03-01', titulo: 'Publicado', descricao: 'x', publicado_em: new Date().toISOString(),
    })
    const novo = await criarAuthSemPerfil()
    for (const tabela of TABELAS) {
      const { data, error } = await novo.cliente.from(tabela).select('*')
      expect(error, tabela).toBeNull()
      expect(data, tabela).toEqual([])
    }
    const { data: tem } = await novo.cliente.rpc('tem_perfil')
    expect(tem).toBe(false)
  })

  // ---------------------------------------------------------------- recursão

  it('políticas de perfis não recursam (eh_treinador dentro da política)', async () => {
    const aluno = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    const r1 = await aluno.cliente.from('perfis').select('papel').eq('id', aluno.id).single()
    expect(r1.error).toBeNull()
    expect(r1.data!.papel).toBe('aluno')
    const r2 = await treinador.cliente.from('perfis').select('papel').eq('id', treinador.id).single()
    expect(r2.error).toBeNull()
    expect(r2.data!.papel).toBe('treinador')
  })
})
