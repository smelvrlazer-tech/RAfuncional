import { describe, it, expect } from 'vitest'
import {
  classificarFalha, montarPayload, processar, VALIDADE_MS, type Dependencias, type Inscricao, type Notificacao,
} from '../supabase/functions/enviar-push/logica'

// Testes da lógica pura do envio: sem banco, sem rede.

const AGORA = new Date('2026-10-09T12:00:00Z')

function notif(id: string, perfil: string, p: Partial<Notificacao> = {}): Notificacao {
  return { id, perfil_id: perfil, titulo: `T${id}`, corpo: `C${id}`, link: `/sessao/${id}`, criado_em: '2026-10-09T11:59:00Z', ...p }
}
function insc(id: string, perfil: string): Inscricao {
  return { id, perfil_id: perfil, endpoint: `https://push.exemplo/${id}`, chaves: { p256dh: 'p', auth: 'a' } }
}

/** `falhas`: id da inscrição -> statusCode do erro (ou 'rede' para erro sem status). */
function montar(pendentes: Notificacao[], inscricoes: Inscricao[], falhas: Record<string, number | 'rede'> = {}) {
  const chamadas = { enviados: [] as Array<{ inscricao: string; payload: unknown }>, removidas: [] as string[], marcadas: [] as string[], logs: 0 }
  const deps: Dependencias = {
    listarPendentes: async () => pendentes,
    listarInscricoes: async (perfis) => inscricoes.filter((i) => perfis.includes(i.perfil_id)),
    enviar: async (i, payload) => {
      const f = falhas[i.id]
      if (f !== undefined) throw f === 'rede' ? new Error('ECONNRESET') : Object.assign(new Error('push'), { statusCode: f })
      chamadas.enviados.push({ inscricao: i.id, payload: JSON.parse(payload) })
    },
    removerInscricoes: async (ids) => { chamadas.removidas.push(...ids) },
    marcarEnviadas: async (ids) => { chamadas.marcadas.push(...ids) },
    agora: () => AGORA,
    log: () => { chamadas.logs++ },
  }
  return { deps, chamadas }
}

describe('classificarFalha', () => {
  it.each([
    [404, 'morta'], [410, 'morta'],
    [429, 'transitoria'], [500, 'transitoria'], [503, 'transitoria'],
    [400, 'rejeitada'], [401, 'rejeitada'], [403, 'rejeitada'], [413, 'rejeitada'],
  ])('status %i -> %s', (status, esperado) => {
    expect(classificarFalha({ statusCode: status })).toBe(esperado)
  })

  it('erro sem status (rede, timeout) é passageiro', () => {
    expect(classificarFalha(new Error('ECONNRESET'))).toBe('transitoria')
    expect(classificarFalha(null)).toBe('transitoria')
  })
})

describe('montarPayload', () => {
  it('leva id, título, corpo e link', () => {
    expect(JSON.parse(montarPayload(notif('1', 'p')))).toEqual({ id: '1', titulo: 'T1', corpo: 'C1', link: '/sessao/1' })
  })
  it('sem link, abre a agenda', () => {
    expect(JSON.parse(montarPayload(notif('1', 'p', { link: null }))).link).toBe('/')
  })
})

