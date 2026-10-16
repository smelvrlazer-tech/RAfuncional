import { supabase } from './supabase'

const LADO = 256

/** Recorta o centro em quadrado e reduz para 256px em JPEG (a foto fica leve e o bucket só aceita JPEG). */
export async function reduzirFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => falha(new Error('foto_invalida'))
      i.src = url
    })
    const lado = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = LADO
    canvas.height = LADO
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('foto_invalida')
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO)
    return await new Promise<Blob>((ok, falha) =>
      canvas.toBlob((b) => (b ? ok(b) : falha(new Error('foto_invalida'))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Envia a foto para o bucket `avatares` (arquivo <id>.jpg) e grava o endereço no perfil. */
export async function enviarFotoPerfil(perfilId: string, arquivo: File): Promise<string> {
  const jpeg = await reduzirFoto(arquivo)
  const caminho = `${perfilId}.jpg`
  const { error } = await supabase.storage.from('avatares').upload(caminho, jpeg, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('avatares').getPublicUrl(caminho)
  // O parâmetro v= força o navegador a buscar a foto nova (o arquivo mantém o mesmo nome).
  const url = `${data.publicUrl}?v=${Date.now()}`
  const { error: erroPerfil } = await supabase.from('perfis').update({ foto_url: url }).eq('id', perfilId)
  if (erroPerfil) throw erroPerfil
  return url
}

export async function removerFotoPerfil(perfilId: string): Promise<void> {
  await supabase.storage.from('avatares').remove([`${perfilId}.jpg`])
  const { error } = await supabase.from('perfis').update({ foto_url: null }).eq('id', perfilId)
  if (error) throw error
}
