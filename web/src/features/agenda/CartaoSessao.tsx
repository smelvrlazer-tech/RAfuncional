import { Link } from 'react-router-dom'
import { Perfuracao } from '../../components/Basicos'
import { formatarHora } from '../../lib/datetime'
import { estadoSessao, fracaoOcupada, textoVagas } from '../../lib/estadoSessao'
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

export function CartaoSessao({ sessao, agora, ativo, limiteMin, onAtualizar, indice = 0 }: Props) {
  const estado = estadoSessao(sessao, { agora, ativo, limiteMin })
  const cheia = sessao.vagas_restantes <= 0
  const ocupacao = fracaoOcupada(sessao)
  return (
    <article
      className={`cartao-sessao cartao-sessao--${estado.tom}`}
      style={{ ['--i' as string]: indice }}
      aria-labelledby={`sessao-${sessao.id}`}
    >
      <Link to={`/sessao/${sessao.id}`} className="cartao-sessao__link">
        <span className="cartao-sessao__hora">{formatarHora(sessao.inicia_em)}</span>
        <span className="cartao-sessao__info">
          <span className="cartao-sessao__nome" id={`sessao-${sessao.id}`}>{sessao.turma_nome}</span>
          <span className="cartao-sessao__meta">
            {sessao.duracao_min} min{sessao.treino_titulo ? ` · ${sessao.treino_titulo}` : ''}
          </span>
        </span>
        {!sessao.cancelada && (
          <span className="cartao-sessao__vagas">
            <span className={`cartao-sessao__vagas-texto ${cheia ? 'cartao-sessao__vagas-texto--cheia' : ''}`}>
              {textoVagas(sessao)}
            </span>
            <span
              className="barra-vagas"
              role="img"
              aria-label={`${sessao.confirmados} de ${sessao.vagas} vagas ocupadas`}
            >
              <span className="barra-vagas__preenchido" style={{ width: `${Math.round(ocupacao * 100)}%` }} />
            </span>
          </span>
        )}
      </Link>
      <Perfuracao />
      <AcoesSessao sessao={sessao} estado={estado} limiteMin={limiteMin} onAtualizar={onAtualizar} />
    </article>
  )
}
