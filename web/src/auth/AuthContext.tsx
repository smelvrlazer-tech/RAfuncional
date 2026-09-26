import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'

export interface EstadoAuth {
  /** true até sabermos se há sessão e (se houver) carregarmos o perfil. */
  carregando: boolean
  sessao: Session | null
  /** null = usuário do Auth sem linha em perfis (ainda não aceitou convite). */
  perfil: Perfil | null
  /** Falha ao carregar o perfil (ex.: sem conexão) — diferente de "não tem perfil". */
  erroPerfil: unknown
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

export const AuthContext = createContext<EstadoAuth | null>(null)

export function useAuth(): EstadoAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [sessaoPronta, setSessaoPronta] = useState(false)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [erroPerfil, setErroPerfil] = useState<unknown>(null)
  const [perfilDoUsuario, setPerfilDoUsuario] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSessao(data.session)
      setSessaoPronta(true)
    })
    // Não chamar o supabase dentro deste callback (pode travar o lock do auth):
    // só guardamos a sessão; o perfil é carregado no efeito abaixo.
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova)
      setSessaoPronta(true)
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const usuarioId = sessao?.user.id ?? null

  const carregarPerfil = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('perfis').select('id, nome, telefone, papel, ativo').eq('id', id).maybeSingle()
    if (error) {
      setErroPerfil(error)
      setPerfil(null)
    } else {
      setErroPerfil(null)
      setPerfil((data as Perfil | null) ?? null)
    }
    setPerfilDoUsuario(id)
  }, [])

  useEffect(() => {
    if (!usuarioId) {
      setPerfil(null)
      setErroPerfil(null)
      setPerfilDoUsuario(null)
      return
    }
    void carregarPerfil(usuarioId)
  }, [usuarioId, carregarPerfil])

  const recarregarPerfil = useCallback(async () => {
    if (usuarioId) await carregarPerfil(usuarioId)
  }, [usuarioId, carregarPerfil])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const carregando = !sessaoPronta || (usuarioId !== null && perfilDoUsuario !== usuarioId)

  const valor = useMemo<EstadoAuth>(
    () => ({ carregando, sessao, perfil, erroPerfil, recarregarPerfil, sair }),
    [carregando, sessao, perfil, erroPerfil, recarregarPerfil, sair],
  )
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
