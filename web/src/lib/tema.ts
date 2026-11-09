import { useSyncExternalStore } from 'react'

/**
 * Identidade visual. "ciano" é a escolhida pelo Rafael (padrão); "lima" (verde-lima) fica como alternativa.
 * Para comparar, abra o app com `?tema=lima` ou `?tema=ciano`: a escolha fica salva no navegador.
 * Em desenvolvimento também aparece o botão "Identidade" no canto da tela.
 */
export type Tema = 'lima' | 'ciano'

const CHAVE = 'ra.tema'
const PADRAO: Tema = 'ciano'
const COR_BARRA: Record<Tema, string> = { lima: '#0f1113', ciano: '#050607' }
const ouvintes = new Set<() => void>()

const ehTema = (v: unknown): v is Tema => v === 'lima' || v === 'ciano'

function lerSalvo(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    return ehTema(v) ? v : PADRAO
  } catch {
    return PADRAO
  }
}

let atual: Tema = lerSalvo()

function aplicar(tema: Tema) {
  document.documentElement.setAttribute('data-tema', tema)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema])
}

/** Aplica o tema (do endereço `?tema=` ou o salvo) antes da primeira pintura (chamado em main.tsx). */
export function iniciarTema(): void {
  const pedido = new URLSearchParams(window.location.search).get('tema')
  if (ehTema(pedido)) definirTema(pedido)
  else aplicar(atual)
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
