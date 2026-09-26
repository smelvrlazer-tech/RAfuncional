import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAoFocar } from '../../lib/useFoco'

interface EstadoNotificacoes {
  naoLidas: number
  recarregarNaoLidas: () => Promise<void>
}

const Ctx = createContext<EstadoNotificacoes>({ naoLidas: 0, recarregarNaoLidas: async () => {} })

export function useNaoLidas(): EstadoNotificacoes {
  return useContext(Ctx)
}

/** Contagem de não lidas para o sino. O RLS já limita às notificações do próprio aluno. */
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [naoLidas, setNaoLidas] = useState(0)

  const recarregarNaoLidas = useCallback(async () => {
    const { count, error } = await supabase
      .from('notificacoes').select('id', { count: 'exact', head: true }).is('lida_em', null)
    if (!error) setNaoLidas(count ?? 0)
  }, [])

  useEffect(() => {
    void recarregarNaoLidas()
    const id = window.setInterval(() => void recarregarNaoLidas(), 60_000)
    return () => window.clearInterval(id)
  }, [recarregarNaoLidas])

  useAoFocar(() => void recarregarNaoLidas())

  const valor = useMemo(() => ({ naoLidas, recarregarNaoLidas }), [naoLidas, recarregarNaoLidas])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
