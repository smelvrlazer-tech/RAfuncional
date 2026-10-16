import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso, Avatar, Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Icone } from '../../../components/Icone'
import { LISTA_VAZIA, type AlunoNaSessao, type ListaSessao, type Presenca } from '../../../lib/checkins'
import { chaveDiaSP, formatarIntervalo, rotuloDiaLongo } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import { estadoAula } from '../../../lib/estadoAula'
import { useAgora, useLimiteBloqueio } from '../../agenda/useAgenda'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { buscarAula, buscarListas, cancelarAula, marcarPresenca, removerAluno } from '../painel/api'
import { useCarga } from '../useCarga'
import { consequenciaRemocao, DialogoCancelar, DialogoRemover, type AlvoRemocao } from './DialogosSessao'

async function carregar(id: string) {
  const aula = await buscarAula(id)
  const listas = aula ? await buscarListas([aula.id]) : new Map<string, ListaSessao>()
  return { aula, lista: listas.get(id) ?? LISTA_VAZIA }
}

function ListaAlunos({ titulo, alunos, fila, onRemover, podeRemover, onPresenca }: {
  titulo: string; alunos: AlunoNaSessao[]; fila?: boolean; podeRemover: boolean; onRemover: (a: AlunoNaSessao) => void
  /** Só quando a aula já começou: mostra Compareceu / Faltou ao lado de cada confirmado. */
  onPresenca?: (a: AlunoNaSessao, p: Presenca | null) => void
}) {
  const Tag = fila ? 'ol' : 'ul'
  return (
    <section className="cartao lista-sessao" aria-label={titulo}>
      <h2 className="cartao__titulo">{titulo} <span className="lista-sessao__num">({alunos.length})</span></h2>
      {alunos.length === 0 ? (
        <p className="aula__nada">{fila ? 'Ninguém na lista de espera.' : 'Ninguém confirmado.'}</p>
      ) : (
        <Tag className="lista-sessao__itens">
          {alunos.map((a, i) => (
            <li key={a.alunoId} className="lista-sessao__item">
              {fila ? <span className="chamada__pos">{i + 1}º</span> : <Avatar nome={a.nome} foto={a.foto} className="avatar--mini" />}
              <span className="lista-sessao__nome">{a.nome}</span>
              {onPresenca && (
                <span className="presenca" role="group" aria-label={`Presença de ${a.nome}`}>
                  {(['compareceu', 'faltou'] as const).map((p) => (
                    <button key={p} type="button" className={`presenca__opcao presenca__opcao--${p}`} aria-pressed={a.presenca === p}
                      onClick={() => onPresenca(a, a.presenca === p ? null : p)}>
                      {p === 'compareceu' ? 'Compareceu' : 'Faltou'}
                    </button>
                  ))}
                </span>
              )}
              {podeRemover && (
                <Botao variante="texto" onClick={() => onRemover(a)} aria-label={`Remover ${a.nome}`}>Remover</Botao>
              )}
            </li>
          ))}
        </Tag>
      )}
    </section>
  )
}

