import { useSyncExternalStore } from 'react'

/**
 * Identidade visual. "lima" é a oficial (verde-lima); "ciano" é a alternativa para o Rafael comparar.
 * A troca só existe em desenvolvimento (botão "Identidade" no canto da tela): no app publicado
 * vale sempre a lima, até o Rafael escolher uma delas.
 */
export type Tema = 'lima' | 'ciano'

const CHAVE = 'ra.tema'
const COR_BARRA: Record<Tema, string> = { lima: '#0f1113', ciano: '#050607' }
const ouvintes = new Set<() => void>()

function lerSalvo(): Tema {
  if (!import.meta.env.DEV) return 'lima'
  try { return localStorage.getItem(CHAVE) === 'ciano' ? 'ciano' : 'lima' } catch { return 'lima' }
}

let atual: Tema = lerSalvo()

function aplicar(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'lima') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', tema)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema])
}

/** Aplica o tema salvo antes da primeira pintura (chamado em main.tsx). */
export function iniciarTema(): void {
  aplicar(atual)
  // Outras abas e o quadro "Ver como celular" (iframe) acompanham a escolha.
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE) definirTema(lerSalvo(), false)
  })
}

export function definirTema(tema: Tema, gravar = true): void {
  atual = tema
  aplicar(tema)
  if (gravar) {
    try { localStorage.setItem(CHAVE, tema) } catch { /* vale só nesta visita */ }
  }
  ouvintes.forEach((f) => f())
}

export function temaAtual(): Tema {
  return atual
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
    () => atual,
  )
}
