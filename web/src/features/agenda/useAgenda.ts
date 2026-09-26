import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chaveDiaSP, inicioDoDiaSP, proximosDias, somarDias } from '../../lib/datetime'
import type { LinhaAgenda } from '../../lib/tipos'
import { useAoFocar } from '../../lib/useFoco'
import { buscarAgenda, buscarLimiteBloqueio } from './api'

export const DIAS_AGENDA = 14

/** Relógio que avança a cada 30s (estados "em andamento"/"bloqueada" mudam com o tempo). */
export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs])
  return agora
}

export function useLimiteBloqueio(): number {
  const [limite, setLimite] = useState(60)
  useEffect(() => {
    let vivo = true
    buscarLimiteBloqueio().then((n) => vivo && setLimite(n)).catch(() => {})
    return () => { vivo = false }
  }, [])
  return limite
}

export function useAgenda() {
  const agora = useAgora()
  const hoje = chaveDiaSP(agora)
  const dias = useMemo(() => proximosDias(inicioDoDiaSP(hoje), DIAS_AGENDA), [hoje])
  const [linhas, setLinhas] = useState<LinhaAgenda[] | null>(null)
  const [erro, setErro] = useState<unknown>(null)
  const [carregando, setCarregando] = useState(true)
  const pedido = useRef(0)

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current
    setCarregando(true)
    try {
      const dados = await buscarAgenda(inicioDoDiaSP(hoje), inicioDoDiaSP(somarDias(hoje, DIAS_AGENDA)))
      if (meu === pedido.current) {
        setLinhas(dados)
        setErro(null)
      }
    } catch (e) {
      if (meu === pedido.current) setErro(e)
    } finally {
      if (meu === pedido.current) setCarregando(false)
    }
  }, [hoje])

  useEffect(() => { void recarregar() }, [recarregar])
  useAoFocar(() => void recarregar())

  const porDia = useMemo(() => {
    const mapa = new Map<string, LinhaAgenda[]>()
    for (const l of linhas ?? []) {
      const chave = chaveDiaSP(l.inicia_em)
      const lista = mapa.get(chave) ?? []
      lista.push(l)
      mapa.set(chave, lista)
    }
    return mapa
  }, [linhas])

  return { agora, hoje, dias, linhas, porDia, erro, carregando, recarregar }
}
