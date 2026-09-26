import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

function descricao(id: string, dica?: ReactNode, erro?: string | null) {
  return [dica ? `${id}-dica` : null, erro ? `${id}-erro` : null].filter(Boolean).join(' ') || undefined
}

function Rodape({ id, dica, erro }: { id: string; dica?: ReactNode; erro?: string | null }) {
  return (
    <>
      {dica && <p className="campo__dica" id={`${id}-dica`}>{dica}</p>}
      {erro && <p className="campo__erro" id={`${id}-erro`}>{erro}</p>}
    </>
  )
}

/** Select com rótulo, dica e erro (mesmo visual de Campo). */
export function CampoSelecao({
  rotulo, dica, erro, children, ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; dica?: ReactNode; erro?: string | null }) {
  const id = useId()
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>{rotulo}</label>
      <select id={id} className="campo__entrada campo__entrada--selecao" aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, dica, erro)} {...select}>
        {children}
      </select>
      <Rodape id={id} dica={dica} erro={erro} />
    </div>
  )
}

/** Texto longo (várias linhas) com rótulo, dica e erro. */
export function CampoTexto({
  rotulo, dica, erro, ...area
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string; dica?: ReactNode; erro?: string | null }) {
  const id = useId()
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>{rotulo}</label>
      <textarea id={id} className="campo__entrada campo__entrada--texto" aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, dica, erro)} {...area} />
      <Rodape id={id} dica={dica} erro={erro} />
    </div>
  )
}
