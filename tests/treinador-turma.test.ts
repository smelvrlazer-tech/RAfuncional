import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  admin, criarUsuario, criarAuthSemPerfil, clienteAnonimo, limparDados, definirConfig, type Usuario,
} from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

// ------------------------------------------------------------------ hora local de São Paulo

const FUSO = 'America/Sao_Paulo'
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** Data (YYYY-MM-DD) e hora (HH:MM) locais de SP de um timestamptz. */
function localSP(valor: string | Date) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(valor)).map((x) => [x.type, x.value]))
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

function somarDias(chave: string, dias: number): string {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d! + dias)).toISOString().slice(0, 10)
}

function dow(chave: string): number {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d!)).getUTCDay()
}

const hojeSP = () => localSP(new Date()).data
/** Dia da semana (0-6) de "hoje + n" em SP. */
const diaDaqui = (n: number) => dow(somarDias(hojeSP(), n))
/** Datas locais esperadas: hoje + cada deslocamento. */
const datasDaqui = (...n: number[]) => n.map((x) => somarDias(hojeSP(), x))

// ------------------------------------------------------------------ cenário

interface Turma { id: string; nome: string; dia_semana: number; hora_inicio: string; duracao_min: number; vagas: number }
interface Sessao { id: string; inicia_em: string; vagas: number; cancelada: boolean; observacao: string | null }
interface Relatorio {
  turma: Turma & { ativa: boolean }
  movidas: number
  atualizadas: number
  removidas: number
  criadas: number
  preservadas: { id: string; inicia_em: string; vagas: number; confirmados: number; na_espera: number }[]
  canceladas: { id: string; inicia_em: string }[]
}

/**
 * Turma ativa daqui a `diasAFrente` dias (dia da semana local), já com as aulas geradas
 * pela função real (janela de 4 semanas = hoje..hoje+28). Com diasAFrente=2: +2, +9, +16, +23.
 */
async function prepararTurma(opcoes: { diasAFrente?: number; hora?: string; vagas?: number } = {}) {
  const { diasAFrente = 2, hora = '06:00', vagas = 10 } = opcoes
  const { data: turma, error } = await admin.from('turmas')
    .insert({ nome: 'Funcional', dia_semana: diaDaqui(diasAFrente), hora_inicio: hora, duracao_min: 60, vagas })
    .select().single()
  if (error) throw error
  const g = await admin.rpc('gerar_sessoes')
  if (g.error) throw g.error
  const sessoes = await sessoesDa(turma!.id)
  const esperadas = [0, 7, 14, 21, 28].map((d) => d + diasAFrente).filter((d) => d <= 28)
  expect(sessoes.map((s) => localSP(s.inicia_em))).toEqual(datasDaqui(...esperadas).map((data) => ({ data, hora })))
  return { turma: turma as Turma, sessoes }
}

async function sessoesDa(turmaId: string): Promise<Sessao[]> {
  const { data, error } = await admin.from('sessoes')
    .select('id, inicia_em, vagas, cancelada, observacao').eq('turma_id', turmaId).order('inicia_em')
  if (error) throw error
  return data as Sessao[]
}

async function turmaNoBanco(id: string) {
  const { data, error } = await admin.from('turmas')
    .select('nome, dia_semana, hora_inicio, duracao_min, vagas').eq('id', id).single()
  if (error) throw error
  return data
}

function atualizar(
  cliente: SupabaseClient, turma: Turma,
  mudancas: Partial<Pick<Turma, 'nome' | 'dia_semana' | 'hora_inicio' | 'duracao_min' | 'vagas'>> = {},
) {
  const t = { ...turma, ...mudancas }
  return cliente.rpc('treinador_atualizar_turma', {
    p_turma_id: t.id, p_nome: t.nome, p_dia_semana: t.dia_semana,
    p_hora_inicio: t.hora_inicio, p_duracao_min: t.duracao_min, p_vagas: t.vagas,
  })
}

async function checkinsDe(sessaoId: string) {
  const { data, error } = await admin.from('checkins')
    .select('aluno_id, status, sessao_id').eq('sessao_id', sessaoId).order('aluno_id')
  if (error) throw error
  return data!
}

