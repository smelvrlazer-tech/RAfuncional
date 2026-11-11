import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Avatar, Botao } from '../../components/Basicos'
import { Capa } from '../../components/Capa'
import { Coach } from '../../components/Coach'
import { Icone } from '../../components/Icone'
import { chaveDiaSP, formatarHora, formatarIntervalo, rotuloDiaLongo } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { constanciaDoMes, resumoDaMeta } from '../../lib/inicio'
import { proximaAulaMinha, rotuloQuando } from '../../lib/proximaAula'
import type { LinhaAgenda } from '../../lib/tipos'
import { useEstudio, useMeuPainel, useUltimoAviso } from '../../lib/useInicio'
import { CartaoSessao } from '../agenda/CartaoSessao'
import { useAgenda, useLimiteBloqueio } from '../agenda/useAgenda'
import { PlanoSemana } from '../minhas-aulas/PlanoSemana'

const termina = (s: LinhaAgenda) => new Date(s.inicia_em).getTime() + s.duracao_min * 60_000

/**
 * Tela inicial do aluno, em ordem de importância: (1) a próxima aula, (2) como você está no mês,
 * (3) o que dá para fazer hoje, (4) o recado do professor. Treino completo fica no detalhe da aula;
 * agenda completa fica na aba Agenda.
 */
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
  const proximasHoje = hojeAulas.filter((s) => termina(s) > agora.getTime())
  const encerradasHoje = hojeAulas.filter((s) => termina(s) <= agora.getTime())
  const comTreino = hojeAulas.find((s) => s.treino_titulo)
  const meta = painel ? resumoDaMeta(painel.compareceu_trimestre, painel.meta_trimestre) : null

  return (
    <div className="tela tela--inicio">
      <Capa foto="inicio" className="inicio__capa">
        <header className="inicio__topo">
          <div className="inicio__texto">
            <h1 className="inicio__titulo">Olá, {primeiroNome || 'bem-vindo'}</h1>
            <p className="inicio__data">{rotuloDiaLongo(hoje)}</p>
          </div>
          <Link to="/perfil" className="inicio__avatar">
            <Avatar nome={perfil?.nome ?? ''} foto={perfil?.foto_url} />
            <span className="sr-only">Meu perfil</span>
          </Link>
        </header>

        {linhas === null && !erro ? (
          <div className="hero-aula hero-aula--carregando" aria-hidden="true" />
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

      <section className="cartao seu-mes" aria-labelledby="titulo-seu-mes">
        <h2 className="cartao__titulo" id="titulo-seu-mes">Seu mês</h2>
        <div className="seu-mes__grade">
          <div>
            <p className="metrica__numero">{painel?.compareceu_mes ?? '–'}</p>
            <p className="metrica__rotulo">Aulas no mês</p>
            <p className="metrica__apoio">{painel ? `Constância ${constanciaDoMes(painel.compareceu_mes, painel.reservas_mes)}%` : ' '}</p>
          </div>
          <div>
            <p className="metrica__numero">{painel?.semanas_seguidas ?? '–'}</p>
            <p className="metrica__rotulo">Semanas seguidas</p>
            <p className="metrica__apoio">sem faltas</p>
          </div>
          <div>
            <p className="metrica__numero">{painel ? `${meta?.percentual}%` : '–'}</p>
            <p className="metrica__rotulo">Meta do trimestre</p>
            <p className={`metrica__apoio nivel nivel--${meta?.nivel ?? 'sem'}`}>{meta?.rotulo ?? ' '}</p>
          </div>
        </div>
        <PlanoSemana versao={linhas?.length ?? 0} />
      </section>

      <section className="dia-agenda" aria-labelledby="titulo-horarios-hoje">
        <div className="dia-agenda__cabeca">
          <h2 className="inicio__secao" id="titulo-horarios-hoje">Hoje</h2>
          <Link to="/agenda" className="inicio__link">Ver agenda completa</Link>
        </div>

        {comTreino ? (
          <Link to={`/sessao/${comTreino.id}`} className="linha-link">
            <span className="linha-link__texto">
              <span className="linha-link__rotulo">Treino de hoje</span>
              <span className="linha-link__titulo">{comTreino.treino_titulo}</span>
            </span>
            <Icone nome="seta" tamanho={20} />
          </Link>
        ) : (
          <p className="inicio__apoio">Treino de hoje ainda não publicado. Os treinos da semana saem no sábado de manhã.</p>
        )}

        {proximasHoje.length === 0 ? (
          <p className="inicio__apoio">{encerradasHoje.length > 0 ? 'Não há mais aulas hoje.' : 'Sem aulas hoje.'}</p>
        ) : (
          <ol className="lista-sessoes">
            {proximasHoje.map((s) => (
              <li key={s.id}>
                <CartaoSessao sessao={s} agora={agora} ativo={ativo} limiteMin={limiteMin} onAtualizar={recarregar} />
              </li>
            ))}
          </ol>
        )}

        {encerradasHoje.length > 0 && (
          <details className="encerradas">
            <summary>Aulas já encerradas hoje ({encerradasHoje.length})</summary>
            <ol className="lista-sessoes">
              {encerradasHoje.map((s) => (
                <li key={s.id}>
                  <CartaoSessao sessao={s} agora={agora} ativo={ativo} limiteMin={limiteMin} onAtualizar={recarregar} />
                </li>
              ))}
            </ol>
          </details>
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
