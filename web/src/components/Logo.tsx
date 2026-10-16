/** Logo oficial do Rafael (arquivos em public/, gerados por scripts/processar-logo.mjs). */
export function Logo({ variante = 'monograma', altura = 32 }: { variante?: 'monograma' | 'horizontal'; altura?: number }) {
  const horizontal = variante === 'horizontal'
  return (
    <img
      className="logo"
      src={horizontal ? '/logo-horizontal.png' : '/logo-monograma.png'}
      alt=""
      aria-hidden="true"
      height={altura}
      width={Math.round(altura * (horizontal ? 1530 / 430 : 672 / 336))}
    />
  )
}
