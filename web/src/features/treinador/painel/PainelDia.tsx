import { useSearchParams } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { LISTA_VAZIA, resumoDia } from '../../../lib/checkins'
import { chaveDiaSP, rotuloDiaLongo, somarDias } from '../../../lib/datetime'
import { rotuloRelativo } from '../../../lib/semana'
import { useAgora, useLimiteBloqueio } from '../../agenda/useAgenda'
import { Controle, EstadoLista } from '../comum'
import { useCarga } from '../useCarga'
import { buscarAulasDoDia, buscarListas } from './api'
import { CartaoAula } from './CartaoAula'

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/

async function carregarDia(chave: string) {
  const aulas = await buscarAulasDoDia(chave)
  const listas = await buscarListas(aulas.map((a) => a.id))
  return { aulas, listas }
}

export function PainelDia() {
  const agora = useAgora()
  const limiteMin = useLimiteBloqueio()
  const hoje = chaveDiaSP(agora)
  const [params, setParams] = useSearchParams()
  const pedido = params.get('dia')
  const dia = pedido && DIA_VALIDO.test(pedido) ? pedido : hoje
  const { dados, erro, carregando, recarregar } = useCarga(() => carregarDia(dia), dia)

  const irPara = (chave: string) => setParams(chave === hoje ? {} : { dia: chave }, { replace: true })
  const relativo = rotuloRelativo(dia, hoje)
  const resumo = resumoDia(dados?.aulas ?? [])
  const atalhos: [string, string][] = [['Ontem', somarDias(hoje, -1)], ['Hoje', hoje], ['Amanhã', somarDias(hoje, 1)]]

  return (
    <div className="tela-treinador">
      {/* O dia é o título: é o que muda nesta tela. "Hoje"/"Amanhã" vai acima como contexto. */}
      <Controle sobre={relativo ?? 'Painel do dia'} titulo={rotuloDiaLongo(dia)}>
        <nav className="navegar-dia" aria-label="Escolher o dia">
          <button type="button" className="navegar-dia__seta" onClick={() => irPara(somarDias(dia, -1))}>
            <Icone nome="voltar" tamanho={20} /><span className="sr-only">Dia anterior</span>
          </button>
          <div className="navegar-dia__atalhos">
            {atalhos.map(([rotulo, chave]) => (
              <button key={rotulo} type="button" className="navegar-dia__atalho" aria-pressed={dia === chave}
                onClick={() => irPara(chave)}>
                {rotulo}
              </button>
            ))}
          </div>
          <button type="button" className="navegar-dia__seta" onClick={() => irPara(somarDias(dia, 1))}>
            <Icone nome="seta" tamanho={20} /><span className="sr-only">Próximo dia</span>
          </button>
        </nav>
        <dl className="placar">
          <div><dt>Aulas</dt><dd>{dados ? resumo.aulas : '–'}</dd></div>
          <div><dt>Confirmados</dt><dd>{dados ? `${resumo.confirmados}/${resumo.vagas}` : '–'}</dd></div>
          <div><dt>Na fila</dt><dd>{dados ? resumo.fila : '–'}</dd></div>
        </dl>
      </Controle>

      <section aria-labelledby="titulo-aulas" aria-busy={carregando}>
        <h2 id="titulo-aulas" className="sr-only">Aulas de {rotuloDiaLongo(dia)}</h2>
        <EstadoLista
          carregando={carregando}
          erro={erro}
          vazio={!dados?.aulas.length}
          textoCarregando="Carregando as aulas do dia…"
          tituloErro="Não foi possível carregar o painel"
          tituloVazio="Nenhuma aula neste dia"
          textoVazio="As aulas vêm das turmas semanais. Confira a tela Turmas ou escolha outro dia."
          onTentar={() => void recarregar()}
        >
          <ul className="grade-aulas">
            {dados?.aulas.map((a) => (
              <li key={a.id}>
                <CartaoAula aula={a} lista={dados.listas.get(a.id) ?? LISTA_VAZIA} agora={agora} limiteMin={limiteMin} />
              </li>
            ))}
          </ul>
        </EstadoLista>
      </section>
    </div>
  )
}
