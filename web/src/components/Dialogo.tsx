import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Botao } from './Basicos'

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  aberto: boolean
  titulo: string
  /** Consequências da ação (vira a descrição acessível do diálogo). */
  children: ReactNode
  /** Campos extras (ex.: observação obrigatória), fora da descrição. */
  extra?: ReactNode
  rotuloConfirmar: string
  rotuloCancelar?: string
  onConfirmar: () => void
  onFechar: () => void
  enviando?: boolean
  perigo?: boolean
  confirmarDesabilitado?: boolean
  erro?: string | null
  /** Seletor do elemento que recebe o foco ao abrir. Padrão: o botão de voltar (opção segura). */
  focoInicial?: string
}

/**
 * Modal de confirmação: role="dialog" + aria-modal, foco preso (Tab/Shift+Tab),
 * Escape fecha, o fundo fica `inert` e o foco volta para quem abriu.
 */
export function Dialogo({
  aberto, titulo, children, extra, rotuloConfirmar, rotuloCancelar = 'Voltar', onConfirmar, onFechar,
  enviando = false, perigo = false, confirmarDesabilitado = false, erro, focoInicial,
}: Props) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  const enviandoRef = useRef(enviando)
  enviandoRef.current = enviando

  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    const raiz = document.getElementById('root')
    raiz?.setAttribute('inert', '')
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alvo = (focoInicial && caixa.current?.querySelector<HTMLElement>(focoInicial)) ||
      caixa.current?.querySelector<HTMLElement>('[data-foco-inicial]')
    alvo?.focus()
    return () => {
      raiz?.removeAttribute('inert')
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
    // Só ao abrir/fechar: o foco não deve pular a cada nova renderização.
  }, [aberto])

  if (!aberto) return null

  function teclado(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!enviandoRef.current) fechar.current()
      return
    }
    if (e.key !== 'Tab' || !caixa.current) return
    const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)]
    if (!itens.length) return
    const primeiro = itens[0]!
    const ultimo = itens[itens.length - 1]!
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  return createPortal(
    <div className="veu" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onFechar() }}>
      <div
        ref={caixa}
        className={`dialogo ${perigo ? 'dialogo--perigo' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-descricao`}
        onKeyDown={teclado}
      >
        <h2 className="dialogo__titulo" id={`${id}-titulo`}>{titulo}</h2>
        <div className="dialogo__descricao" id={`${id}-descricao`}>{children}</div>
        {extra}
        {erro && <p className="dialogo__erro" role="alert">{erro}</p>}
        <div className="dialogo__botoes">
          <Botao variante="texto" data-foco-inicial onClick={onFechar} disabled={enviando}>
            {rotuloCancelar}
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'escuro'}
            carregando={enviando}
            disabled={confirmarDesabilitado}
            onClick={onConfirmar}
          >
            {rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </div>,
    document.body,
  )
}
