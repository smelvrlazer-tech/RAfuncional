// Gera os ícones do PWA a partir do selo "RA" (placeholder de logo).
// As letras são desenhadas como formas vetoriais (sem depender de fonte instalada),
// para o PNG sair igual em qualquer máquina. Rode com `npm run icons` e commite os PNGs.
// Cores: manter em sincronia com src/styles/tokens.css.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MARCA = '#1f4e46'
const PAPEL = '#f8f5ec'
const ACENTO = '#e86a3a'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(join(raiz, 'icons'), { recursive: true })

/** Letras "RA" condensadas + barra coral embaixo, centralizadas num quadro 512x512. */
function letras(escala = 1) {
  const alt = 220
  const larR = 95
  const larA = 90
  const vao = 14
  const total = larR + vao + larA
  const x1 = (512 - total) / 2
  const yt = (512 - alt) / 2 - 24
  const yb = yt + alt
  const x0 = x1 + larR + vao
  const r = [
    `<rect x="${x1}" y="${yt}" width="30" height="${alt}"/>`,
    `<path fill-rule="evenodd" d="M${x1} ${yt} H${x1 + 50} A45 60 0 0 1 ${x1 + 50} ${yt + 120} H${x1} Z M${x1 + 30} ${yt + 28} H${x1 + 48} A18 32 0 0 1 ${x1 + 48} ${yt + 92} H${x1 + 30} Z"/>`,
    `<polygon points="${x1 + 38},${yt + 112} ${x1 + 68},${yt + 112} ${x1 + 95},${yb} ${x1 + 64},${yb}"/>`,
  ]
  const a = `<path fill-rule="evenodd" d="M${x0} ${yb} L${x0 + 28} ${yt} H${x0 + 62} L${x0 + 90} ${yb} H${x0 + 61} L${x0 + 56} ${yb - 50} H${x0 + 34} L${x0 + 29} ${yb} Z M${x0 + 38} ${yb - 76} L${x0 + 45} ${yt + 46} L${x0 + 52} ${yb - 76} Z"/>`
  const barra = `<rect x="${256 - 60}" y="${yb + 30}" width="120" height="20" rx="10" fill="${ACENTO}"/>`
  const t = escala === 1 ? '' : ` transform="translate(256 256) scale(${escala}) translate(-256 -256)"`
  return `<g${t}><g fill="${PAPEL}">${r.join('')}${a}</g>${barra}</g>`
}

/** Duas meias-luas nas laterais (o "picote" do ingresso), só no ícone com bordas arredondadas. */
function furos() {
  return `<circle cx="0" cy="256" r="30" fill="${PAPEL}"/><circle cx="512" cy="256" r="30" fill="${PAPEL}"/>`
}

function svg({ arredondado, escala }) {
  const fundo = arredondado
    ? `<rect width="512" height="512" rx="112" fill="${MARCA}"/>`
    : `<rect width="512" height="512" fill="${MARCA}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fundo}${arredondado ? furos() : ''}${letras(escala)}</svg>`
}

const normal = svg({ arredondado: true, escala: 1 })
const maskable = svg({ arredondado: false, escala: 0.82 })
const cheio = svg({ arredondado: false, escala: 1 })

writeFileSync(join(raiz, 'favicon.svg'), normal)

const saidas = [
  ['icons/icon-192.png', normal, 192],
  ['icons/icon-512.png', normal, 512],
  ['icons/icon-maskable-512.png', maskable, 512],
  ['icons/apple-touch-icon.png', cheio, 180],
]
for (const [arquivo, fonte, tamanho] of saidas) {
  await sharp(Buffer.from(fonte)).resize(tamanho, tamanho).png().toFile(join(raiz, arquivo))
  console.log('gerado', arquivo)
}
