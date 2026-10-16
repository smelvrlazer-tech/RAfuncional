import { Aviso, Botao, EsqueletoLista } from '../../components/Basicos'
import { Chip } from '../../components/Chip'
import { chaveDiaSP, formatarHora, rotuloDiaLongo } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { useCarga } from '../treinador/useCarga'
import { buscarHistorico } from './api'

/** Aulas já encerradas, com a presença marcada pelo treinador. */
export function Historico() {
  const { dados, erro, carregando, recarregar } = useCarga(buscarHistorico, 'historico')

  if (erro != null) {
    return (
      <Aviso tom="erro" role="alert" titulo="Não foi possível carregar seu histórico">
        {mensagemErro(erro)} <Botao variante="texto" onClick={() => void recarregar()}>Tentar de novo</Botao>
      </Aviso>
    )
  }
  if (carregando && !dados) return <EsqueletoLista texto="Carregando seu histórico…" itens={3} />
  const aulas = dados ?? []
  if (aulas.length === 0) {
    return (
      <div className="vazio">
        <p className="vazio__titulo">Nada por aqui ainda</p>
        <p className="vazio__texto">Suas aulas aparecem aqui depois que terminam.</p>
      </div>
    )
  }
  const presentes = aulas.filter((a) => a.presenca === 'compareceu').length

  return (
    <section className="historico" aria-labelledby="titulo-historico">
      <div className="dia-agenda__cabeca">
        <h2 id="titulo-historico" className="dia-agenda__titulo">Histórico</h2>
        <p className="dia-agenda__contagem">{presentes} de {aulas.length} com presença</p>
      </div>
      <ol className="lista-sessoes">
        {aulas.map((a) => (
          <li key={a.sessao_id} className="historico__item">
            <span className="historico__hora">{formatarHora(a.inicia_em)}</span>
            <span className="historico__texto">
              <span className="historico__nome">{a.turma_nome}</span>
              <span className="historico__dia">{rotuloDiaLongo(chaveDiaSP(a.inicia_em))}</span>
            </span>
            {a.presenca === 'compareceu'
              ? <Chip tom="confirmado">Compareceu</Chip>
              : <Chip tom="cancelada">{a.marcada ? 'Faltou' : 'Sem marcação'}</Chip>}
          </li>
        ))}
      </ol>
    </section>
  )
}
