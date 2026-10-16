import { useEffect, useState } from 'react'
import {
  buscarEstudio, buscarMeuPainel, buscarUltimoAviso,
  type InfoEstudio, type MeuPainel, type UltimoAviso,
} from './inicio'

/** Carrega uma vez ao montar; falha vira null (são informações extras, a tela não depende delas). */
function useUmaVez<T>(buscar: () => Promise<T>): T | null {
  const [valor, setValor] = useState<T | null>(null)
  useEffect(() => {
    let vivo = true
    buscar().then((v) => { if (vivo) setValor(v) }).catch(() => { /* informação extra */ })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return valor
}

export const useEstudio = (): InfoEstudio | null => useUmaVez(buscarEstudio)
export const useMeuPainel = (): MeuPainel | null => useUmaVez(buscarMeuPainel)
export const useUltimoAviso = (): UltimoAviso | null => useUmaVez(buscarUltimoAviso)
