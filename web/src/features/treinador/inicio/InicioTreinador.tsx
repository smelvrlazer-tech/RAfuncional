import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { Aviso, Avatar, Botao } from '../../../components/Basicos'
import { FrequenciaEstudio } from './FrequenciaEstudio'
import { Capa } from '../../../components/Capa'
import { Chip } from '../../../components/Chip'
import { chaveDiaSP, formatarHora, rotuloDiaLongo } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import { estadoAula } from '../../../lib/estadoAula'
import { inicioSemana, diasDaSemana } from '../../../lib/semana'
import { enviarAviso } from '../../../lib/inicio'
import { useAgora, useLimiteBloqueio } from '../../agenda/useAgenda'
import { relatorioMensal } from '../alunos/api'
import { Anuncio, EstadoLista, type Retorno } from '../comum'
import { buscarAulasDoDia } from '../painel/api'
import { useCarga } from '../useCarga'
import { buscarSemana, buscarTreinoDoDia, contarPresencas } from './api'

async function carregar(hoje: string) {
  const aulas = await buscarAulasDoDia(hoje)
  const ativas = aulas.filter((a) => !a.cancelada)
  const [semana, presencas, treino, relatorio] = await Promise.all([
    buscarSemana(hoje),
    contarPresencas(ativas.map((a) => a.id)),
    buscarTreinoDoDia(hoje).catch(() => null),
    relatorioMensal(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))).catch(() => []),
  ])
  return { aulas, semana, presencas, treino, relatorio }
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