export function SessaoTreinador() {
  const { id = '' } = useParams()
  const agora = useAgora()
  const limiteMin = useLimiteBloqueio()
  const { dados, erro, carregando, recarregar, substituir } = useCarga(() => carregar(id), id)
  const [alvo, setAlvo] = useState<AlvoRemocao | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)

  const aula = dados?.aula
  const lista = dados?.lista ?? LISTA_VAZIA
  const estado = aula ? estadoAula(aula, agora, limiteMin) : null
  const voltar = aula ? `/treinador/chamada?dia=${chaveDiaSP(aula.inicia_em)}` : '/treinador/chamada'

  function fechar() { setAlvo(null); setCancelando(false); setErroDialogo(null) }

  async function executar(acao: () => Promise<string>) {
    setEnviando(true)
    setErroDialogo(null)
    try {
      const texto = await acao()
      setRetorno({ tom: 'sucesso', texto })
      fechar()
    } catch (e) {
      setErroDialogo(mensagemErro(e, { treinador: true, limiteMin }))
      await recarregar()
    } finally {
      setEnviando(false)
    }
  }

  async function presenca(a: AlunoNaSessao, p: Presenca | null) {
    try {
      await marcarPresenca(id, a.alunoId, p)
      substituir(await carregar(id))
      setRetorno(null)
    } catch (e) {
      setRetorno({ tom: 'erro', texto: mensagemErro(e, { treinador: true, limiteMin }) })
    }
  }

  const remover = () => alvo && executar(async () => {
    const primeiro = lista.espera[0]
    await removerAluno(id, alvo.aluno.alunoId)
    const novo = await carregar(id)
    substituir(novo)
    const promovido = alvo.confirmado && primeiro && novo.lista.confirmados.some((a) => a.alunoId === primeiro.alunoId)
    return `${alvo.aluno.nome} foi removido(a) e notificado(a).` +
      (promovido ? ` ${primeiro.nome} saiu da fila e agora está confirmado(a).` : '')
  })

  const cancelar = (obs: string) => executar(async () => {
    const avisados = await cancelarAula(id, obs)
    await recarregar()
    return `Aula cancelada. ${avisados === 1 ? '1 pessoa avisada' : `${avisados} pessoas avisadas`}.`
  })

  return (
    <div className="tela-treinador">
      <Link to={voltar} className="voltar-painel"><Icone nome="voltar" /> Voltar ao painel</Link>
      <EstadoLista
        carregando={carregando}
        erro={erro}
        vazio={!aula}
        textoCarregando="Carregando a aula…"
        tituloErro="Não foi possível carregar a aula"
        tituloVazio="Aula não encontrada"
        textoVazio={<Link to="/treinador/chamada" className="botao botao--contorno">Ir para o painel</Link>}
        onTentar={() => void recarregar()}
      >
        {aula && estado && (
          <>
            <Controle
              sobre={rotuloDiaLongo(chaveDiaSP(aula.inicia_em))}
              titulo={aula.turma_nome}
              subtitulo={`${formatarIntervalo(aula.inicia_em, aula.duracao_min)} · ${aula.duracao_min} min`}
            >
              <div className="controle__status"><Chip tom={estado.tom}>{estado.rotulo}</Chip></div>
              <dl className="placar">
                <div><dt>Confirmados</dt><dd>{lista.confirmados.length}/{aula.vagas}</dd></div>
                <div><dt>Na fila</dt><dd>{lista.espera.length}</dd></div>
              </dl>
            </Controle>

            {aula.cancelada && (
              <Aviso tom="alerta" titulo="Esta aula foi cancelada">
                {aula.observacao ? `Motivo informado aos alunos: ${aula.observacao}` : 'Sem motivo registrado.'}
              </Aviso>
            )}
            <Anuncio retorno={retorno} />

            <div className="sessao-grade">
              <ListaAlunos titulo="Confirmados" alunos={lista.confirmados} podeRemover={!aula.cancelada}
                onRemover={(a) => setAlvo({ aluno: a, confirmado: true })}
                onPresenca={estado.comecou && !aula.cancelada ? (a, p) => void presenca(a, p) : undefined} />
              <ListaAlunos titulo="Lista de espera" alunos={lista.espera} fila podeRemover={!aula.cancelada}
                onRemover={(a) => setAlvo({ aluno: a, confirmado: false })} />
            </div>

            {!aula.cancelada && !estado.comecou && (
              <section className="cartao zona-perigo" aria-labelledby="titulo-cancelar">
                <h2 className="cartao__titulo" id="titulo-cancelar">Cancelar a aula</h2>
                <p>Confirmados e fila são avisados com o motivo.</p>
                <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar esta aula</Botao>
              </section>
            )}

            <DialogoRemover
              alvo={alvo}
              texto={alvo ? consequenciaRemocao(alvo, lista, estado.fechada, limiteMin) : ''}
              enviando={enviando}
              erro={erroDialogo}
              onConfirmar={() => void remover()}
              onFechar={fechar}
            />
            <DialogoCancelar aberto={cancelando} lista={lista} enviando={enviando} erro={erroDialogo}
              onConfirmar={(obs) => void cancelar(obs)} onFechar={fechar} />
          </>
        )}
      </EstadoLista>
    </div>
  )
}
