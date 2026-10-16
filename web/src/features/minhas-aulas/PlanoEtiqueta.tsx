import { useEffect, useState } from 'react'
import { buscarMeuPlano } from './api'

/** Etiqueta "Plano 3x por semana" no topo da agenda. Some se o treinador não definiu plano. */
export function PlanoEtiqueta() {
  const [aulas, setAulas] = useState<number | null>(null)
  useEffect(() => {
    let vivo = true
    buscarMeuPlano().then((p) => { if (vivo) setAulas(p.aulas_semana) }).catch(() => { /* informação extra */ })
    return () => { vivo = false }
  }, [])
  if (!aulas) return null
  return <p className="plano-etiqueta"><span className="plano-etiqueta__ponto" aria-hidden="true" />Plano {aulas}x por semana</p>
}
