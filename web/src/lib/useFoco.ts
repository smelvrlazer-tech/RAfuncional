import { useEffect, useRef } from 'react'

/** Chama `fn` quando a janela volta ao foco ou a aba volta a ficar visível. */
export function useAoFocar(fn: () => void): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    let ultimo = 0
    const disparar = () => {
      if (document.visibilityState !== 'visible') return
      const agora = Date.now()
      if (agora - ultimo < 1500) return // focus + visibilitychange chegam juntos
      ultimo = agora
      ref.current()
    }
    window.addEventListener('focus', disparar)
    document.addEventListener('visibilitychange', disparar)
    window.addEventListener('online', disparar)
    return () => {
      window.removeEventListener('focus', disparar)
      document.removeEventListener('visibilitychange', disparar)
      window.removeEventListener('online', disparar)
    }
  }, [])
}
