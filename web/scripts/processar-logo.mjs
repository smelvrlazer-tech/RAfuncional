// Gera a logo oficial (PNG transparente) e os ícones do PWA a partir da arte enviada pelo Rafael.
// Uso: node scripts/processar-logo.mjs "<png da logo horizontal em fundo preto>"
// Saídas em public/: logo-horizontal.png, logo-monograma.png (identidade lima) e icons-lima/*.png, favicon-lima.png.
// Os ícones do app instalado (icons/, favicon.png) são da identidade padrão (ciano): processar-logo-ciano.mjs.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const origem = process.argv[2]
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(join(pub, 'icons-lima'), { recursive: true })
const FUNDO = { r: 0x0f, g: 0x11, b: 0x13, alpha: 1 }

// preto vira transparência: alpha = brilho máximo do pixel, cor desmultiplicada
async function transparente(recorte) {
  const { data, info } = await sharp(origem).extract(recorte).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.max(data[i], data[i + 1], data[i + 2])
    if (a < 24) { data[i + 3] = 0; continue }
    data[i] = Math.min(255, Math.round((data[i] * 255) / a))
    data[i + 1] = Math.min(255, Math.round((data[i + 1] * 255) / a))
    data[i + 2] = Math.min(255, Math.round((data[i + 2] * 255) / a))
    data[i + 3] = a
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
}

const horizontal = await transparente({ left: 140, top: 240, width: 1530, height: 430 })
await horizontal.clone().png().toFile(join(pub, 'logo-horizontal.png'))
const mono = await transparente({ left: 148, top: 258, width: 672, height: 336 })
const monoBuf = await mono.png().toBuffer()
await sharp(monoBuf).toFile(join(pub, 'logo-monograma.png'))

async function icone(arquivo, tamanho, proporcao, raio) {
  const lado = Math.round(tamanho * proporcao)
  const m = await sharp(monoBuf).resize({ width: lado }).toBuffer()
  const base = sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: raio ? { r: 0, g: 0, b: 0, alpha: 0 } : FUNDO } })
  const camadas = []
  if (raio) camadas.push({ input: Buffer.from(`<svg width="${tamanho}" height="${tamanho}"><rect width="${tamanho}" height="${tamanho}" rx="${Math.round(tamanho * 0.22)}" fill="#0f1113"/></svg>`) })
  camadas.push({ input: m, gravity: 'center' })
  await base.composite(camadas).png().toFile(join(pub, arquivo))
  console.log('gerado', arquivo)
}
await icone('icons-lima/icon-192.png', 192, 0.62, true)
await icone('icons-lima/icon-512.png', 512, 0.62, true)
await icone('icons-lima/icon-maskable-512.png', 512, 0.5, false)
await icone('icons-lima/apple-touch-icon.png', 180, 0.62, false)
await icone('favicon-lima.png', 64, 0.7, true)