const semId = (s: Sessao[]) => s.map(({ id: _id, ...resto }) => resto)
const mesmoInstante = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime()

// ------------------------------------------------------------------ testes

describe('treinador_atualizar_turma', () => {
  let treinador: Usuario
  let alunos: Usuario[]

  beforeAll(async () => {
    treinador = await criarUsuario('treinador')
    alunos = [await criarUsuario('aluno'), await criarUsuario('aluno'), await criarUsuario('aluno')]
  })

  beforeEach(async () => {
    await limparDados()
    await definirConfig('janela_geracao_semanas', '4')
    await definirConfig('limite_bloqueio_min', '60')
    await definirConfig('fuso', FUSO)
  })

  // ---------------------------------------------------------------- permissões e validação

  it('anônimo recebe permission denied; aluno e usuário sem perfil recebem acesso_negado; nada muda', async () => {
    const { turma, sessoes } = await prepararTurma()
    const mudanca = { dia_semana: diaDaqui(3), hora_inicio: '07:00', vagas: 99, nome: 'Pirata' }

    const anon = await atualizar(clienteAnonimo(), turma, mudanca)
    expect(anon.error!.message).toMatch(/permission denied/i)

    const aluno = await atualizar(alunos[0]!.cliente, turma, mudanca)
    expect(aluno.error!.message).toBe('acesso_negado')

    const semPerfil = await criarAuthSemPerfil()
    const r = await atualizar(semPerfil.cliente, turma, mudanca)
    expect(r.error!.message).toBe('acesso_negado')

    expect(await turmaNoBanco(turma.id)).toEqual({
      nome: 'Funcional', dia_semana: turma.dia_semana, hora_inicio: '06:00:00', duracao_min: 60, vagas: 10,
    })
    expect(await sessoesDa(turma.id)).toEqual(sessoes)
  })

  it('valida os campos com códigos claros e não altera nada', async () => {
    const { turma, sessoes } = await prepararTurma()
    const casos: [Parameters<typeof atualizar>[2], string][] = [
      [{ nome: '   ' }, 'turma_nome_obrigatorio'],
      [{ dia_semana: 7 }, 'turma_dia_invalido'],
      [{ dia_semana: -1 }, 'turma_dia_invalido'],
      [{ hora_inicio: null as unknown as string }, 'turma_hora_obrigatoria'],
      [{ duracao_min: 0 }, 'turma_duracao_invalida'],
      [{ vagas: 0 }, 'turma_vagas_invalidas'],
      [{ vagas: -5 }, 'turma_vagas_invalidas'],
    ]
    for (const [mudanca, codigo] of casos) {
      const { error } = await atualizar(treinador.cliente, turma, mudanca)
      expect(error?.message, JSON.stringify(mudanca)).toBe(codigo)
    }
    const inexistente = await atualizar(treinador.cliente, { ...turma, id: '00000000-0000-0000-0000-000000000000' })
    expect(inexistente.error!.message).toBe('turma_inexistente')

    expect((await turmaNoBanco(turma.id)).hora_inicio).toBe('06:00:00')
    expect(await sessoesDa(turma.id)).toEqual(sessoes)
  })

  it('treinador não muda dia/horário direto na tabela (só pela RPC); nome e vagas seguem editáveis', async () => {
    const { turma } = await prepararTurma()
    const dia = await treinador.cliente.from('turmas').update({ dia_semana: diaDaqui(3) }).eq('id', turma.id)
    expect(dia.error!.message).toMatch(/permission denied/i)
    const hora = await treinador.cliente.from('turmas').update({ hora_inicio: '07:00' }).eq('id', turma.id)
    expect(hora.error!.message).toMatch(/permission denied/i)
    const ok = await treinador.cliente.from('turmas').update({ vagas: 12, nome: 'Outro' }).eq('id', turma.id)
    expect(ok.error).toBeNull()
    expect(await turmaNoBanco(turma.id)).toMatchObject({ dia_semana: turma.dia_semana, hora_inicio: '06:00:00', vagas: 12 })
  })

  // ---------------------------------------------------------------- mover dia/horário

  it('move as aulas futuras sem check-in para o novo dia e horário local de SP, mantendo os ids', async () => {
    const { turma, sessoes } = await prepararTurma({ diasAFrente: 2 })

    const { data, error } = await atualizar(treinador.cliente, turma, {
      nome: '  Funcional Tarde  ', dia_semana: diaDaqui(3), hora_inicio: '19:30', duracao_min: 45,
    })
    expect(error).toBeNull()
    const r = data as Relatorio
    expect(r).toMatchObject({ movidas: 4, atualizadas: 4, removidas: 0, criadas: 0, preservadas: [], canceladas: [] })
    expect(r.turma).toMatchObject({ nome: 'Funcional Tarde', dia_semana: diaDaqui(3), hora_inicio: '19:30:00', duracao_min: 45, vagas: 10 })

    const depois = await sessoesDa(turma.id)
    expect(depois.map((s) => s.id)).toEqual(sessoes.map((s) => s.id))
    expect(depois.map((s) => localSP(s.inicia_em))).toEqual(
      datasDaqui(3, 10, 17, 24).map((data) => ({ data, hora: '19:30' })),
    )
    // 19:30 em SP (UTC-3, sem horário de verão) = 22:30 UTC.
    expect(new Date(depois[0]!.inicia_em).getUTCHours()).toBe(22)

    // Rodar a geração de novo não cria nada (nem no horário antigo, nem duplicada).
    const g = await admin.rpc('gerar_sessoes')
    expect(g.data).toBe(0)
    expect(await sessoesDa(turma.id)).toEqual(depois)
  })

  it('aulas com confirmado ou na espera são preservadas e voltam no relatório; check-ins intactos', async () => {
    const { turma, sessoes } = await prepararTurma({ vagas: 1 })
    const [s0, s1, s2, s3] = sessoes
    const [a0, a1, a2] = alunos

    expect((await a0!.cliente.rpc('fazer_checkin', { p_sessao_id: s0!.id })).error).toBeNull()
    // Só alguém na espera (estado montado direto: é a regra "espera também preserva").
    const esp = await admin.from('checkins').insert({ sessao_id: s1!.id, aluno_id: a1!.id, status: 'espera', posicao_fila: 1 })
    expect(esp.error).toBeNull()
    // Só um check-in cancelado: a aula pode mover, e o histórico vai junto (mesmo id).
    expect((await a2!.cliente.rpc('fazer_checkin', { p_sessao_id: s2!.id })).error).toBeNull()
    expect((await a2!.cliente.rpc('cancelar_checkin', { p_sessao_id: s2!.id })).error).toBeNull()

    const { data, error } = await atualizar(treinador.cliente, turma, { dia_semana: diaDaqui(3), hora_inicio: '07:00' })
    expect(error).toBeNull()
    const r = data as Relatorio
    expect(r.movidas).toBe(2)
    expect(r.removidas).toBe(0)
    expect(r.criadas).toBe(2) // semanas das preservadas ganham a aula no horário novo
    expect(r.preservadas.map((p) => ({ ...p, inicia_em: new Date(p.inicia_em).toISOString() }))).toEqual([
      { id: s0!.id, inicia_em: new Date(s0!.inicia_em).toISOString(), vagas: 1, confirmados: 1, na_espera: 0 },
      { id: s1!.id, inicia_em: new Date(s1!.inicia_em).toISOString(), vagas: 1, confirmados: 0, na_espera: 1 },
    ])

    const depois = await sessoesDa(turma.id)
    const porId = new Map(depois.map((s) => [s.id, s]))
    expect(porId.get(s0!.id)).toEqual(s0)
    expect(porId.get(s1!.id)).toEqual(s1)
    expect(localSP(porId.get(s2!.id)!.inicia_em)).toEqual({ data: datasDaqui(17)[0], hora: '07:00' })
    expect(localSP(porId.get(s3!.id)!.inicia_em)).toEqual({ data: datasDaqui(24)[0], hora: '07:00' })

    const novas = depois.filter((s) => localSP(s.inicia_em).hora === '07:00')
    expect(novas.map((s) => localSP(s.inicia_em).data)).toEqual(datasDaqui(3, 10, 17, 24))
    const antigas = depois.filter((s) => localSP(s.inicia_em).hora === '06:00')
    expect(antigas.map((s) => s.id)).toEqual([s0!.id, s1!.id])

    expect(await checkinsDe(s0!.id)).toEqual([{ aluno_id: a0!.id, status: 'confirmado', sessao_id: s0!.id }])
    expect(await checkinsDe(s1!.id)).toEqual([{ aluno_id: a1!.id, status: 'espera', sessao_id: s1!.id }])
    expect(await checkinsDe(s2!.id)).toEqual([{ aluno_id: a2!.id, status: 'cancelado', sessao_id: s2!.id }])

    const g = await admin.rpc('gerar_sessoes')
    expect(g.data).toBe(0)
    expect(await sessoesDa(turma.id)).toEqual(depois)
  })

  it('aulas canceladas ficam intactas e voltam em `canceladas` quando o horário muda', async () => {
    const { turma, sessoes } = await prepararTurma()
    const c = await treinador.cliente.rpc('treinador_cancelar_sessao', { p_sessao_id: sessoes[1]!.id, p_observacao: 'Feriado' })
    expect(c.error).toBeNull()
    const [cancelada] = (await sessoesDa(turma.id)).filter((s) => s.cancelada)

    const { data, error } = await atualizar(treinador.cliente, turma, { dia_semana: diaDaqui(3), hora_inicio: '07:00', vagas: 20 })
    expect(error).toBeNull()
    const r = data as Relatorio
    expect(r.canceladas.map((x) => x.id)).toEqual([sessoes[1]!.id])
    expect(r).toMatchObject({ movidas: 3, removidas: 0, criadas: 1, preservadas: [] })

    const depois = await sessoesDa(turma.id)
    expect(depois.find((s) => s.id === cancelada!.id)).toEqual(cancelada)
    expect(cancelada).toMatchObject({ cancelada: true, observacao: 'Feriado', vagas: 10 })
  })

  it('mudar só as vagas atualiza as aulas futuras sem check-in; preservadas e canceladas mantêm as antigas', async () => {
    const { turma, sessoes } = await prepararTurma({ vagas: 10 })
    await alunos[0]!.cliente.rpc('fazer_checkin', { p_sessao_id: sessoes[0]!.id })
    await treinador.cliente.rpc('treinador_cancelar_sessao', { p_sessao_id: sessoes[3]!.id, p_observacao: 'x' })
    const antes = await sessoesDa(turma.id)

    const { data, error } = await atualizar(treinador.cliente, turma, { vagas: 14 })
    expect(error).toBeNull()
    const r = data as Relatorio
    expect(r).toMatchObject({ movidas: 0, atualizadas: 2, removidas: 0, criadas: 0, canceladas: [] })
    expect(r.preservadas.map((p) => [p.id, p.vagas, p.confirmados])).toEqual([[sessoes[0]!.id, 10, 1]])

    const depois = await sessoesDa(turma.id)
    expect(depois.map((s) => s.id)).toEqual(antes.map((s) => s.id))
    expect(depois.map((s) => s.inicia_em)).toEqual(antes.map((s) => s.inicia_em))
    expect(depois.map((s) => s.vagas)).toEqual([10, 14, 14, 10])
    expect(depois[3]!.cancelada).toBe(true)

    // Só nome: nenhuma aula é tocada; a preservada continua sinalizada (segue com 10 vagas).
    const so = await atualizar(treinador.cliente, { ...turma, vagas: 14 }, { nome: 'Renomeada' })
    expect(so.error).toBeNull()
    expect(so.data).toMatchObject({ movidas: 0, atualizadas: 0, removidas: 0, criadas: 0 })
    expect(await sessoesDa(turma.id)).toEqual(depois)
  })

  it('aulas passadas não são tocadas', async () => {
    const { turma } = await prepararTurma()
    const agora = Date.now()
    const { data: passadas, error } = await admin.from('sessoes').insert([
      { turma_id: turma.id, inicia_em: new Date(agora - 5 * 86_400_000).toISOString(), vagas: 10 },
      { turma_id: turma.id, inicia_em: new Date(agora - 12 * 86_400_000).toISOString(), vagas: 10 },
    ]).select('id, inicia_em, vagas, cancelada, observacao')
    expect(error).toBeNull()
    await admin.from('checkins').insert({ sessao_id: passadas![0]!.id, aluno_id: alunos[0]!.id, status: 'confirmado' })

    const r = await atualizar(treinador.cliente, turma, { dia_semana: diaDaqui(3), hora_inicio: '07:00', vagas: 3 })
    expect(r.error).toBeNull()

    const depois = await sessoesDa(turma.id)
    for (const p of passadas as Sessao[]) expect(depois.find((s) => s.id === p.id)).toEqual(p)
    expect(await checkinsDe(passadas![0]!.id)).toHaveLength(1)
  })

  it('mudar de dia leva cada aula para a próxima ocorrência do novo dia (nunca para trás)', async () => {
    // De +3 para o dia de +1: cada aula anda 5 dias para frente (+3 -> +8 ...); a de +1 é criada.
    const { turma, sessoes } = await prepararTurma({ diasAFrente: 3 })
    const { data, error } = await atualizar(treinador.cliente, turma, { dia_semana: diaDaqui(1) })
    expect(error).toBeNull()
    expect(data).toMatchObject({ movidas: 4, removidas: 0, criadas: 1, preservadas: [] })

    const depois = await sessoesDa(turma.id)
    expect(depois.map((s) => localSP(s.inicia_em))).toEqual(
      datasDaqui(1, 8, 15, 22, 29).map((d) => ({ data: d, hora: '06:00' })),
    )
    expect(depois.slice(1).map((s) => s.id)).toEqual(sessoes.map((s) => s.id))
    expect((await admin.rpc('gerar_sessoes')).data).toBe(0)
  })

  it('aula cujo novo horário no mesmo dia já passou é apagada', async (ctx) => {
    // Precisa de uma aula hoje às 23:59 que ainda não começou.
    if (localSP(new Date()).hora >= '23:50') ctx.skip()
    const { turma, sessoes } = await prepararTurma({ diasAFrente: 0, hora: '23:59' })
    expect(sessoes).toHaveLength(5) // hoje, +7, +14, +21, +28

    const { data, error } = await atualizar(treinador.cliente, turma, { hora_inicio: '00:00' })
    expect(error).toBeNull()
    expect(data).toMatchObject({ movidas: 4, removidas: 1, criadas: 0, preservadas: [] })

    const depois = await sessoesDa(turma.id)
    expect(depois.map((s) => localSP(s.inicia_em))).toEqual(datasDaqui(7, 14, 21, 28).map((d) => ({ data: d, hora: '00:00' })))
    expect(depois.map((s) => s.id)).toEqual(sessoes.slice(1).map((s) => s.id))
  })

  it('voltar ao horário antigo não colide com a aula preservada (unique turma_id, inicia_em)', async () => {
    const { turma, sessoes } = await prepararTurma()
    await alunos[0]!.cliente.rpc('fazer_checkin', { p_sessao_id: sessoes[0]!.id })

    const ida = await atualizar(treinador.cliente, turma, { hora_inicio: '07:00' })
    expect(ida.error).toBeNull()
    expect(ida.data).toMatchObject({ movidas: 3, criadas: 1 })
    expect(await sessoesDa(turma.id)).toHaveLength(5)

    // A aula das 07:00 da 1ª semana cairia exatamente sobre a preservada das 06:00.
    const volta = await atualizar(treinador.cliente, { ...turma, hora_inicio: '07:00' }, { hora_inicio: '06:00' })
    expect(volta.error).toBeNull()
    expect(volta.data).toMatchObject({ movidas: 3, removidas: 1, criadas: 0, preservadas: [] })

    const depois = await sessoesDa(turma.id)
    expect(depois.map((s) => s.id)).toEqual(sessoes.map((s) => s.id))
    expect(semId(depois)).toEqual(semId(sessoes))
    expect(await checkinsDe(sessoes[0]!.id)).toHaveLength(1)
  })

  // ---------------------------------------------------------------- concorrência

  it('check-in concorrente com a mudança de horário nunca some (qualquer ordem)', async () => {
    for (let i = 0; i < 4; i++) {
      await limparDados()
      const { turma, sessoes } = await prepararTurma()
      const alvo = sessoes[0]!
      const aluno = alunos[i % alunos.length]!

      const [ck, rpc] = await Promise.all([
        aluno.cliente.rpc('fazer_checkin', { p_sessao_id: alvo.id }),
        atualizar(treinador.cliente, turma, { dia_semana: diaDaqui(3), hora_inicio: '07:00' }),
      ])
      expect(ck.error).toBeNull()
      expect(ck.data).toMatchObject({ status: 'confirmado' })
      expect(rpc.error).toBeNull()
      const r = rpc.data as Relatorio

      const { data: todos } = await admin.from('checkins').select('sessao_id, aluno_id, status')
      expect(todos).toEqual([{ sessao_id: alvo.id, aluno_id: aluno.id, status: 'confirmado' }])

      const depois = await sessoesDa(turma.id)
      const s = depois.find((x) => x.id === alvo.id)!
      expect(s.cancelada).toBe(false)
      if (mesmoInstante(s.inicia_em, alvo.inicia_em)) {
        // O check-in chegou antes: aula preservada, sinalizada, e a semana ganhou a das 07:00.
        expect(r.preservadas.map((p) => p.id)).toEqual([alvo.id])
      } else {
        // A RPC chegou antes: o check-in esperou e caiu na mesma aula, já movida.
        expect(localSP(s.inicia_em)).toEqual({ data: datasDaqui(3)[0], hora: '07:00' })
        expect(r.preservadas).toEqual([])
      }
      const novas = depois.filter((x) => localSP(x.inicia_em).hora === '07:00').map((x) => localSP(x.inicia_em).data)
      expect(novas).toEqual(datasDaqui(3, 10, 17, 24))
    }
  })

  it('check-in concorrente com a remoção da aula nunca é apagado em cascata', async () => {
    for (let i = 0; i < 4; i++) {
      await limparDados()
      const { turma, sessoes } = await prepararTurma()
      const [a0, a1] = alunos
      // Âncora: aula das 06:00 da 1ª semana com check-in (fica preservada na ida).
      expect((await a0!.cliente.rpc('fazer_checkin', { p_sessao_id: sessoes[0]!.id })).error).toBeNull()
      const ida = await atualizar(treinador.cliente, turma, { hora_inicio: '07:00' })
      expect(ida.error).toBeNull()
      const alvo = (await sessoesDa(turma.id)).find((s) =>
        localSP(s.inicia_em).hora === '07:00' && localSP(s.inicia_em).data === localSP(sessoes[0]!.inicia_em).data)!
      expect(alvo).toBeDefined()

      // Na volta para 06:00, a aula `alvo` (sem check-in) cairia sobre a âncora: é apagada,
      // a não ser que o check-in concorrente entre antes (aí ela é preservada).
      const [ck, rpc] = await Promise.all([
        a1!.cliente.rpc('fazer_checkin', { p_sessao_id: alvo.id }),
        atualizar(treinador.cliente, { ...turma, hora_inicio: '07:00' }, { hora_inicio: '06:00' }),
      ])
      expect(rpc.error).toBeNull()
      const r = rpc.data as Relatorio
      const { data: doAluno } = await admin.from('checkins').select('sessao_id, status').eq('aluno_id', a1!.id)
      const existe = (await sessoesDa(turma.id)).some((s) => s.id === alvo.id)
      expect(await checkinsDe(sessoes[0]!.id)).toHaveLength(1)

      if (ck.error) {
        // A RPC venceu: a aula foi apagada antes do check-in, que falhou de forma limpa.
        expect(ck.error.message).toBe('sessao_inexistente')
        expect(existe).toBe(false)
        expect(doAluno).toEqual([])
        expect(r.removidas).toBe(1)
      } else {
        // O check-in venceu: a aula ficou, com ele, e foi sinalizada.
        expect(existe).toBe(true)
        expect(doAluno).toEqual([{ sessao_id: alvo.id, status: 'confirmado' }])
        expect(r.preservadas.map((p) => p.id)).toEqual([alvo.id])
        expect(r.removidas).toBe(0)
      }
    }
  })
})
