import { Link } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { formatarHora } from '../../lib/datetime'
import { estadoSessao, resumoLinha } from '../../lib/estadoSessao'
import type { LinhaAgenda } from '../../lib/tipos'
import { AcoesSessao } from '../sessao/AcoesSessao'

interface Props {
  sessao: LinhaAgenda
  agora: Date
  ativo: boolean
  limiteMin: number
  onAtualizar: () => Promise<unknown> | void
  /** Para onde a linha leva. Padrão: a página da aula; no computador, o painel ao lado. */
  para?: string
  /** A aula que está aberta no painel (computador). */
  aberta?: boolean
}

/**
 * Linha da agenda (quadro de horários): hora em fonte de placar, nome, vagas/duração e, à
 * direita, a situação ("Confirmada", "Na fila") ou a ação ("Reservar", "Entrar na fila").
 * A linha inteira leva ao detalhe (link esticado); os botões ficam por cima do link.
 */
export function CartaoSessao({ sessao, agora, ativo, limiteMin, onAtualizar, para, aberta = false }: Props) {
  const estado = estadoSessao(sessao, { agora, ativo, limiteMin })
  return (
    <article
      className={`cartao-sessao cartao-sessao--${estado.tom} ${aberta ? 'cartao-sessao--aberta' : ''}`}
      aria-labelledby={`sessao-${sessao.id}`}
    >
      <Link
        to={para ?? `/sessao/${sessao.id}`}
        replace={!!para}
        aria-current={aberta ? 'true' : undefined}
        className="cartao-sessao__link"
      >
        <span className="cartao-sessao__hora">{formatarHora(sessao.inicia_em)}</span>
        <span className="cartao-sessao__nome" id={`sessao-${sessao.id}`}>{sessao.turma_nome}</span>
        {/* Confirmado / na fila: a situação vira o texto da linha, e à direita fica só a ação quieta. */}
        {estado.tom === 'confirmado' || estado.tom === 'espera' ? (
          <span className={`cartao-sessao__meta cartao-sessao__meta--${estado.tom}`}>
            <Icone nome={estado.tom === 'confirmado' ? 'check' : 'fila'} tamanho={14} />
            {estado.tom === 'confirmado'
              ? 'Confirmado'
              : `Na fila${sessao.minha_posicao ? ` · Nº${sessao.minha_posicao}` : ''}`}
          </span>
        ) : (
          <span className="cartao-sessao__meta">{resumoLinha(sessao, agora)}</span>
        )}
      </Link>
      <AcoesSessao sessao={sessao} estado={estado} limiteMin={limiteMin} onAtualizar={onAtualizar} compacto />
      {!sessao.cancelada && estado.tom !== 'encerrada' && (
        <span className="barra-vagas barra-vagas--linha" aria-hidden="true">
          <span className="barra-vagas__preenchido" style={{ width: `${Math.min(100, Math.round((sessao.confirmados / sessao.vagas) * 100))}%` }} />
        </span>
      )}
    </article>
  )
}
