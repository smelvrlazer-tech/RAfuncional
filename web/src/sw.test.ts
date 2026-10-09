import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Executa src/sw.ts de verdade, com o escopo de worker e o Workbox simulados.
const precacheAndRoute = vi.fn()
const cleanupOutdatedCaches = vi.fn()
const createHandlerBoundToURL = vi.fn((url: string) => `handler:${url}`)
const registerRoute = vi.fn()
const clientsClaim = vi.fn()
vi.mock('workbox-core', () => ({ clientsClaim: () => clientsClaim() }))
vi.mock('workbox-precaching', () => ({
  precacheAndRoute: (...a: unknown[]) => precacheAndRoute(...a),
  cleanupOutdatedCaches: () => cleanupOutdatedCaches(),
  createHandlerBoundToURL: (u: string) => createHandlerBoundToURL(u),
}))
vi.mock('workbox-routing', () => ({
  NavigationRoute: class { constructor(public handler: unknown) {} },
  registerRoute: (...a: unknown[]) => registerRoute(...a),
}))

type Esp = { espera: Promise<unknown> | null }
const escopo = self as unknown as Record<string, unknown>
const skipWaiting = vi.fn().mockResolvedValue(undefined)
const showNotification = vi.fn().mockResolvedValue(undefined)
const matchAll = vi.fn()
const openWindow = vi.fn().mockResolvedValue(undefined)

/** Dispara um evento no escopo e devolve a promessa passada a waitUntil. */
async function disparar(tipo: string, extra: Record<string, unknown>): Promise<void> {
  const esp: Esp = { espera: null }
  const evento = Object.assign(new Event(tipo), { ...extra, waitUntil: (p: Promise<unknown>) => { esp.espera = p } })
  self.dispatchEvent(evento)
  await esp.espera
}

const push = (corpo: string | null) => disparar('push', { data: corpo === null ? null : { text: () => corpo } })

function clique(link: unknown) {
  const notification = { close: vi.fn(), data: { link } }
  return { notification, promessa: disparar('notificationclick', { notification }) }
}

// Cada teste reimporta o sw.ts no mesmo `self`: sem remover os listeners, eles se acumulariam.
const registrados: Array<[string, EventListenerOrEventListenerObject]> = []

describe('service worker', () => {
  afterEach(() => {
    for (const [tipo, f] of registrados) self.removeEventListener(tipo, f)
    registrados.length = 0
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    vi.resetModules()
    const original = self.addEventListener.bind(self)
    vi.spyOn(self, 'addEventListener').mockImplementation((tipo: string, f: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions) => {
      registrados.push([tipo, f])
      original(tipo, f, o)
    })
    for (const f of [precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, registerRoute, clientsClaim, showNotification, matchAll, openWindow, skipWaiting]) f.mockClear()
    matchAll.mockResolvedValue([])
    Object.assign(escopo, {
      __WB_MANIFEST: [{ url: '/index.html', revision: 'abc' }],
      skipWaiting,
      registration: { showNotification },
      clients: { matchAll, openWindow },
    })
    await import('./sw')
  })

  it('mantém o comportamento de PWA: pré-cache do app shell, fallback de navegação e atualização automática', () => {
    expect(precacheAndRoute).toHaveBeenCalledWith([{ url: '/index.html', revision: 'abc' }])
    expect(cleanupOutdatedCaches).toHaveBeenCalled()
    expect(createHandlerBoundToURL).toHaveBeenCalledWith('/index.html')
    expect(registerRoute).toHaveBeenCalledTimes(1)
    expect(skipWaiting).toHaveBeenCalled()
    expect(clientsClaim).toHaveBeenCalled()
  })

  describe('push', () => {
    it('mostra a notificação com título, corpo, ícone e o link para abrir depois', async () => {
      await push(JSON.stringify({ id: 'n1', titulo: 'Vaga liberada!', corpo: 'Você foi confirmado.', link: '/sessao/s1' }))
      expect(showNotification).toHaveBeenCalledWith('Vaga liberada!', expect.objectContaining({
        body: 'Você foi confirmado.', icon: '/icons/icon-192.png', tag: 'n1', data: { link: '/sessao/s1' },
      }))
    })

    it('push sem corpo ou ilegível ainda mostra um aviso (o navegador exige mostrar algo)', async () => {
      await push(null)
      await push('lixo')
      expect(showNotification).toHaveBeenCalledTimes(2)
      expect(showNotification.mock.calls[0]![0]).toBe('RA Funcional')
      expect(showNotification.mock.calls[1]![1]).toMatchObject({ data: { link: '/' } })
    })
  })

  describe('clique na notificação', () => {
    const origem = location.origin

    it('fecha a notificação e abre uma janela no link quando o app não está aberto', async () => {
      const { notification, promessa } = clique('/sessao/s1')
      await promessa
      expect(notification.close).toHaveBeenCalled()
      expect(openWindow).toHaveBeenCalledWith(`${origem}/sessao/s1`)
    })

    it('com o app já aberto, foca essa janela e leva ao link', async () => {
      const janela = { url: `${origem}/perfil`, focus: vi.fn().mockResolvedValue(undefined), navigate: vi.fn().mockResolvedValue(undefined) }
      matchAll.mockResolvedValue([janela])
      await clique('/sessao/s1').promessa
      expect(janela.focus).toHaveBeenCalled()
      expect(janela.navigate).toHaveBeenCalledWith(`${origem}/sessao/s1`)
      expect(openWindow).not.toHaveBeenCalled()
    })

    it('ignora janelas de outras origens', async () => {
      const alheia = { url: 'https://outro.site/', focus: vi.fn(), navigate: vi.fn() }
      matchAll.mockResolvedValue([alheia])
      await clique('/sessao/s1').promessa
      expect(alheia.focus).not.toHaveBeenCalled()
      expect(openWindow).toHaveBeenCalledWith(`${origem}/sessao/s1`)
    })

    it('navegador sem WindowClient.navigate: abre uma janela nova em vez de falhar', async () => {
      matchAll.mockResolvedValue([{ url: `${origem}/`, focus: vi.fn() }])
      await clique('/sessao/s1').promessa
      expect(openWindow).toHaveBeenCalledWith(`${origem}/sessao/s1`)
    })

    it.each([['https://malicioso.com/x'], ['//malicioso.com'], [undefined], [42]])('link inseguro (%s) abre a agenda', async (link) => {
      await clique(link).promessa
      expect(openWindow).toHaveBeenCalledWith(`${origem}/`)
    })
  })
})
