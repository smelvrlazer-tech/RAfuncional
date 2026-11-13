export interface BarraSemana {
  /** Rótulo curto embaixo da barra (ex.: "10/11"). */
  rotulo: string
  /** Valor da barra (altura). */
  valor: number
  /** Texto lido por leitor de tela. */
  texto: string
  /** Semana atual (destaque). */
  atual?: boolean
}

/**
 * Barras de semanas (8 por padrão). `maximo` é o valor que enche a barra; `marco` desenha uma linha de referência
 * (ex.: plano de aulas por semana). Cada barra tem número visível acima, então a leitura não depende de cor.
 */
export function BarrasSemanais({ barras, maximo, marco, rotuloMarco, legenda, sufixo = '' }: {
  barras: BarraSemana[]
  maximo: number
  marco?: number | null
  rotuloMarco?: string
  legenda: string
  /** Texto após o número acima da barra (ex.: "%"). */
  sufixo?: string
}) {
  const topo = Math.max(maximo, 1)
  return (
    <figure className="barras-sem">
      <ul className="barras-sem__lista" aria-label={legenda}>
        {barras.map((b) => (
          <li key={b.rotulo} className={`barras-sem__item ${b.atual ? 'barras-sem__item--atual' : ''}`}>
            <span className="barras-sem__valor">{b.valor}{sufixo}</span>
            <span className="barras-sem__coluna" role="img" aria-label={b.texto}>
              <span className="barras-sem__preenchido" style={{ height: `${Math.min(100, (b.valor / topo) * 100)}%` }} />
              {marco ? <span className="barras-sem__marco" style={{ bottom: `${Math.min(100, (marco / topo) * 100)}%` }} /> : null}
            </span>
            <span className="barras-sem__rotulo">{b.rotulo}</span>
          </li>
        ))}
      </ul>
      {marco ? <figcaption className="barras-sem__legenda"><span className="barras-sem__traco" aria-hidden="true" /> {rotuloMarco ?? `Meta: ${marco}`}</figcaption> : null}
    </figure>
  )
}
