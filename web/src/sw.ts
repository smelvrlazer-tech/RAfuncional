// Service worker do app (vite-plugin-pwa, strategies: 'injectManifest').
// Mantém o que o modo generateSW fazia (pré-cache só do "app shell", fallback de navegação,
// atualização automática, nenhum cache de resposta da API) e acrescenta o Web Push.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { interpretarPush, linkSeguro } from './lib/push'

// O plugin troca a expressão `self.__WB_MANIFEST` pela lista de arquivos do build.
declare global {
  interface Window {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>
  }
}

// O tsconfig do app usa a lib DOM, não a de worker: tipamos só o que usamos aqui.
interface EventoComEspera extends Event { waitUntil(p: Promise<unknown>): void }
interface EventoPush extends EventoComEspera { data: { text(): string } | null }
interface EventoClique extends EventoComEspera { notification: { close(): void; data?: { link?: unknown } } }
interface ClienteJanela { url: string; focus(): Promise<unknown>; navigate?(url: string): Promise<unknown> }
interface EscopoSW {
  location: { origin: string }
  skipWaiting(): Promise<void>
  registration: { showNotification(titulo: string, opcoes?: Record<string, unknown>): Promise<void> }
  clients: { matchAll(opcoes: Record<string, unknown>): Promise<ClienteJanela[]>; openWindow(url: string): Promise<unknown> }
  addEventListener(tipo: 'push', f: (e: EventoPush) => void): void
  addEventListener(tipo: 'notificationclick', f: (e: EventoClique) => void): void
}
const sw = self as unknown as EscopoSW

void sw.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

sw.addEventListener('push', (evento) => {
  const d = interpretarPush(evento.data?.text())
  evento.waitUntil(
    sw.registration.showNotification(d.titulo, {
      body: d.corpo,
      icon: '/icons/icon-192.png',
      lang: 'pt-BR',
      // Mesmo id = a notificação substitui a anterior em vez de empilhar duplicada.
      tag: d.id ?? undefined,
      data: { link: d.link },
    }),
  )
})

sw.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const alvo = new URL(linkSeguro(evento.notification.data?.link), sw.location.origin).href
  evento.waitUntil(
    (async () => {
      const janelas = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of janelas) {
        if (new URL(janela.url).origin === sw.location.origin && janela.navigate) {
          await janela.focus()
          await janela.navigate(alvo)
          return
        }
      }
      await sw.clients.openWindow(alvo)
    })(),
  )
})
