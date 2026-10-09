import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemErro } from './lib/erros'
import { chaveVapidParaBytes, estadoDosAvisos, type Ambiente, type EstadoAvisos } from './lib/push'
import { supabase } from './lib/supabase'
import { useInstalacao } from './pwa'

const CHAVE_VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

function suportado(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registrarNoServidor(sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.rpc('registrar_push', {
    p_endpoint: endpoint,
    p_chaves: { p256dh: keys?.p256dh, auth: keys?.auth },
  })
  if (error) throw error
}

/**
 * Avisos (Web Push) deste aparelho. O estado vem do navegador (permissão + inscrição); o servidor
 * só guarda o endpoint para poder enviar. O sino do app continua sendo o fallback garantido.
 */
export function useAvisos() {
  const { ios, instalado } = useInstalacao()
  const [estado, setEstado] = useState<EstadoAvisos>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [trabalhando, setTrabalhando] = useState(false)
  const vivo = useRef(true)

  const ler = useCallback(async () => {
    let temServiceWorker = false
    let sub: PushSubscription | null = null
    if (suportado()) {
      const reg = await navigator.serviceWorker.getRegistration()
      temServiceWorker = !!reg
      sub = (await reg?.pushManager.getSubscription()) ?? null
    }
    const ambiente: Ambiente = {
      temChave: CHAVE_VAPID !== '',
      suportado: suportado(),
      temServiceWorker,
      ios,
      instalado,
      permissao: suportado() ? Notification.permission : 'default',
      temInscricao: sub !== null,
    }
    const novo = estadoDosAvisos(ambiente)
    if (!vivo.current) return
    setEstado(novo)
    // Já ativo neste aparelho: garante que o servidor o associa a quem está logado agora
    // (celular compartilhado, ou inscrição perdida). Falhar aqui não atrapalha nada.
    if (novo === 'ativo' && sub) void registrarNoServidor(sub).catch(() => {})
  }, [ios, instalado])

  useEffect(() => {
    vivo.current = true
    void ler()
    return () => { vivo.current = false }
  }, [ler])

  const ativar = useCallback(async () => {
    setErro(null)
    setTrabalhando(true)
    try {
      // requestPermission precisa ser chamado direto do clique, antes de qualquer outra espera longa.
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'inativo')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveVapidParaBytes(CHAVE_VAPID),
      })
      try {
        await registrarNoServidor(sub)
      } catch (e) {
        // Sem registro no servidor a inscrição não serve para nada: desfaz para não ficar "ativo" de mentira.
        await sub.unsubscribe().catch(() => {})
        throw e
      }
      setEstado('ativo')
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setTrabalhando(false)
    }
  }, [])

  const desativar = useCallback(async () => {
    setErro(null)
    setTrabalhando(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        const { endpoint } = sub
        await sub.unsubscribe()
        // Se o servidor falhar, o aparelho já não recebe: uma linha órfã é limpa no próximo 410.
        await supabase.rpc('remover_push', { p_endpoint: endpoint })
      }
      setEstado('inativo')
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setTrabalhando(false)
    }
  }, [])

  return { estado, erro, trabalhando, ativar, desativar }
}
