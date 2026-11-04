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

await transparente({ left: 60, top: 40, width: 380, height: 380 }, 'logo-ciano-emblema.png')
await transparente({ left: 60, top: 40, width: 380, height: 430 }, 'logo-ciano-completa.png')
