import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { admin, criarUsuario, limparDados, definirConfig } from './helpers/db'

/** Soma dias a uma data ISO (AAAA-MM-DD) sem depender do fuso da máquina. */
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay()
}

/** Primeira segunda-feira estritamente depois de `data`. */
function proximaSegunda(data: string): string {
  for (let i = 1; i <= 7; i++) {
    const candidata = somarDias(data, i)
    if (diaDaSemana(candidata) === 1) return candidata
  }
  throw new Error('inalcançável')
}

/**
 * "Agora" do Postgres, não do PC: o criado_em de uma linha recém-inserida.
 * Usa uma turma descartável (turmas é limpa por limparDados de qualquer jeito).
 */
async function agoraServidor(): Promise<Date> {
  const { data, error } = await admin.from('turmas')
    .insert({ nome: 'Relógio', dia_semana: 0, hora_inicio: '00:00', vagas: 1 })
    .select('id, criado_em').single()
  if (error) throw error
  await admin.from('turmas').delete().eq('id', data!.id)
  return new Date(data!.criado_em)
}

/** Data, dia da semana e hora de um instante em America/Sao_Paulo. */
function partesSP(instante: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante).map(x => [x.type, x.value]))
  const data = `${p.year}-${p.month}-${p.day}`
  return { data, dow: diaDaSemana(data), hora: Number(p.hour) }
}

async function inserirTreino(data: string, titulo = 'Treino') {
  const { error } = await admin.from('treinos').insert({ data, titulo, descricao: 'Circuito' })
  if (error) throw error
}

async function datasPublicadas(): Promise<string[]> {
  const { data, error } = await admin.from('treinos')
    .select('data').not('publicado_em', 'is', null).order('data')
  if (error) throw error
  return data!.map(t => t.data)
}

async function notificacoesDe(perfilId: string): Promise<number> {
  const { count, error } = await admin.from('notificacoes')
    .select('*', { count: 'exact', head: true }).eq('perfil_id', perfilId)
  if (error) throw error
  return count!
}

// Sábado 26/09/2026 às 08:00 em São Paulo (UTC-3, sem horário de verão desde 2019).
const SABADO_8H = '2026-09-26T08:00:00-03:00'

