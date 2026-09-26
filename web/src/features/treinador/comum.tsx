import type { ReactNode } from 'react'
import { Aviso, Botao, Carregando } from '../../components/Basicos'
import { mensagemErro } from '../../lib/erros'

/** Cartão escuro de "sala de controle" no topo de cada tela do treinador. */
export function Controle({
  sobre, titulo, subtitulo, children, compacto = false,
}: { sobre: string; titulo: string; subtitulo?: ReactNode; children?: ReactNode; compacto?: boolean }) {
  return (
    <header className={`controle ${compacto ? 'controle--compacto' : ''}`}>
      <div className="controle__texto">
        <p className="controle__sobre">{sobre}</p>
        <h1 className="controle__titulo">{titulo}</h1>
        {subtitulo && <p className="controle__subtitulo">{subtitulo}</p>}
      </div>
      {children && <div className="controle__lado">{children}</div>}
    </header>
  )
}

interface EstadoProps {
  carregando: boolean
  erro: unknown
  /** true quando já carregou e não há itens. */
  vazio: boolean
  textoCarregando: string
  tituloErro: string
  tituloVazio: string
  textoVazio?: ReactNode
  onTentar: () => void
  children: ReactNode
}

/** Carregando / erro / vazio / conteúdo — o mesmo padrão em toda lista do painel. */
export function EstadoLista({
  carregando, erro, vazio, textoCarregando, tituloErro, tituloVazio, textoVazio, onTentar, children,
}: EstadoProps) {
  if (erro != null) {
    return (
      <Aviso tom="erro" role="alert" titulo={tituloErro}>
        {mensagemErro(erro, { treinador: true })}{' '}
        <Botao variante="texto" onClick={onTentar}>Tentar de novo</Botao>
      </Aviso>
    )
  }
  if (carregando && vazio) return <Carregando texto={textoCarregando} />
  if (vazio) {
    return (
      <div className="vazio">
        <p className="vazio__titulo">{tituloVazio}</p>
        {textoVazio && <div className="vazio__texto">{textoVazio}</div>}
      </div>
    )
  }
  return <>{children}</>
}

export type Retorno = { tom: 'sucesso' | 'erro'; texto: string } | null

/** Resultado das ações, anunciado por leitores de tela (aria-live). */
export function Anuncio({ retorno }: { retorno: Retorno }) {
  return (
    <p className={`anuncio ${retorno ? `anuncio--${retorno.tom}` : ''}`} role="status" aria-live="polite">
      {retorno?.texto ?? ''}
    </p>
  )
}
