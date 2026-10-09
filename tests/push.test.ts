import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, limparDados } from './helpers/db'

const PERMISSAO = /permission denied|row-level security/i
const chaves = { p256dh: 'chave-publica', auth: 'segredo' }
const endpoint = (sufixo: string) => `https://push.exemplo/${sufixo}`

async function inscricoesDe(perfilId: string) {
  const { data, error } = await admin.from('inscricoes_push')
    .select('endpoint, chaves, perfil_id').eq('perfil_id', perfilId).order('endpoint')
  if (error) throw error
  return data!
}

describe('inscrições de push', () => {
  beforeEach(limparDados)

  it('aluno registra o próprio aparelho e lê só o que é dele', async () => {
    const ana = await criarUsuario('aluno')
    const bruno = await criarUsuario('aluno')
    expect((await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('ana'), p_chaves: chaves })).error).toBeNull()
    expect((await bruno.cliente.rpc('registrar_push', { p_endpoint: endpoint('bruno'), p_chaves: chaves })).error).toBeNull()

    const { data } = await ana.cliente.from('inscricoes_push').select('endpoint')
    expect(data).toEqual([{ endpoint: endpoint('ana') }])
  })

  it('registrar duas vezes o mesmo aparelho não duplica', async () => {
    const ana = await criarUsuario('aluno')
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('a'), p_chaves: chaves })
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('a'), p_chaves: { p256dh: 'nova', auth: 'nova' } })
    const todas = await inscricoesDe(ana.id)
    expect(todas).toHaveLength(1)
    expect(todas[0].chaves).toEqual({ p256dh: 'nova', auth: 'nova' })
  })

  it('aparelho compartilhado: quem registra por último passa a ser o dono', async () => {
    const ana = await criarUsuario('aluno')
    const bruno = await criarUsuario('aluno')
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('celular'), p_chaves: chaves })
    await bruno.cliente.rpc('registrar_push', { p_endpoint: endpoint('celular'), p_chaves: chaves })
    expect(await inscricoesDe(ana.id)).toHaveLength(0)
    expect(await inscricoesDe(bruno.id)).toHaveLength(1)
  })

  it.each([
    ['endpoint sem https', 'http://push.exemplo/x', chaves],
    ['endpoint vazio', '', chaves],
    ['sem chaves', 'https://push.exemplo/x', {}],
    ['sem auth', 'https://push.exemplo/x', { p256dh: 'x' }],
    ['chaves vazias', 'https://push.exemplo/x', { p256dh: '', auth: '' }],
  ])('rejeita inscrição inválida: %s', async (_nome, ep, ch) => {
    const ana = await criarUsuario('aluno')
    const { error } = await ana.cliente.rpc('registrar_push', { p_endpoint: ep, p_chaves: ch })
    expect(error?.message).toMatch(/push_invalido/)
    expect(await inscricoesDe(ana.id)).toHaveLength(0)
  })

  it('guarda só os campos esperados das chaves', async () => {
    const ana = await criarUsuario('aluno')
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('a'), p_chaves: { ...chaves, extra: 'lixo' } })
    expect((await inscricoesDe(ana.id))[0].chaves).toEqual(chaves)
  })

  it('mantém no máximo 10 aparelhos por pessoa, os mais recentes', async () => {
    const ana = await criarUsuario('aluno')
    for (let i = 1; i <= 12; i++) {
      await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint(`d${String(i).padStart(2, '0')}`), p_chaves: chaves })
    }
    const eps = (await inscricoesDe(ana.id)).map((i) => i.endpoint)
    expect(eps).toHaveLength(10)
    expect(eps).not.toContain(endpoint('d01'))
    expect(eps).toContain(endpoint('d12'))
  })

  it('remover_push apaga só o aparelho do próprio usuário', async () => {
    const ana = await criarUsuario('aluno')
    const bruno = await criarUsuario('aluno')
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('ana'), p_chaves: chaves })
    await bruno.cliente.rpc('registrar_push', { p_endpoint: endpoint('bruno'), p_chaves: chaves })

    const alheio = await bruno.cliente.rpc('remover_push', { p_endpoint: endpoint('ana') })
    expect(alheio.error).toBeNull()
    expect(alheio.data).toBe(0)
    expect(await inscricoesDe(ana.id)).toHaveLength(1)

    const proprio = await ana.cliente.rpc('remover_push', { p_endpoint: endpoint('ana') })
    expect(proprio.data).toBe(1)
    expect(await inscricoesDe(ana.id)).toHaveLength(0)
  })

  it('o cliente não escreve direto na tabela', async () => {
    const ana = await criarUsuario('aluno')
    const ins = await ana.cliente.from('inscricoes_push')
      .insert({ perfil_id: ana.id, endpoint: endpoint('direto'), chaves })
    expect(ins.error?.message).toMatch(PERMISSAO)

    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('a'), p_chaves: chaves })
    const upd = await ana.cliente.from('inscricoes_push').update({ endpoint: endpoint('b') }).eq('perfil_id', ana.id)
    expect(upd.error?.message).toMatch(PERMISSAO)
    const del = await ana.cliente.from('inscricoes_push').delete().eq('perfil_id', ana.id)
    expect(del.error?.message).toMatch(PERMISSAO)
    expect(await inscricoesDe(ana.id)).toHaveLength(1)
  })

  it('apagar o perfil leva as inscrições junto', async () => {
    const ana = await criarUsuario('aluno')
    await ana.cliente.rpc('registrar_push', { p_endpoint: endpoint('a'), p_chaves: chaves })
    await admin.from('perfis').delete().eq('id', ana.id)
    const { data } = await admin.from('inscricoes_push').select('id').eq('endpoint', endpoint('a'))
    expect(data).toEqual([])
  })
})

