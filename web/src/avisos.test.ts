import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('./lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const instalacao = { ios: false, instalado: false, podeInstalar: false, instalar: vi.fn() }
vi.mock('./pwa', () => ({ useInstalacao: () => instalacao }))

import { useAvisos } from './avisos'

const ENDPOINT = 'https://push.exemplo/aparelho-1'

function inscricao() {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'chave-p', auth: 'chave-a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

/** Monta um "navegador" com push: permissão inicial, inscrição já existente (ou não) e service worker. */
function navegador(opcoes: { permissao?: NotificationPermission; pedida?: NotificationPermission; sub?: ReturnType<typeof inscricao> | null; semSw?: boolean } = {}) {
  const { permissao = 'default', pedida = 'granted', sub = null, semSw = false } = opcoes
  const nova = inscricao()
  const pushManager = {
    getSubscription: vi.fn().mockImplementation(async () => sub),
    subscribe: vi.fn().mockResolvedValue(nova),
  }
  const reg = { pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(semSw ? undefined : reg), ready: Promise.resolve(reg) },
  })
  vi.stubGlobal('PushManager', class {})
  const Notificacao = Object.assign(vi.fn(), {
    permission: permissao,
    requestPermission: vi.fn().mockResolvedValue(pedida),
  })
  vi.stubGlobal('Notification', Notificacao)
  return { pushManager, nova, Notificacao }
}

describe('useAvisos', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: null, error: null })
    instalacao.ios = false
    instalacao.instalado = false
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // @ts-expect-error limpando o stub do navegador entre testes
    delete navigator.serviceWorker
  })

  it('sem inscrição e sem permissão: pode ativar', async () => {
    navegador()
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('inativo'))
  })

  it('sem service worker (desenvolvimento): indisponível', async () => {
    navegador({ semSw: true })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('indisponivel'))
  })

  it('permissão já negada: bloqueado', async () => {
    navegador({ permissao: 'denied' })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('bloqueado'))
  })

  it('iPhone fora do app instalado: pede para instalar', async () => {
    instalacao.ios = true
    navegador()
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('instalar-ios'))
  })

  it('já inscrito: fica ativo e reassocia o aparelho a quem está logado', async () => {
    navegador({ permissao: 'granted', sub: inscricao() })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('ativo'))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('registrar_push', {
      p_endpoint: ENDPOINT, p_chaves: { p256dh: 'chave-p', auth: 'chave-a' },
    }))
  })

  it('ativar: pede permissão, inscreve com a chave VAPID e registra no servidor', async () => {
    const { pushManager, Notificacao } = navegador()
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('inativo'))

    await act(async () => { await result.current.ativar() })

    expect(Notificacao.requestPermission).toHaveBeenCalledTimes(1)
    const opcoes = pushManager.subscribe.mock.calls[0]![0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array }
    expect(opcoes.userVisibleOnly).toBe(true)
    expect(opcoes.applicationServerKey).toHaveLength(65)
    expect(rpc).toHaveBeenCalledWith('registrar_push', {
      p_endpoint: ENDPOINT, p_chaves: { p256dh: 'chave-p', auth: 'chave-a' },
    })
    expect(result.current.estado).toBe('ativo')
    expect(result.current.erro).toBeNull()
  })

  it('ativar com a permissão negada: vira bloqueado e não inscreve', async () => {
    const { pushManager } = navegador({ pedida: 'denied' })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('inativo'))
    await act(async () => { await result.current.ativar() })
    expect(result.current.estado).toBe('bloqueado')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('ativar e fechar o pedido sem escolher: continua podendo ativar', async () => {
    navegador({ pedida: 'default' })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('inativo'))
    await act(async () => { await result.current.ativar() })
    expect(result.current.estado).toBe('inativo')
  })

  it('o servidor recusa o registro: desfaz a inscrição e mostra o erro, sem ficar "ativo" de mentira', async () => {
    const { nova } = navegador()
    rpc.mockResolvedValue({ data: null, error: { message: 'push_invalido', code: 'P0001' } })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('inativo'))

    await act(async () => { await result.current.ativar() })

    expect(nova.unsubscribe).toHaveBeenCalled()
    expect(result.current.estado).toBe('inativo')
    expect(result.current.erro).toMatch(/ativar os avisos/)
  })

  it('desativar: cancela a inscrição no navegador e remove no servidor', async () => {
    const sub = inscricao()
    navegador({ permissao: 'granted', sub })
    const { result } = renderHook(() => useAvisos())
    await waitFor(() => expect(result.current.estado).toBe('ativo'))
    rpc.mockClear()

    await act(async () => { await result.current.desativar() })

    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('remover_push', { p_endpoint: ENDPOINT })
    expect(result.current.estado).toBe('inativo')
  })
})
