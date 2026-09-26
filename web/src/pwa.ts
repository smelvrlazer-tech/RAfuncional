import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** Evento não padronizado do Chrome/Android para instalar o PWA. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalar | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

if (typeof window !== 'undefined') {
  // Precisa ser capturado cedo: o navegador dispara uma vez, logo no carregamento.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    evento = e as EventoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    avisar()
  })
}

export function registrarPwa(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    registerSW({ immediate: true })
  }
}

function modoApp(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function ehIOS(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

export function useInstalacao() {
  const [, forcar] = useState(0)
  useEffect(() => {
    const f = () => forcar((n) => n + 1)
    ouvintes.add(f)
    return () => { ouvintes.delete(f) }
  }, [])

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    evento = null
    avisar()
  }

  return { podeInstalar: evento !== null, instalar, ios: ehIOS(), instalado: modoApp() }
}
