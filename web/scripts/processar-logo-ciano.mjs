// Gera os PNG transparentes da identidade alternativa (preto, branco e ciano) a partir da arte original.
// Uso: node scripts/processar-logo-ciano.mjs ../docs/identidade/logo-ciano-original.jpg
// Saídas em public/: logo-ciano-emblema.png (anel + RA) e logo-ciano-completa.png (com o nome embaixo).
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const origem = process.argv[2]
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// o fundo preto vira transparência: alpha = brilho máximo do pixel, cor desmultiplicada (mantém o brilho do anel)
async function transparente(recorte, saida) {
  const { data, info } = await sharp(origem).extract(recorte).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.max(data[i], data[i + 1], data[i + 2])
    if (a < 14) { data[i + 3] = 0; continue }
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round((data[i + c] * 255) / a))
    data[i + 3] = a
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(join(pub, saida))
  console.log('gerado', saida)
}

await transparente({ left: 66, top: 46, width: 368, height: 358 }, 'logo-ciano-emblema.png')
await transparente({ left: 60, top: 40, width: 380, height: 430 }, 'logo-ciano-completa.png')

// ---------------------------------------------------------------- ícones do app instalado (identidade padrão)
import { mkdirSync } from 'node:fs'
mkdirSync(join(pub, 'icons'), { recursive: true })
const emblema = await sharp(join(pub, 'logo-ciano-emblema.png')).toBuffer()
async function icone(arquivo, tamanho, proporcao, arredondar) {
  const lado = Math.round(tamanho * proporcao)
  const m = await sharp(emblema).resize({ width: lado }).toBuffer()
  const camadas = []
  if (arredondar) camadas.push({ input: Buffer.from(`<svg width="${tamanho}" height="${tamanho}"><rect width="${tamanho}" height="${tamanho}" rx="${Math.round(tamanho * 0.22)}" fill="#050607"/></svg>`) })
  camadas.push({ input: m, gravity: 'center' })
  const base = sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: arredondar ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 5, g: 6, b: 7, alpha: 1 } } })
  await base.composite(camadas).png().toFile(join(pub, arquivo))
  console.log('gerado', arquivo)
}
await icone('icons/icon-192.png', 192, 0.8, true)
await icone('icons/icon-512.png', 512, 0.8, true)
await icone('icons/icon-maskable-512.png', 512, 0.62, false)
await icone('icons/apple-touch-icon.png', 180, 0.8, false)
await icone('favicon.png', 64, 0.92, true)
