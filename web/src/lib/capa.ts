import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Foto de capa do estúdio: o professor envia uma imagem (Perfil) e ela aparece no fundo dos
 * destaques do app (próxima aula, detalhe da aula). Fica no bucket público `avatares`, arquivo capa.jpg.
 * Sem foto enviada, os destaques usam um fundo de grafite com brilho na cor da identidade.
 */
const ARQUIVO = 'capa.jpg'

function enderecoPublico(): string {
  return supabase.storage.from('avatares').getPublicUrl(ARQUIVO).data.publicUrl
}

let cache: { url: string | null } | null = null
const ouvintes = new Set<() => void>()

function verificar(url: string): Promise<boolean> {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => ok(true)
    img.onerror = () => ok(false)
    img.src = url
  })
}

/** Endereço da capa (com parâmetro de versão) ou null se o professor ainda não enviou. */
export function useCapa(): string | null {
  const [url, setUrl] = useState<string | null>(cache?.url ?? null)
  useEffect(() => {
    const atualizar = () => setUrl(cache?.url ?? null)
    ouvintes.add(atualizar)
    if (!cache) {
      cache = { url: null }
      const base = enderecoPublico()
      void verificar(base).then((existe) => {
        cache = { url: existe ? base : null }
        ouvintes.forEach((f) => f())
      })
    }
    return () => { ouvintes.delete(atualizar) }
  }, [])
  return url
}

/** Recorta o centro em 16:9 e reduz para 1280px de largura, em JPEG. */
export async function reduzirCapa(arquivo: File): Promise<Blob> {
  const objeto = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => falha(new Error('foto_invalida'))
      i.src = objeto
    })
    const L = 1280
    const A = 720
    const razao = L / A
    let w = img.naturalWidth
    let h = img.naturalHeight
    let sx = 0
    let sy = 0
    if (w / h > razao) { const nw = h * razao; sx = (w - nw) / 2; w = nw } else { const nh = w / razao; sy = (h - nh) / 2; h = nh }
    const canvas = document.createElement('canvas')
    canvas.width = L
    canvas.height = A
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('foto_invalida')
    ctx.drawImage(img, sx, sy, w, h, 0, 0, L, A)
    return await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('foto_invalida'))), 'image/jpeg', 0.82))
  } finally {
    URL.revokeObjectURL(objeto)
  }
}

export async function enviarCapa(arquivo: File): Promise<void> {
  const jpeg = await reduzirCapa(arquivo)
  const { error } = await supabase.storage.from('avatares').upload(ARQUIVO, jpeg, { upsert: true, contentType: 'image/jpeg', cacheControl: '300' })
  if (error) throw error
  cache = { url: `${enderecoPublico()}?v=${Date.now()}` }
  ouvintes.forEach((f) => f())
}

export async function removerCapa(): Promise<void> {
  const { error } = await supabase.storage.from('avatares').remove([ARQUIVO])
  if (error) throw error
  cache = { url: null }
  ouvintes.forEach((f) => f())
}
