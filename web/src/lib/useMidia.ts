import { useEffect, useState } from 'react'

/** Ponto de quebra do layout de computador do aluno (lista + detalhe, menu lateral). */
export const MIDIA_LARGA = '(min-width: 900px)'

/** true enquanto a media query casa. Sem matchMedia (testes, SSR): false, ou seja, layout de celular. */
export function useMidia(consulta: string): boolean {
  const [casa, setCasa] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia?.(consulta)
    if (!m) return
    const atualizar = () => setCasa(m.matches)
    atualizar()
    m.addEventListener('change', atualizar)
    return () => m.removeEventListener('change', atualizar)
  }, [consulta])
  return casa
}