describe('treinos e spoiler da semana', () => {
  beforeEach(async () => {
    await limparDados()
    // Regra padrão do produto: sábado às 08:00.
    await definirConfig('spoiler_dia_semana', '6')
    await definirConfig('spoiler_hora', '8')
  })

  afterAll(async () => {
    await definirConfig('spoiler_dia_semana', '6')
    await definirConfig('spoiler_hora', '8')
  })

  it('regra padrão: sábado 08:00 publica a semana seguinte (segunda a domingo)', async () => {
    await inserirTreino('2026-09-28', 'Segunda')
    await inserirTreino('2026-10-04', 'Domingo')
    const { data, error } = await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })
    expect(error).toBeNull()
    expect(data).toBe(2)
    expect(await datasPublicadas()).toEqual(['2026-09-28', '2026-10-04'])
  })

  it('não publica treino da semana corrente nem da semana depois da seguinte', async () => {
    await inserirTreino('2026-09-26', 'Hoje (sábado)')
    await inserirTreino('2026-09-27', 'Domingo desta semana')
    await inserirTreino('2026-09-28', 'Segunda que vem')
    await inserirTreino('2026-10-05', 'Segunda depois da que vem')
    const { data } = await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })
    expect(data).toBe(1)
    expect(await datasPublicadas()).toEqual(['2026-09-28'])
  })

  // Para cada dia da semana em que o spoiler pode estar configurado,
  // a janela publicada é sempre a PRÓXIMA segunda até o domingo seguinte.
  const casos: Array<[string, number, string]> = [
    ['2026-09-20', 0, '2026-09-21'], // domingo  -> amanhã
    ['2026-09-21', 1, '2026-09-28'], // segunda  -> daqui a 7 dias (não hoje)
    ['2026-09-22', 2, '2026-09-28'],
    ['2026-09-23', 3, '2026-09-28'],
    ['2026-09-24', 4, '2026-09-28'],
    ['2026-09-25', 5, '2026-09-28'],
    ['2026-09-26', 6, '2026-09-28'], // sábado   -> depois de amanhã
  ]
  it.each(casos)('rodando em %s (dia %i) publica de %s até o domingo seguinte', async (hoje, dow, segunda) => {
    await definirConfig('spoiler_dia_semana', String(dow))
    for (let i = 0; i < 28; i++) await inserirTreino(somarDias('2026-09-14', i), `T${i}`)

    const { data, error } = await admin.rpc('publicar_treinos_semana', { p_agora: `${hoje}T08:00:00-03:00` })
    expect(error).toBeNull()
    expect(data).toBe(7)
    const esperado = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
    expect(await datasPublicadas()).toEqual(esperado)
  })

  it('usa o fuso de São Paulo, não UTC', async () => {
    // Domingo 02:00 UTC = sábado 23:00 em São Paulo.
    await definirConfig('spoiler_hora', '23')
    await inserirTreino('2026-09-28')
    const { data } = await admin.rpc('publicar_treinos_semana', { p_agora: '2026-09-27T02:00:00Z' })
    expect(data).toBe(1)
  })

  it('não faz nada um minuto antes da hora configurada', async () => {
    await inserirTreino('2026-09-28')
    const { data } = await admin.rpc('publicar_treinos_semana', { p_agora: '2026-09-26T07:59:00-03:00' })
    expect(data).toBe(0)
    expect(await datasPublicadas()).toEqual([])
  })

  it('não faz nada em outro dia da semana', async () => {
    await inserirTreino('2026-09-28')
    const { data } = await admin.rpc('publicar_treinos_semana', { p_agora: '2026-09-25T08:00:00-03:00' })
    expect(data).toBe(0)
  })

  it('notifica todos os alunos ativos quando publica, e só eles', async () => {
    const aluno = await criarUsuario('aluno')
    const inativo = await criarUsuario('aluno', { ativo: false })
    const treinador = await criarUsuario('treinador')
    await inserirTreino('2026-09-28', 'Core')
    await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })

    // Perfis de outros testes persistem no banco: conta só os deste teste.
    expect(await notificacoesDe(aluno.id)).toBe(1)
    expect(await notificacoesDe(inativo.id)).toBe(0)
    expect(await notificacoesDe(treinador.id)).toBe(0)

    const { data } = await admin.from('notificacoes').select('titulo').eq('perfil_id', aluno.id).single()
    expect(data!.titulo).toContain('Treinos da semana')
  })

  it('não notifica quando não há treino cadastrado', async () => {
    await criarUsuario('aluno')
    const { data } = await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })
    expect(data).toBe(0)

    const { count } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('é idempotente: rodar de novo não republica nem notifica', async () => {
    const aluno = await criarUsuario('aluno')
    await inserirTreino('2026-09-28', 'Pernas')
    await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })
    const { count: totalAntes } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })

    const segunda = await admin.rpc('publicar_treinos_semana', { p_agora: SABADO_8H })
    expect(segunda.data).toBe(0)

    const { count: totalDepois } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })
    expect(totalDepois).toBe(totalAntes)
    expect(await notificacoesDe(aluno.id)).toBe(1)
  })

  it('sem p_agora usa o relógio do banco (fuso de São Paulo)', async () => {
    const antes = partesSP(await agoraServidor())
    await definirConfig('spoiler_dia_semana', String(antes.dow))
    await definirConfig('spoiler_hora', String(antes.hora))
    await inserirTreino(proximaSegunda(antes.data))

    const { data, error } = await admin.rpc('publicar_treinos_semana')
    const depois = partesSP(await agoraServidor())
    expect(error).toBeNull()
    if (depois.data === antes.data && depois.hora === antes.hora) {
      expect(data).toBe(1)
    } else {
      // A hora virou entre a leitura do relógio e a chamada: qualquer resultado é legítimo.
      expect([0, 1]).toContain(data)
    }
  })

  it('sem p_agora, fora da hora configurada não faz nada', async () => {
    const agora = partesSP(await agoraServidor())
    await definirConfig('spoiler_dia_semana', String(agora.dow))
    await definirConfig('spoiler_hora', String((agora.hora + 3) % 24))
    await inserirTreino(proximaSegunda(agora.data))
    const { data } = await admin.rpc('publicar_treinos_semana')
    expect(data).toBe(0)
  })

  it('é interna: aluno e treinador autenticados não podem chamá-la', async () => {
    const aluno = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    for (const u of [aluno, treinador]) {
      const { error } = await u.cliente.rpc('publicar_treinos_semana')
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/permission denied/i)
    }
  })
})
