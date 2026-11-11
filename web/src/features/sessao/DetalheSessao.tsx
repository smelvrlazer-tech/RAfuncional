import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, BarraTopo, Botao, Carregando } from '../../components/Basicos'
import { Icone } from '../../components/Icone'
import {
  chaveDiaSP, formatarHora, formatarIntervalo, formatarPrazo, formatarPrazoExtenso, rotuloDiaLongo,
} from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { estadoSessao, fracaoOcupada, proximaComVaga, tempoParaFechar, textoVagas } from '../../lib/estadoSessao'
import { blocosDoTreino, descreverVideo } from '../../lib/texto'
import type { LinhaAgenda } from '../../lib/tipos'
import { enderecoNoPainel } from '../../lib/rotas'
import { useAoFocar } from '../../lib/useFoco'
import { buscarAgenda, buscarSessao } from '../agenda/api'
import { DIAS_AGENDA, useAgora, useLimiteBloqueio } from '../agenda/useAgenda'
import { Capa } from '../../components/Capa'
import { Coach } from '../../components/Coach'
import { AcoesSessao } from './AcoesSessao'
import { QuemVai } from './QuemVai'

/** Vídeo do treino: o treino é presencial, então a demonstração é só um link discreto. */
function BlocoVideo({ url }: { url: string }) {
  const info = descreverVideo(url)
  if (!info.seguro) return null
  return (
    <a className="video" href={url} target="_blank" rel="noopener noreferrer">
      <span className="video__play" aria-hidden="true"><Icone nome="play" tamanho={14} /></span>
      <span className="video__titulo">Ver demonstração em vídeo</span>
      <span className="video__link">{info.plataforma} <span className="sr-only">(abre em nova aba)</span> ↗</span>
    </a>
  )
}

interface PropsDetalhe {
  /** Aula a mostrar. Sem ela, vem da rota (/sessao/:id). */
  id?: string
  /** Dentro da agenda no computador: sem barra de voltar e com links que abrem no painel. */
  embutido?: boolean
  /** Chamado depois de reservar/cancelar, para quem mostra a lista ao lado atualizar também. */
  aoMudar?: () => Promise<unknown> | void
}

