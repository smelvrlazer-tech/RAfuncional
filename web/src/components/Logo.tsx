import { useTema } from '../lib/tema'

/**
 * Logo do Rafael (arquivos em public/). Identidade lima: scripts/processar-logo.mjs; identidade ciano:
 * scripts/processar-logo-ciano.mjs. No ciano o "horizontal" (login) é o emblema com o nome embaixo.
 */
const FORMATOS = {
  lima: { monograma: ['/logo-monograma.png', 672 / 336], horizontal: ['/logo-horizontal.png', 1530 / 430] },
  ciano: { monograma: ['/logo-ciano-emblema.png', 368 / 358], horizontal: ['/logo-ciano-completa.png', 380 / 430] },
} as const

export function Logo({ variante = 'monograma', altura = 32 }: { variante?: 'monograma' | 'horizontal'; altura?: number }) {
  const tema = useTema()
  const [src, razao] = FORMATOS[tema][variante]
  // A versão ciano do login é quadrada e precisa de mais altura para o nome ficar legível.
  const h = tema === 'ciano' && variante === 'horizontal' ? Math.round(altura * 1.8) : altura
  return <img className="logo" src={src} alt="" aria-hidden="true" height={h} width={Math.round(h * razao)} />
}
