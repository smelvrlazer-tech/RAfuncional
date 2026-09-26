import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from './Icone'
import { iniciais } from '../lib/texto'

/** Divisor tracejado com "picotes" laterais, como o canhoto de um ticket. */
export function Perfuracao({ className = '' }: { className?: string }) {
  return <div className={`perfuracao ${className}`} role="presentation" />
}

type Variante = 'primario' | 'contorno' | 'texto' | 'escuro'

export function Botao({
  variante = 'primario', carregando = false, children, className = '', disabled, ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      className={`botao botao--${variante} ${className}`}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
    >
      {carregando ? <span className="botao__girando" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}

export function Aviso({
  tom = 'info', children, titulo, role,
}: { tom?: 'info' | 'erro' | 'sucesso' | 'alerta'; children: ReactNode; titulo?: string; role?: 'alert' | 'status' }) {
  const icone = tom === 'sucesso' ? 'check' : tom === 'erro' ? 'info' : tom === 'alerta' ? 'cadeado' : 'info'
  return (
    <div className={`aviso aviso--${tom}`} role={role}>
      <Icone nome={icone} tamanho={18} className="aviso__icone" />
      <div>
        {titulo && <strong className="aviso__titulo">{titulo}</strong>}
        <div className="aviso__texto">{children}</div>
      </div>
    </div>
  )
}

export function Campo({
  rotulo, dica, erro, ...input
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string; erro?: string | null }) {
  const id = useId()
  const idDica = `${id}-dica`
  const idErro = `${id}-erro`
  const descr = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>{rotulo}</label>
      <input id={id} className="campo__entrada" aria-invalid={erro ? true : undefined} aria-describedby={descr} {...input} />
      {dica && <p className="campo__dica" id={idDica}>{dica}</p>}
      {erro && <p className="campo__erro" id={idErro}>{erro}</p>}
    </div>
  )
}

export function Avatar({ nome, className = '' }: { nome: string; className?: string }) {
  return <span className={`avatar ${className}`} aria-hidden="true">{iniciais(nome)}</span>
}

/** Cabeçalho das telas secundárias: voltar + título. */
export function BarraTopo({ titulo, voltarPara = '/' }: { titulo: string; voltarPara?: string }) {
  return (
    <header className="barra-topo">
      <Link to={voltarPara} className="barra-topo__voltar">
        <Icone nome="voltar" tamanho={20} />
        <span className="sr-only">Voltar</span>
      </Link>
      <h1 className="barra-topo__titulo">{titulo}</h1>
    </header>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="carregando__marca" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}