describe('processar', () => {
  it('fila vazia: não faz nada', async () => {
    const { deps, chamadas } = montar([], [])
    expect(await processar(deps)).toEqual({ pendentes: 0, marcadas: 0, pushes: 0, removidas: 0, adiadas: 0, vencidas: 0 })
    expect(chamadas.marcadas).toEqual([])
  })

  it('envia para todos os aparelhos de quem recebe e tira da fila', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [insc('a1', 'ana'), insc('a2', 'ana'), insc('b1', 'bruno')])
    const r = await processar(deps)
    expect(chamadas.enviados.map((e) => e.inscricao).sort()).toEqual(['a1', 'a2'])
    expect(chamadas.enviados[0].payload).toMatchObject({ id: '1', titulo: 'T1' })
    expect(chamadas.marcadas).toEqual(['1'])
    expect(r).toMatchObject({ pendentes: 1, marcadas: 1, pushes: 2, removidas: 0, adiadas: 0 })
  })

  it('cada notificação vai só para os aparelhos do próprio destinatário', async () => {
    const { deps, chamadas } = montar(
      [notif('1', 'ana'), notif('2', 'bruno')],
      [insc('a1', 'ana'), insc('b1', 'bruno')],
    )
    await processar(deps)
    const por = Object.fromEntries(chamadas.enviados.map((e) => [e.inscricao, (e.payload as { id: string }).id]))
    expect(por).toEqual({ a1: '1', b1: '2' })
  })

  it('sem aparelho inscrito: sai da fila (o sino é o fallback)', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [])
    const r = await processar(deps)
    expect(chamadas.enviados).toEqual([])
    expect(chamadas.marcadas).toEqual(['1'])
    expect(r.marcadas).toBe(1)
  })

  it('inscrição expirada (410) é apagada e a notificação sai da fila', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [insc('a1', 'ana')], { a1: 410 })
    const r = await processar(deps)
    expect(chamadas.removidas).toEqual(['a1'])
    expect(chamadas.marcadas).toEqual(['1'])
    expect(r).toMatchObject({ removidas: 1, pushes: 0, adiadas: 0 })
  })

  it('a mesma inscrição morta em várias notificações é removida uma vez', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana'), notif('2', 'ana')], [insc('a1', 'ana')], { a1: 404 })
    await processar(deps)
    expect(chamadas.removidas).toEqual(['a1'])
  })

  it('falha passageira em todos os aparelhos: fica na fila para tentar de novo', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [insc('a1', 'ana'), insc('a2', 'ana')], { a1: 503, a2: 'rede' })
    const r = await processar(deps)
    expect(chamadas.marcadas).toEqual([])
    expect(chamadas.removidas).toEqual([])
    expect(r).toMatchObject({ adiadas: 1, marcadas: 0 })
    expect(chamadas.logs).toBe(2)
  })

  it('um aparelho aceitou e outro falhou de forma passageira: sai da fila (não repete no que já recebeu)', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [insc('a1', 'ana'), insc('a2', 'ana')], { a2: 503 })
    const r = await processar(deps)
    expect(chamadas.marcadas).toEqual(['1'])
    expect(r).toMatchObject({ pushes: 1, adiadas: 0 })
  })

  it('rejeição definitiva (ex.: 403) não é repetida e não apaga a inscrição', async () => {
    const { deps, chamadas } = montar([notif('1', 'ana')], [insc('a1', 'ana')], { a1: 403 })
    const r = await processar(deps)
    expect(chamadas.marcadas).toEqual(['1'])
    expect(chamadas.removidas).toEqual([])
    expect(r.adiadas).toBe(0)
  })

  it('a falha de uma notificação não atrapalha as outras', async () => {
    const { deps, chamadas } = montar(
      [notif('1', 'ana'), notif('2', 'bruno')],
      [insc('a1', 'ana'), insc('b1', 'bruno')],
      { a1: 503 },
    )
    const r = await processar(deps)
    expect(chamadas.marcadas).toEqual(['2'])
    expect(r).toMatchObject({ adiadas: 1, marcadas: 1, pushes: 1 })
  })

  it('notificação vencida (mais de 6 h) é marcada sem enviar', async () => {
    const velha = notif('1', 'ana', { criado_em: new Date(AGORA.getTime() - VALIDADE_MS - 1000).toISOString() })
    const { deps, chamadas } = montar([velha], [insc('a1', 'ana')])
    const r = await processar(deps)
    expect(chamadas.enviados).toEqual([])
    expect(chamadas.marcadas).toEqual(['1'])
    expect(r).toMatchObject({ vencidas: 1, marcadas: 1, pushes: 0 })
  })

  it('no limite da validade ainda envia', async () => {
    const limite = notif('1', 'ana', { criado_em: new Date(AGORA.getTime() - VALIDADE_MS).toISOString() })
    const { deps, chamadas } = montar([limite], [insc('a1', 'ana')])
    await processar(deps)
    expect(chamadas.enviados).toHaveLength(1)
  })

  it('muitos envios respeitam o limite de concorrência', async () => {
    const pendentes = Array.from({ length: 30 }, (_, i) => notif(String(i), 'ana'))
    let ativos = 0
    let pico = 0
    const { deps } = montar(pendentes, [insc('a1', 'ana')])
    deps.enviar = async () => {
      ativos++
      pico = Math.max(pico, ativos)
      await new Promise((r) => setTimeout(r, 2))
      ativos--
    }
    const r = await processar(deps)
    expect(r.pushes).toBe(30)
    expect(pico).toBeLessThanOrEqual(10)
    expect(pico).toBeGreaterThan(1)
  })
})
