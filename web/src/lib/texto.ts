/** Utilitários de texto puros. */

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  const primeira = partes[0]!.charAt(0)
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}

/** Separa o texto livre do treino em parágrafos (linhas em branco). */
export function paragrafos(texto: string | null | undefined): string[] {
  if (!texto) return []
  return texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

export interface InfoVideo {
  plataforma: string
  /** Só http(s) é aberto. Qualquer outra coisa é tratada como link inválido. */
  seguro: boolean
}

export function descreverVideo(url: string): InfoVideo {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { plataforma: 'link', seguro: false }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { plataforma: 'link', seguro: false }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) return { plataforma: 'YouTube', seguro: true }
  if (host === 'instagram.com') return { plataforma: 'Instagram', seguro: true }
  if (host === 'drive.google.com') return { plataforma: 'Google Drive', seguro: true }
  return { plataforma: host, seguro: true }
}

/** O backend compara o código exatamente (12 hex maiúsculos). */
export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\s+/g, '').toUpperCase()
}
