import { CAPAS } from '../components/Capa'

let feito = false

/** Baixa as fotos de capa das outras telas quando o navegador está ocioso, para a troca de tela não piscar. */
export function precarregarCapas() {
  if (feito || typeof window === 'undefined') return
  feito = true
  const rodar = () => {
    for (const c of Object.values(CAPAS)) {
      const img = new Image()
      img.decoding = 'async'
      img.src = c.arquivo
    }
  }
  const ocioso = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ocioso) ocioso(rodar, { timeout: 4000 })
  else window.setTimeout(rodar, 2000)
}
