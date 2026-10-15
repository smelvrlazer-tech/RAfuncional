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

export interface BlocoTreino {
  /** "Aquecimento", "Bloco principal (4 voltas, 40s / 20s)"... ou null num parágrafo sem rótulo. */
  titulo: string | null
  texto: string
}

/**
 * Divide o treino em blocos. O treinador escreve parágrafos como "Aquecimento: 8 min de mobilidade";
 * o que vem antes dos dois-pontos vira o título do bloco. Parágrafo sem rótulo curto fica sem título.
 */
export function blocosDoTreino(texto: string | null | undefined): BlocoTreino[] {
  return paragrafos(texto).map((p) => {
    const m = p.match(/^([^:\n]{2,60}):\s*([\s\S]+)$/)
    // Exige que o rótulo comece com letra: "06:00 começa..." não é um título.
    if (m && /^\p{L}/u.test(m[1]!)) return { titulo: m[1]!.trim(), texto: m[2]!.trim() }
    return { titulo: null, texto: p }
  })
}

/** Miniatura de um vídeo do YouTube (watch, youtu.be, shorts, embed), ou null para outros links. */
export function miniaturaYoutube(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null
  else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
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
