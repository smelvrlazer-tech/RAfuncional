import { Link } from 'react-router-dom'
import { formatarHora } from '../../lib/datetime'
import { estadoSessao, textoVagas } from '../../lib/estadoSessao'
import type { LinhaAgenda } from '../../lib/tipos'
import { AcoesSessao } from '../sessao/AcoesSessao'

interface Props {
  sessao: LinhaAgenda
  agora: Date
  ativo: boolean
  limiteMin: number
  onAtualizar: () => Promise<unknown> | void
  indice?: number
}

/**
 * Linha-ingresso da agenda: à esquerda o bloco colorido com a hora (a cor é o estado),
 * à direita nome, vagas/duração e o estado (botão "Reservar", chip de situação).
 * A linha inteira leva ao detalhe (link esticado); os botões ficam por cima do link.
 */
export function CartaoSessao({ sessao, agora, ativo, limiteMin, onAtualizar, indice = 0 }: Props) {
  const estado = estadoSessao(sessao, { agora, ativo, limiteMin })
  const partes = [
    // Vagas só importam enquanto dá para agir; aula cancelada ou encerrada mostra só a duração.
    sessao.cancelada || estado.tom === 'encerrada' ? null : textoVagas(sessao),
    `${sessao.duracao_min} min`,
  ].filter(Boolean)
  return (
    <article
      className={`cartao-sessao cartao-sessao--${estado.tom}`}
      style={{ ['--i' as string]: indice }}
      aria-labelledby={`sessao-${sessao.id}`}
    >
      <Link to={`/sessao/${sessao.id}`} className="cartao-sessao__link">
        <span className="cartao-sessao__hora">{formatarHora(sessao.inicia_em)}</span>
        <span className="cartao-sessao__nome" id={`sessao-${sessao.id}`}>{sessao.turma_nome}</span>
        <span className="cartao-sessao__meta">{partes.join(' · ')}</span>
      </Link>
      <AcoesSessao sessao={sessao} estado={estado} limiteMin={limiteMin} onAtualizar={onAtualizar} compacto />
    </article>
  )
}
