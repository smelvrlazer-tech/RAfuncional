/** Selo "RA" — placeholder do logo até o cliente entregar a marca definitiva. */
export function SeloRA({ tamanho = 'm' }: { tamanho?: 'mini' | 'p' | 'm' | 'g' }) {
  return (
    <span className={`selo selo--${tamanho}`} aria-hidden="true">
      <span className="selo__letras">RA</span>
      <span className="selo__ponto" />
    </span>
  )
}