/** Tela inicial do treinador: números do dia, turmas, treino, ocupação da semana e aviso aos alunos. */
export function InicioTreinador() {
  const agora = useAgora()
  const limiteMin = useLimiteBloqueio()
  const { perfil } = useAuth()
  const hoje = chaveDiaSP(agora)
  const { dados, erro, carregando, recarregar } = useCarga(() => carregar(hoje), hoje)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [retorno, setRetorno] = useState<Retorno>(null)

  const aulas = dados?.aulas ?? []
  const ativas = aulas.filter((a) => !a.cancelada)
  const vagas = ativas.reduce((n, a) => n + a.vagas, 0)
  const confirmados = ativas.reduce((n, a) => n + a.confirmados, 0)
  const fila = ativas.reduce((n, a) => n + a.na_espera, 0)
  const maiorFila = [...ativas].sort((a, b) => b.na_espera - a.na_espera)[0]
  const rel = dados?.relatorio ?? []
  const reservasMes = rel.reduce((n, l) => n + l.reservas, 0)
  const compareceuMes = rel.reduce((n, l) => n + l.compareceu, 0)
  const semMarcacao = rel.reduce((n, l) => n + l.sem_marcacao, 0)

  const dias = useMemo(() => diasDaSemana(inicioSemana(hoje), hoje).filter((d) => d.semanaCurta !== 'DOM'), [hoje])
  const porDia = useMemo(() => {
    const mapa = new Map<string, { conf: number; vagas: number }>()
    for (const a of dados?.semana ?? []) {
      if (a.cancelada) continue
      const k = chaveDiaSP(a.inicia_em)
      const v = mapa.get(k) ?? { conf: 0, vagas: 0 }
      v.conf += a.confirmados
      v.vagas += a.vagas
      mapa.set(k, v)
    }
    return mapa
  }, [dados?.semana])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const texto = aviso.trim()
    if (!texto) return
    setEnviando(true)
    setRetorno(null)
    try {
      const n = await enviarAviso(texto)
      setRetorno({ tom: 'sucesso', texto: `Aviso enviado para ${n} ${n === 1 ? 'aluno' : 'alunos'}.` })
      setAviso('')
    } catch (err) {
      setRetorno({ tom: 'erro', texto: mensagemErro(err, { treinador: true }) })
    } finally {
      setEnviando(false)
    }
  }

  const primeiroNome = (perfil?.nome ?? '').split(/\s+/)[0] ?? ''

  return (
    <div className="tela-treinador tela-inicio-treinador">
      <Capa como="header" foto="agenda" className="controle inicio-treinador__capa">
        <div className="controle__texto inicio-treinador__ola">
          <Link to="/treinador/perfil" className="inicio__avatar">
            <Avatar nome={perfil?.nome ?? ''} foto={perfil?.foto_url} className="avatar--grande" />
            <span className="sr-only">Meu perfil e foto</span>
          </Link>
          <div>
            <p className="controle__sobre">Visão geral do estúdio</p>
            <h1 className="controle__titulo">Olá, {primeiroNome || 'treinador'}</h1>
            <p className="controle__subtitulo">{rotuloDiaLongo(hoje)}</p>
          </div>
        </div>
        <div className="controle__lado">
          <Link to="/treinador/chamada" className="botao botao--contorno">Outros dias</Link>
          <Link to="/treinador/turmas" className="botao botao--primario">Nova turma</Link>
        </div>
      </Capa>

      <EstadoLista carregando={carregando} erro={erro} vazio={false} textoCarregando="Carregando o estúdio…"
        tituloErro="Não foi possível carregar a visão geral" tituloVazio="" onTentar={() => void recarregar()}>
        <section className="metricas metricas--quatro" aria-label="Números de hoje">
          <div className="metrica">
            <p className="metrica__rotulo">Alunos esperados hoje</p>
            <p className="metrica__numero">{confirmados}<span> / {vagas} vagas</span></p>
            <p className="metrica__apoio">{pct(confirmados, vagas)}% de ocupação · {ativas.length} {ativas.length === 1 ? 'aula' : 'aulas'}</p>
          </div>
          <div className="metrica">
            <p className="metrica__rotulo">Presenças marcadas</p>
            <p className="metrica__numero">{dados?.presencas ?? 0}<span> / {confirmados} confirmados</span></p>
            <p className="metrica__apoio">{pct(dados?.presencas ?? 0, confirmados)}% validados</p>
          </div>
          <div className="metrica">
            <p className="metrica__rotulo">Fila de espera</p>
            <p className="metrica__numero">{fila}<span> {fila === 1 ? 'aluno aguardando' : 'alunos aguardando'}</span></p>
            <p className="metrica__apoio">{fila > 0 && maiorFila ? `${maiorFila.turma_nome} ${formatarHora(maiorFila.inicia_em)} tem a maior fila` : 'Nenhuma fila hoje'}</p>
          </div>
          <div className="metrica">
            <p className="metrica__rotulo">Frequência do mês</p>
            <p className="metrica__numero">{pct(compareceuMes, reservasMes)}<span>%</span></p>
            <p className="metrica__apoio">{semMarcacao > 0 ? `${semMarcacao} aulas sem presença marcada` : `${compareceuMes} de ${reservasMes} aulas`}</p>
          </div>
        </section>

        <div className="inicio-treinador__grade">
          <section className="cartao" aria-labelledby="titulo-turmas-hoje">
            <h2 className="cartao__titulo" id="titulo-turmas-hoje">Turmas de hoje</h2>
            {aulas.length === 0 ? (
              <p className="aula__nada">Nenhuma aula hoje.</p>
            ) : (
              <ul className="turmas-hoje">
                {aulas.map((a) => {
                  const estado = estadoAula(a, agora, limiteMin)
                  return (
                    <li key={a.id} className="turmas-hoje__item">
                      <span className="turmas-hoje__hora">{formatarHora(a.inicia_em)}</span>
                      <span className="turmas-hoje__texto">
                        <span className="turmas-hoje__nome">{a.turma_nome}</span>
                        <span className="turmas-hoje__meta">{a.confirmados}/{a.vagas} vagas{a.na_espera > 0 ? ` · ${a.na_espera} na fila` : ''}</span>
                      </span>
                      <Chip tom={estado.tom}>{estado.rotulo}</Chip>
                      <Link to={`/treinador/sessao/${a.id}`} className="botao botao--contorno botao--pequeno">
                        {estado.comecou ? 'Chamada' : 'Abrir'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="inicio-treinador__lado">
            <section className="cartao" aria-labelledby="titulo-treino-dia">
              <h2 className="cartao__titulo" id="titulo-treino-dia">Treino de hoje</h2>
              {dados?.treino ? (
                <>
                  <p className="treino__titulo">{dados.treino.titulo}</p>
                  {!dados.treino.publicado && <Aviso tom="alerta" titulo="Ainda é rascunho">Os alunos não veem este treino até você publicar.</Aviso>}
                </>
              ) : (
                <p className="aula__nada">Nenhum treino cadastrado para hoje.</p>
              )}
              <Link to="/treinador/treinos" className="botao botao--contorno">{dados?.treino ? 'Editar treino' : 'Cadastrar treino'}</Link>
            </section>

            <section className="cartao" aria-labelledby="titulo-aviso">
              <h2 className="cartao__titulo" id="titulo-aviso">Aviso aos alunos</h2>
              <form className="formulario" onSubmit={enviar}>
                <label className="sr-only" htmlFor="texto-aviso">Mensagem para os alunos</label>
                <textarea id="texto-aviso" className="campo__entrada" rows={3} maxLength={300} value={aviso}
                  placeholder="Ex.: Amanhã o treino é focado em potência. Cheguem 10 min antes!"
                  onChange={(e) => setAviso(e.target.value)} />
                <Botao type="submit" variante="primario" carregando={enviando} disabled={!aviso.trim()}>Enviar a todos os alunos</Botao>
              </form>
              <Anuncio retorno={retorno} />
            </section>
          </div>
        </div>

        <FrequenciaEstudio />

        <section className="cartao" aria-labelledby="titulo-semana">
          <h2 className="cartao__titulo" id="titulo-semana">Ocupação da semana</h2>
          <ul className="semana-barras">
            {dias.map((d) => {
              const v = porDia.get(d.chave)
              const p = v ? pct(v.conf, v.vagas) : 0
              return (
                <li key={d.chave} className={`semana-barras__dia ${d.hoje ? 'semana-barras__dia--hoje' : ''}`}>
                  <span className="semana-barras__valor">{v ? `${v.conf}/${v.vagas}` : '–'}</span>
                  <span className="semana-barras__coluna" role="img" aria-label={v ? `${v.conf} de ${v.vagas} vagas, ${p}%` : 'sem aulas'}>
                    <span className="semana-barras__preenchido" style={{ height: `${p}%` }} />
                  </span>
                  <span className="semana-barras__rotulo">{d.semanaCurta} {d.numero}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </EstadoLista>
    </div>
  )
}
