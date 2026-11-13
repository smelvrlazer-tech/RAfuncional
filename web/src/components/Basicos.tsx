import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone, type NomeIcone } from './Icone'
import { iniciais } from '../lib/texto'

type Variante = 'primario' | 'contorno' | 'texto' | 'escuro' | 'perigo'

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
}: { tom?: 'info' | 'erro' | 'sucesso' | 'alerta'; children?: ReactNode; titulo?: string; role?: 'alert' | 'status' }) {
  const icone = tom === 'sucesso' ? 'check' : tom === 'erro' ? 'info' : tom === 'alerta' ? 'cadeado' : 'info'
  return (
    <div className={`aviso aviso--${tom}`} role={role}>
      <Icone nome={icone} tamanho={18} className="aviso__icone" />
      <div>
        {titulo && <strong className="aviso__titulo">{titulo}</strong>}
        {children != null && <div className="aviso__texto">{children}</div>}
      </div>
    </div>
  )
}

export function Campo({
  rotulo, dica, erro, icone, ...input
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string; erro?: string | null; icone?: NomeIcone }) {
  const id = useId()
  // Campo de senha: botão do olho mostra/oculta o que foi digitado (para conferir antes de entrar).
  const ehSenha = input.type === 'password'
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const idDica = `${id}-dica`
  const idErro = `${id}-erro`
  const descr = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>{rotulo}</label>
      <div className={[icone ? 'campo--com-icone' : '', ehSenha ? 'campo--com-olho' : ''].filter(Boolean).join(' ') || undefined}>
        <input id={id} className="campo__entrada" aria-invalid={erro ? true : undefined} aria-describedby={descr} {...input}
          type={ehSenha && senhaVisivel ? 'text' : input.type} />
        {ehSenha && (
          <button type="button" className="campo__olho" aria-pressed={senhaVisivel} aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setSenhaVisivel((v) => !v)}>
            <Icone nome={senhaVisivel ? 'olhoRiscado' : 'olho'} tamanho={20} />
          </button>
        )}
        {icone && <Icone nome={icone} tamanho={18} className="campo__icone" />}
      </div>
      {dica && <p className="campo__dica" id={idDica}>{dica}</p>}
      {erro && <p className="campo__erro" id={idErro}>{erro}</p>}
    </div>
  )
}

/** Foto da pessoa quando existe; senão as iniciais. */
export function Avatar({ nome, foto, className = '' }: { nome: string; foto?: string | null; className?: string }) {
  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {foto ? <img className="avatar__foto" src={foto} alt="" loading="lazy" /> : iniciais(nome)}
    </span>
  )
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

export function Carregando({ texto = 'Carregando…', limiteMs }: { texto?: string; limiteMs?: number }) {
  const [demorou, setDemorou] = useState(false)
  useEffect(() => {
    if (!limiteMs) return
    const t = window.setTimeout(() => setDemorou(true), limiteMs)
    return () => window.clearTimeout(t)
  }, [limiteMs])
  if (demorou) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return (
      <div className="carregando carregando--demora" role="status">
        <span>{offline ? 'Sem conexão com a internet.' : 'Está demorando mais que o normal.'}</span>
        <span className="carregando__apoio">Verifique sua conexão. Suas reservas continuam salvas.</span>
        <Botao variante="contorno" onClick={() => window.location.reload()}>Tentar de novo</Botao>
      </div>
    )
  }
  return (
    <div className="carregando" role="status">
      <span className="carregando__marca" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

/** Placeholder animado no formato de um cartão de sessão, usado enquanto a lista carrega. */
export function EsqueletoLista({ itens = 3, texto }: { itens?: number; texto: string }) {
  return (
    <div className="esqueleto-lista" role="status" aria-label={texto}>
      {Array.from({ length: itens }, (_, i) => (
        <div className="esqueleto-cartao" key={i} aria-hidden="true">
          <span className="esqueleto-linha esqueleto-linha--hora" />
          <span className="esqueleto-cartao__texto">
            <span className="esqueleto-linha esqueleto-linha--titulo" />
            <span className="esqueleto-linha esqueleto-linha--meta" />
          </span>
        </div>
      ))}
    </div>
  )
}