export function DetalheSessao({ id: idProp, embutido = false, aoMudar }: PropsDetalhe = {}) {
  const params = useParams()
  const id = idProp ?? params.id ?? ''
  const { perfil } = useAuth()
  const agora = useAgora()
  const limiteMin = useLimiteBloqueio()
  const [sessao, setSessao] = useState<LinhaAgenda | null | undefined>(undefined)
  const [erro, setErro] = useState<unknown>(null)

  const recarregar = useCallback(async () => {
    try {
      setSessao(await buscarSessao(id))
      setErro(null)
    } catch (e) {
      setErro(e)
    }
  }, [id])

  useEffect(() => { void recarregar() }, [recarregar])
  useAoFocar(() => void recarregar())

  // Aula lotada e o aluno fora dela: busca as próximas para sugerir uma com vaga.
  const [seguintes, setSeguintes] = useState<LinhaAgenda[]>([])
  const lotadaSemMim = !!sessao && !sessao.cancelada && sessao.vagas_restantes <= 0 && sessao.meu_status === null
  const inicioAula = sessao?.inicia_em
  useEffect(() => {
    if (!lotadaSemMim || !inicioAula) { setSeguintes([]); return }
    let vivo = true
    const de = new Date(inicioAula)
    buscarAgenda(de, new Date(de.getTime() + DIAS_AGENDA * 86_400_000))
      .then((l) => vivo && setSeguintes(l))
      .catch(() => vivo && setSeguintes([])) // é só uma sugestão: se falhar, some sem barulho
    return () => { vivo = false }
  }, [lotadaSemMim, inicioAula])

  const voltar = sessao ? `/agenda?dia=${chaveDiaSP(sessao.inicia_em)}` : '/agenda'
  const barra = embutido ? null : <BarraTopo titulo="Aula" />
  const atualizar = async () => {
    await recarregar()
    await aoMudar?.()
  }

  if (sessao === undefined && !erro) {
    return <div className="tela">{barra}<Carregando texto="Carregando a aula…" /></div>
  }
  if (!sessao) {
    return (
      <div className="tela">
        {barra}
        {erro ? (
          <Aviso tom="erro" role="alert" titulo="Não foi possível carregar">
            {mensagemErro(erro)} <Botao variante="texto" onClick={() => void recarregar()}>Tentar de novo</Botao>
          </Aviso>
        ) : (
          <div className="vazio">
            <p className="vazio__titulo">Aula não encontrada</p>
            <Link className="botao botao--contorno" to="/agenda">Voltar para a agenda</Link>
          </div>
        )}
      </div>
    )
  }

  const estadoBase = estadoSessao(sessao, { agora, ativo: perfil?.ativo ?? true, limiteMin })
  const blocos = blocosDoTreino(sessao.treino_descricao)
  // Check-in fechado: o cartão "Check-in encerrado" explica a regra; o motivo curto não se repete.
  const encerrado = estadoBase.tom === 'bloqueada'
  const estado = encerrado ? { ...estadoBase, motivo: null } : estadoBase
  // Só mostra o relógio quando ainda há algo a fazer e o prazo está perto.
  const tempo = estado.acao ? tempoParaFechar(sessao, { agora, limiteMin }) : null
  const sugestao = estado.tom === 'lotada' ? proximaComVaga(seguintes, sessao, { agora, limiteMin }) : null

  return (
    <div className={`tela ${embutido ? 'tela--detalhe-embutido' : 'tela--detalhe'}`}>
      {!embutido && <BarraTopo titulo={rotuloDiaLongo(chaveDiaSP(sessao.inicia_em))} voltarPara={voltar} />}

      <Capa como="header" className={`detalhe-aula detalhe-aula--${estado.tom}`}>
        <h2 className="detalhe-aula__titulo">{sessao.turma_nome}</h2>
        <p className="detalhe-aula__coach"><Coach /></p>
        <p className="detalhe-aula__meta">
          {formatarIntervalo(sessao.inicia_em, sessao.duracao_min)} · {sessao.duracao_min} min
        </p>
        {!sessao.cancelada && (
          <div className="detalhe-aula__vagas">
            <span>{textoVagas(sessao)}</span>
            <span className="barra-vagas barra-vagas--larga" role="img"
              aria-label={`${sessao.confirmados} de ${sessao.vagas} vagas ocupadas`}>
              <span className="barra-vagas__preenchido" style={{ width: `${Math.round(fracaoOcupada(sessao) * 100)}%` }} />
            </span>
          </div>
        )}
      </Capa>

      <section className="treino" aria-labelledby="treino-titulo">
        <h3 className="treino__sobre" id="treino-titulo">Treino do dia</h3>
        {sessao.treino_titulo ? (
          <>
            <p className="treino__titulo">{sessao.treino_titulo}</p>
            {blocos.length > 0 && (
              <ol className="treino__blocos">
                {blocos.map((b, i) => (
                  <li key={i} className="bloco-treino">
                    {b.titulo && <strong className="bloco-treino__titulo">{b.titulo}</strong>}
                    <p className="bloco-treino__texto">{b.texto}</p>
                  </li>
                ))}
              </ol>
            )}
            {sessao.treino_video_url && <BlocoVideo url={sessao.treino_video_url} />}
          </>
        ) : (
          <div className="em-breve">
            <p className="em-breve__titulo">Ainda não publicado</p>
            <p className="em-breve__texto">Os treinos da semana saem no sábado de manhã.</p>
          </div>
        )}
      </section>

      {!sessao.cancelada && <QuemVai sessaoId={sessao.id} versao={sessao.confirmados} />}

      {sugestao && (
        <Link className="sugestao" to={embutido ? enderecoNoPainel(sugestao) : `/sessao/${sugestao.id}`}>
          <span className="sugestao__texto">
            <span className="sugestao__sobre">Próxima aula com vaga</span>
            <span className="sugestao__titulo">{sugestao.turma_nome} · {formatarHora(sugestao.inicia_em)}</span>
            <span className="sugestao__meta">{rotuloDiaLongo(chaveDiaSP(sugestao.inicia_em))} · {textoVagas(sugestao)}</span>
          </span>
          <Icone nome="seta" tamanho={20} />
        </Link>
      )}

      {encerrado && (
        <section className="encerrado" aria-labelledby="encerrado-titulo">
          <span className="encerrado__icone" aria-hidden="true"><Icone nome="cadeado" tamanho={22} /></span>
          <div>
            <h3 className="encerrado__titulo" id="encerrado-titulo">Check-in encerrado</h3>
            <p className="encerrado__texto">
              O check-in fecha {formatarPrazoExtenso(limiteMin)} antes da aula, e esse prazo já passou para esta aula.
            </p>
          </div>
        </section>
      )}

      <section className="barra-acao" aria-label="Sua presença">
        {tempo && (
          <div className="prazo">
            <p className="prazo__texto">
              <Icone nome="relogio" tamanho={16} />
              {estado.acao === 'cancelar' || estado.acao === 'sair_fila' ? 'Cancelamento' : 'Check-in'} fecha em{' '}
              <strong>{formatarPrazo(tempo.restanteMin)}</strong>
            </p>
            <span className="prazo__barra" aria-hidden="true">
              <span className="prazo__restante" style={{ width: `${Math.round(tempo.fracao * 100)}%` }} />
            </span>
          </div>
        )}
        {encerrado && (
          <Botao variante="primario" className="botao--largo" disabled>Check-in indisponível</Botao>
        )}
        <AcoesSessao sessao={sessao} estado={estado} limiteMin={limiteMin} onAtualizar={atualizar} grande />
      </section>
    </div>
  )
}
