// Partes puras do push, compartilhadas entre o app e o service worker (sem DOM nem rede).

export const TITULO_PADRAO = 'RA Funcional'

export interface DadosPush {
  id: string | null
  titulo: string
  corpo: string
  /** Sempre um caminho interno do app, começando com "/". */
  link: string
}

/** Só caminhos do próprio app: um push nunca deve abrir outro site. */
export function linkSeguro(link: unknown): string {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return '/'
  return link
}

/** Lê o corpo do push enviado pela Edge Function; qualquer coisa fora do formato vira um aviso genérico. */
export function interpretarPush(texto: string | null | undefined): DadosPush {
  const generico: DadosPush = { id: null, titulo: TITULO_PADRAO, corpo: 'Você tem uma novidade no app.', link: '/' }
  if (!texto) return generico
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return generico
  }
  if (typeof bruto !== 'object' || bruto === null) return generico
  const d = bruto as Record<string, unknown>
  const texto_ = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)
  return {
    id: texto_(d.id),
    titulo: texto_(d.titulo) ?? generico.titulo,
    corpo: texto_(d.corpo) ?? generico.corpo,
    link: linkSeguro(d.link),
  }
}

/** Chave pública VAPID (base64url) -> bytes, no formato que pushManager.subscribe exige. */
export function chaveVapidParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchida = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)
  const binario = atob(preenchida.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export type EstadoAvisos = 'carregando' | 'indisponivel' | 'instalar-ios' | 'bloqueado' | 'inativo' | 'ativo'

export interface Ambiente {
  /** Há chave VAPID configurada no build. */
  temChave: boolean
  /** serviceWorker + PushManager + Notification existem neste navegador. */
  suportado: boolean
  /** Há um service worker registrado (não há em desenvolvimento). */
  temServiceWorker: boolean
  ios: boolean
  instalado: boolean
  permissao: NotificationPermission
  temInscricao: boolean
}

/** Decide o que mostrar no Perfil. No iPhone o push só existe com o app instalado na tela de início. */
export function estadoDosAvisos(a: Ambiente): Exclude<EstadoAvisos, 'carregando'> {
  if (!a.temChave) return 'indisponivel'
  if (a.ios && !a.instalado) return 'instalar-ios'
  if (!a.suportado || !a.temServiceWorker) return 'indisponivel'
  if (a.permissao === 'denied') return 'bloqueado'
  return a.permissao === 'granted' && a.temInscricao ? 'ativo' : 'inativo'
}
