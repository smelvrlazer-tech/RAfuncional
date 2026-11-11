import type { ReactNode } from 'react'
import { constanciaDoMes, resumoDaMeta, type MeuPainel } from '../../lib/inicio'
import { nomeDoMes } from '../../lib/frequencia'

/** Anel de constância do mês (presenças sobre aulas reservadas já encerradas). */
export function AnelConstancia({ percentual }: { percentual: number }) {
  const raio = 34
  const comprimento = 2 * Math.PI * raio
  return (
    <svg className="anel" viewBox="0 0 80 80" role="img" aria-label={`Constância de ${percentual}% no mês`}>
      <circle cx="40" cy="40" r={raio} className="anel__fundo" />
      <circle cx="40" cy="40" r={raio} className="anel__valor" strokeDasharray={`${(percentual / 100) * comprimento} ${comprimento}`}
        transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle" className="anel__texto">{percentual}%</text>
    </svg>
  )
}

/** Constância do mês e meta do trimestre com o nível (Bronze, Prata, Ouro). */
export function Desempenho({ painel, hoje, children }: { painel: MeuPainel; hoje: string; children?: ReactNode }) {
  const constancia = constanciaDoMes(painel.compareceu_mes, painel.reservas_mes)
  const meta = resumoDaMeta(painel.compareceu_trimestre, painel.meta_trimestre)
  return (
    <section className="desempenho" aria-labelledby="titulo-desempenho">
      <h2 className="desempenho__titulo" id="titulo-desempenho">Seu desempenho em {nomeDoMes(hoje)}</h2>
      <div className="desempenho__mes">
        <div>
          <p className="desempenho__numero">{painel.compareceu_mes} <span>{painel.compareceu_mes === 1 ? 'aula' : 'aulas'}</span></p>
          <p className="desempenho__apoio">com presença confirmada pelo treinador</p>
        </div>
        <AnelConstancia percentual={constancia} />
      </div>
      <div className="desempenho__meta">
        <div className="desempenho__meta-linha">
          <p>Meta do trimestre: <strong>{painel.meta_trimestre} aulas</strong></p>
          <p className={`nivel nivel--${meta.nivel}`}>{meta.rotulo}</p>
        </div>
        <span className="barra-vagas barra-vagas--larga" role="img" aria-label={`${painel.compareceu_trimestre} de ${painel.meta_trimestre} aulas no trimestre`}>
          <span className="barra-vagas__preenchido" style={{ width: `${meta.percentual}%` }} />
        </span>
        <p className="desempenho__apoio">
          {painel.compareceu_trimestre} de {painel.meta_trimestre} concluídas
          {meta.nivel === 'ouro' ? ' · Meta cumprida!' : ` · faltam ${meta.faltamParaOuro} para o Ouro`}
        </p>
      </div>
      {children}
    </section>
  )
}
