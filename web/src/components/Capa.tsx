import type { CSSProperties, ElementType, ReactNode } from 'react'

/**
 * Fotos de capa do app (arquivos em public/capas, já otimizados). Cada tela usa uma, para o conjunto
 * ficar variado sem repetir a mesma imagem no mesmo fluxo.
 */
export const CAPAS = {
  inicio: { arquivo: '/capas/capa-kettlebell.webp', posicao: 'right center' },
  agenda: { arquivo: '/capas/capa-estudio.webp', posicao: 'center 40%' },
  aula: { arquivo: '/capas/capa-treino.webp', posicao: 'center 25%' },
} as const

export type NomeCapa = keyof typeof CAPAS

/**
 * Destaque escuro no topo de uma tela: foto ao fundo com véu escuro (para o texto continuar legível)
 * ou, sem foto, grafite com brilho na cor da identidade.
 */
export function Capa({ como: Tag = 'section', foto, className = '', children, ...resto }: {
  como?: ElementType
  foto?: NomeCapa
  className?: string
  children: ReactNode
  [chave: string]: unknown
}) {
  const estilo = (foto
    ? { '--capa-foto': `url("${CAPAS[foto].arquivo}")`, '--capa-posicao': CAPAS[foto].posicao }
    : undefined) as CSSProperties | undefined
  return (
    <Tag className={`capa sup-escura ${foto ? 'capa--com-foto' : ''} ${className}`.trim()} style={estilo} {...resto}>
      {children}
    </Tag>
  )
}
