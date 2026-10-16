import { Link } from 'react-router-dom'
import { Avatar } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Icone } from '../../../components/Icone'
import type { ListaSessao } from '../../../lib/checkins'
import { formatarHora, formatarIntervalo } from '../../../lib/datetime'
import { estadoAula } from '../../../lib/estadoAula'
import type { AulaTreinador } from './api'

interface Props {
  aula: AulaTreinador
  lista: ListaSessao
  agora: Date
  limiteMin: number
}

/**
 * Cartão de uma aula no painel do dia. O cartão inteiro leva à visão da sessão.
 * Check-in aberto é o normal: só o prazo aparece. Os outros estados (encerrada, lotada,
 * cancelada...) ganham selo. Confirmados com ✓ e a fila de espera no rodapé.
 */
export function CartaoAula({ aula, lista, agora, limiteMin }: Props) {
  const estado = estadoAula(aula, agora, limiteMin)
  const idTitulo = `aula-${aula.id}`
  const ocupacao = aula.vagas > 0 ? Math.min(1, lista.confirmados.length / aula.vagas) : 1
  const aberta = estado.tom === 'disponivel'
  const fechaAs = formatarHora(new Date(new Date(aula.inicia_em).getTime() - limiteMin * 60_000))
  return (
    <article className={`aula aula--${estado.tom}`} aria-labelledby={idTitulo}>
      <div className="aula__faixa">
        {aberta
          ? <span className="aula__prazo">Check-in fecha às {fechaAs}</span>
          : <Chip tom={estado.tom}>{estado.rotulo}</Chip>}
      </div>

      <div className="aula__corpo">
        <div className="aula__cabeca">
          <span className="aula__hora">{formatarHora(aula.inicia_em)}</span>
          <div className="aula__info">
            <h3 className="aula__nome" id={idTitulo}>
              <Link to={`/treinador/sessao/${aula.id}`} className="aula__link">{aula.turma_nome}</Link>
            </h3>
            <p className="aula__meta">
              {formatarIntervalo(aula.inicia_em, aula.duracao_min)}
              {aula.treino_titulo ? ` · ${aula.treino_titulo}` : ''}
            </p>
          </div>
          <p className="aula__placar" aria-label={`${lista.confirmados.length} confirmados de ${aula.vagas} vagas`}>
            <span className="aula__placar-num">{lista.confirmados.length}<span>/{aula.vagas}</span></span>
            <span className="aula__placar-rotulo">confirmados</span>
          </p>
        </div>

        {!aula.cancelada && (
          <span className="barra-vagas barra-vagas--larga" aria-hidden="true">
            <span className="barra-vagas__preenchido" style={{ width: `${Math.round(ocupacao * 100)}%` }} />
          </span>
        )}
        {aula.cancelada && aula.observacao && <p className="aula__obs">Motivo: {aula.observacao}</p>}

        <div className="aula__listas">
          <div>
            <p className="aula__rotulo">Confirmados</p>
            {lista.confirmados.length ? (
              <ul className="chamada">
                {lista.confirmados.map((a) => (
                  <li key={a.alunoId} className="chamada__item">
                    <Avatar nome={a.nome} foto={a.foto} className="avatar--mini" />
                    <span className="chamada__nome">{a.nome}</span>
                    <Icone nome="check" tamanho={18} className="chamada__ok" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="aula__nada">Ninguém confirmado ainda.</p>
            )}
          </div>
        </div>
      </div>

      {lista.espera.length > 0 && (
        <div className="aula__fila-faixa">
          <p className="aula__rotulo">
            Lista de espera <span className="aula__fila"><strong>Fila: {lista.espera.length}</strong></span>
          </p>
          <ol className="chamada chamada--fila">
            {lista.espera.map((a, i) => (
              <li key={a.alunoId} className="chamada__item">
                <span className="chamada__pos" aria-label={`${i + 1}º da fila`}>{i + 1}º</span>
                <span className="chamada__nome">{a.nome}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
