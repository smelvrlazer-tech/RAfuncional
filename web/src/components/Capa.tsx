import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useCapa } from '../lib/capa'

/**
 * Destaque escuro no topo de uma tela: foto de capa do estúdio ao fundo (se o professor enviou) com
 * véu escuro para o texto continuar legível, ou o fundo de grafite com brilho na cor da identidade.
 */
export function Capa({ como: Tag = 'section', className = '', children, ...resto }: {
  como?: ElementType
  className?: string
  children: ReactNode
  [chave: string]: unknown
}) {
  const url = useCapa()
  const estilo = (url ? { '--capa-foto': `url("${url}")` } : undefined) as CSSProperties | undefined
  return (
    <Tag className={`capa sup-escura ${url ? 'capa--com-foto' : ''} ${className}`.trim()} style={estilo} {...resto}>
      {children}
    </Tag>
  )
}
