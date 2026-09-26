import { useCallback, useEffect, useRef, useState } from 'react'
import { useAoFocar } from '../../lib/useFoco'

export interface Carga<T> {
  dados: T | undefined
  erro: unknown
  carregando: boolean
  recarregar: () => Promise<void>
  /** Troca os dados por uma resposta já obtida (evita consultar de novo). */
  substituir: (dados: T) => void
}

/**
 * Carrega `buscar` ao montar, quando `chave` muda e quando a janela volta ao foco.
 * Respostas fora de ordem (troca rápida de dia/semana) são descartadas.
 */
export function useCarga<T>(buscar: () => Promise<T>, chave: string): Carga<T> {
  const [dados, setDados] = useState<T | undefined>(undefined)
  const [erro, setErro] = useState<unknown>(null)
  const [carregando, setCarregando] = useState(true)
  const pedido = useRef(0)
  const fn = useRef(buscar)
  fn.current = buscar

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current
    setCarregando(true)
    try {
      const r = await fn.current()
      if (meu === pedido.current) { setDados(r); setErro(null) }
    } catch (e) {
      if (meu === pedido.current) setErro(e)
    } finally {
      if (meu === pedido.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    setDados(undefined)
    void recarregar()
  }, [chave, recarregar])
  useAoFocar(() => void recarregar())

  const substituir = useCallback((d: T) => {
    pedido.current++
    setDados(d)
    setErro(null)
    setCarregando(false)
  }, [])

  return { dados, erro, carregando, recarregar, substituir }
}