describe('fila de envio de push', () => {
  beforeEach(limparDados)

  it('notificação nasce com push pendente', async () => {
    const ana = await criarUsuario('aluno')
    await admin.from('notificacoes').insert({ perfil_id: ana.id, titulo: 'Teste', corpo: 'Corpo' })
    const { data } = await admin.from('notificacoes').select('enviado_push_em').eq('perfil_id', ana.id).single()
    expect(data!.enviado_push_em).toBeNull()
  })

  it('marcar_push_enviado tira da fila só as pendentes pedidas', async () => {
    const ana = await criarUsuario('aluno')
    const { data: nova } = await admin.from('notificacoes')
      .insert([
        { perfil_id: ana.id, titulo: 'A', corpo: 'a' },
        { perfil_id: ana.id, titulo: 'B', corpo: 'b' },
      ]).select()
    const [a, b] = nova!

    const r = await admin.rpc('marcar_push_enviado', { p_ids: [a.id] })
    expect(r.data).toBe(1)

    const { data } = await admin.from('notificacoes').select('id, enviado_push_em').in('id', [a.id, b.id])
    const porId = new Map(data!.map((n) => [n.id, n.enviado_push_em]))
    expect(porId.get(a.id)).not.toBeNull()
    expect(porId.get(b.id)).toBeNull()

    // Já enviada: não conta de novo e não muda o horário.
    const de_novo = await admin.rpc('marcar_push_enviado', { p_ids: [a.id] })
    expect(de_novo.data).toBe(0)
  })

  it('só o service_role marca como enviado ou aciona o envio', async () => {
    const ana = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    for (const u of [ana, treinador]) {
      const m = await u.cliente.rpc('marcar_push_enviado', { p_ids: [] })
      expect(m.error?.message).toMatch(PERMISSAO)
      const d = await u.cliente.rpc('disparar_envio_push')
      expect(d.error?.message).toMatch(PERMISSAO)
    }
  })

  it('sem nada pendente, disparar_envio_push não chama a função', async () => {
    const { data, error } = await admin.rpc('disparar_envio_push')
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('o job enviar-push roda a cada minuto, como o dono das funções', async () => {
    const { data, error } = await admin.rpc('debug_cron_jobs')
    expect(error).toBeNull()
    const jobs = (data as { jobs: Array<{ jobname: string; schedule: string; command: string; active: boolean; username: string }> }).jobs
    const job = jobs.filter((j) => j.jobname === 'enviar-push')
    expect(job).toHaveLength(1)
    expect(job[0].schedule).toBe('* * * * *')
    expect(job[0].command.replace(/\s+/g, ' ').trim()).toBe('select public.disparar_envio_push();')
    expect(job[0].active).toBe(true)
    expect(job[0].username).toBe('postgres')
  })
})
