import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Avatar, Botao, EsqueletoLista } from '../../components/Basicos'
import { Capa } from '../../components/Capa'
import { Coach } from '../../components/Coach'
import { Icone } from '../../components/Icone'
import { chaveDiaSP, formatarHora, formatarIntervalo, rotuloDiaLongo } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { constanciaDoMes, resumoDaMeta } from '../../lib/inicio'
import { proximaAulaMinha, rotuloQuando } from '../../lib/proximaAula'
import { blocosDoTreino } from '../../lib/texto'
import { useEstudio, useMeuPainel, useUltimoAviso } from '../../lib/useInicio'
import { CartaoSessao } from '../agenda/CartaoSessao'
import { useAgenda, useLimiteBloqueio } from '../agenda/useAgenda'
import { PlanoEtiqueta } from '../minhas-aulas/PlanoEtiqueta'

/** Tela inicial do aluno: próxima aula, números do mês, treino e horários de hoje, recado do treinador. */
export function InicioAluno() {
  const { perfil } = useAuth()
  const { agora, hoje, porDia, linhas, erro, recarregar } = useAgenda()
  const limiteMin = useLimiteBloqueio()
  const painel = useMeuPainel()
  const estudio = useEstudio()
  const aviso = useUltimoAviso()

  const ativo = perfil?.ativo ?? true
  const primeiroNome = (perfil?.nome ?? '').split(/\s+/)[0] ?? ''
  const proxima = linhas ? proximaAulaMinha(linhas, agora) : null
  const hojeAulas = porDia.get(hoje) ?? []
  const comTreino = hojeAulas.find((s) => s.treino_titulo)
  const blocos = blocosDoTreino(comTreino?.treino_descricao).slice(0, 2)
  const meta = painel ? resumoDaMeta(painel.compareceu_trimestre, painel.meta_trimestre) : null

  return (
    <div className="tela tela--inicio">
      <Capa foto="inicio" className="inicio__capa">
      <header className="inicio__topo">
        <div className="inicio__texto">
          <h1 className="inicio__titulo">Olá, {primeiroNome || 'bem-vindo'}</h1>
          <p className="inicio__data">{rotuloDiaLongo(hoje)}</p>
          <PlanoEtiqueta />
        </div>
        <Link to="/perfil" className="inicio__avatar" aria-label="Abrir meu perfil">
          <Avatar nome={perfil?.nome ?? ''} foto={perfil?.foto_url} />
        </Link>
      </header>

      {linhas === null && !erro ? (
        <EsqueletoLista texto="Carregando…" itens={2} />
      ) : proxima ? (
        <Link to={`/sessao/${proxima.id}`} className="hero-aula">
          <span className={`hero-aula__estado ${proxima.meu_status === 'espera' ? 'hero-aula__estado--espera' : ''}`}>
            <Icone nome={proxima.meu_status === 'espera' ? 'fila' : 'check'} tamanho={14} />
            {proxima.meu_status === 'espera'
              ? `Na fila${proxima.minha_posicao ? ` · Nº${proxima.minha_posicao}` : ''}`
              : 'Confirmado'}
          </span>
          <span className="hero-aula__quando">{rotuloQuando(proxima, agora)}</span>
          <span className="hero-aula__nome">{proxima.turma_nome} · {formatarIntervalo(proxima.inicia_em, proxima.duracao_min)}</span>
          <span className="hero-aula__coach"><Coach /></span>
          <span className="barra-vagas barra-vagas--larga" aria-hidden="true">
            <span className="barra-vagas__preenchido" style={{ width: `${Math.min(100, Math.round((proxima.confirmados / proxima.vagas) * 100))}%` }} />
          </span>
          <span className="hero-aula__vagas">
            {proxima.confirmados}/{proxima.vagas} vagas
            {proxima.meu_status === 'confirmado' && (
              <> · cancelamento até {formatarHora(new Date(new Date(proxima.inicia_em).getTime() - limiteMin * 60_000))}</>
            )}
          </span>
        </Link>
      ) : (
        <div className="hero-aula hero-aula--vazio">
          <p className="hero-aula__nome">Você não tem aula reservada</p>
          <Link to="/agenda" className="botao botao--primario">Reservar uma aula</Link>
        </div>
      )}

      </Capa>

      {erro != null && (
        <Aviso tom="erro" role="alert" titulo="Não foi possível carregar suas aulas">
          {mensagemErro(erro)} <Botao variante="texto" onClick={() => void recarregar()}>Tentar de novo</Botao>
        </Aviso>
      )}
      {!ativo && (
        <Aviso tom="alerta" titulo="Conta desativada">
          Você pode ver a agenda e os treinos, mas não pode fazer check-in. Fale com o seu treinador para reativar.
        </Aviso>
      )}

      <section className="metricas" aria-label="Seus números">
        <div className="metrica">
          <p className="metrica__rotulo">Aulas no mês</p>
          <p className="metrica__numero">{painel?.compareceu_mes ?? '–'}</p>
          <p className="metrica__apoio">{painel ? `Constância ${constanciaDoMes(painel.compareceu_mes, painel.reservas_mes)}%` : ' '}</p>
        </div>
        <div className="metrica">
          <p className="metrica__rotulo">Semanas seguidas</p>
          <p className="metrica__numero">{painel?.semanas_seguidas ?? '–'}</p>
          <p className="metrica__apoio">sem faltas</p>
        </div>
        <div className="metrica">
          <p className="metrica__rotulo">Meta do trimestre</p>
          <p className="metrica__numero">{painel ? `${meta?.percentual}%` : '–'}</p>
          <p className={`metrica__apoio nivel nivel--${meta?.nivel ?? 'sem'}`}>{meta?.rotulo ?? ' '}</p>
        </div>
      </section>

      <section className="treino-hoje" aria-labelledby="titulo-treino-hoje">
        <h2 className="inicio__secao" id="titulo-treino-hoje">Treino de hoje</h2>
        {comTreino ? (
          <>
            <p className="treino__titulo">{comTreino.treino_titulo}</p>
            {blocos.map((b, i) => (
              <p key={i} className="treino-hoje__bloco">
                {b.titulo && <strong>{b.titulo}: </strong>}{b.texto}
              </p>
            ))}
            {hojeAulas[0] && <Link to={`/sessao/${comTreino.id}`} className="botao botao--contorno">Ver treino completo</Link>}
          </>
        ) : (
          <p className="inicio__apoio">Ainda não publicado. Os treinos da semana saem no sábado de manhã.</p>
        )}
      </section>

      <section className="dia-agenda" aria-labelledby="titulo-horarios-hoje">
        <div className="dia-agenda__cabeca">
          <h2 className="inicio__secao" id="titulo-horarios-hoje">Horários de hoje</h2>
          <Link to="/agenda" className="inicio__link">Ver agenda completa</Link>
        </div>
        {hojeAulas.length === 0 ? (
          <p className="inicio__apoio">Sem aulas hoje.</p>
        ) : (
          <ol className="lista-sessoes">
            {hojeAulas.map((s) => (
              <li key={s.id}>
                <CartaoSessao sessao={s} agora={agora} ativo={ativo} limiteMin={limiteMin} onAtualizar={recarregar} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {aviso && (
        <section className="nota-coach" aria-labelledby="titulo-nota">
          <Avatar nome={estudio?.treinador_nome ?? 'Coach'} foto={estudio?.treinador_foto_url} />
          <div>
            <h2 className="nota-coach__titulo" id="titulo-nota">Recado do {estudio?.treinador_nome ? `coach ${estudio.treinador_nome.split(/\s+/)[0]}` : 'treinador'}</h2>
            <p className="nota-coach__texto">{aviso.texto}</p>
            <p className="nota-coach__data">{rotuloDiaLongo(chaveDiaSP(aviso.criado_em))}</p>
          </div>
        </section>
      )}
    </div>
  )
}
