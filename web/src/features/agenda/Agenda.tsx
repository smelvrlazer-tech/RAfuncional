import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Avatar, Botao, EsqueletoLista } from '../../components/Basicos'
import { Sino } from '../../components/Sino'
import { chaveDiaSP, rotuloDiaLongo, semanaSeguinte } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { CartaoSessao } from './CartaoSessao'
import { SeletorDias } from './SeletorDias'
import { useAgenda, useLimiteBloqueio } from './useAgenda'

const CHAVE_BANNER = 'ra.bannerSemanaFechado'

function lerFechado(): string | null {
  try { return localStorage.getItem(CHAVE_BANNER) } catch { return null }
}

export function Agenda() {
  const { perfil } = useAuth()
  const { agora, hoje, dias, linhas, porDia, erro, carregando, recarregar } = useAgenda()
  const limiteMin = useLimiteBloqueio()
  const [params, setParams] = useSearchParams()
  const [bannerFechado, setBannerFechado] = useState(lerFechado)

  const comAula = useMemo(() => new Set(porDia.keys()), [porDia])
  const marcados = useMemo(() => {
    const s = new Set<string>()
    for (const [dia, lista] of porDia) if (lista.some((l) => l.meu_status && !l.cancelada)) s.add(dia)
    return s
  }, [porDia])

  // Dia escolhido fica na URL (?dia=) para sobreviver à ida e volta do detalhe.
  // Sem escolha: o primeiro dia (a partir de hoje) que tem aula.
  const pedido = params.get('dia')
  const valido = pedido && dias.some((d) => d.chave === pedido) ? pedido : null
  const primeiroComAula = dias.find((d) => comAula.has(d.chave))?.chave
  const selecionado = valido ?? primeiroComAula ?? hoje
  const doDia = porDia.get(selecionado) ?? []

  const semana = semanaSeguinte(hoje)
  const spoiler = (linhas ?? []).some((l) => {
    const d = chaveDiaSP(l.inicia_em)
    return l.treino_titulo && d >= semana.inicio && d <= semana.fim
  })
  const mostrarBanner = spoiler && bannerFechado !== semana.inicio

  function fecharBanner() {
    try { localStorage.setItem(CHAVE_BANNER, semana.inicio) } catch { /* ok */ }
    setBannerFechado(semana.inicio)
  }

  const nome = perfil?.nome ?? ''
  const primeiroNome = nome.split(/\s+/)[0] ?? ''
  const ativo = perfil?.ativo ?? true
  const proximoDia = dias.find((d) => d.chave > selecionado && comAula.has(d.chave))

  return (
    <div className="tela tela--agenda">
      <header className="cabecalho">
        <div className="cabecalho__texto">
          <p className="cabecalho__sobre">RA Funcional</p>
          <h1 className="cabecalho__titulo">Sua semana</h1>
          <p className="cabecalho__subtitulo">
            {primeiroNome ? `Olá, ${primeiroNome}. ` : ''}Garanta seu lugar nas próximas aulas.
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Sino />
          <Link to="/perfil" className="cabecalho__perfil" aria-label={`Seu perfil (${nome})`}>
            <Avatar nome={nome} />
          </Link>
        </div>
      </header>

      {!ativo && (
        <Aviso tom="alerta" titulo="Conta desativada">
          Você pode ver a agenda e os treinos, mas não pode fazer check-in. Fale com o seu treinador para reativar.
        </Aviso>
      )}

      {mostrarBanner && (
        <div className="banner-semana">
          <Aviso titulo="Os treinos da próxima semana já estão no ar">
            Dá uma espiada e garanta sua vaga antes que lote.
          </Aviso>
          <button type="button" className="banner-semana__fechar" onClick={fecharBanner}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Fechar aviso</span>
          </button>
        </div>
      )}

      <SeletorDias
        dias={dias}
        selecionado={selecionado}
        onSelecionar={(d) => setParams({ dia: d }, { replace: true })}
        marcados={marcados}
        comAula={comAula}
      />

      <section className="dia-agenda" aria-labelledby="rotulo-dia" aria-busy={carregando}>
        <div className="dia-agenda__cabeca">
          <h2 id="rotulo-dia" className="dia-agenda__titulo">{rotuloDiaLongo(selecionado)}</h2>
          {doDia.length > 0 && (
            <span className="dia-agenda__contagem">{doDia.length} {doDia.length === 1 ? 'aula' : 'aulas'}</span>
          )}
        </div>

        {erro != null && (
          <Aviso tom="erro" role="alert" titulo="Não foi possível carregar a agenda">
            {mensagemErro(erro)}{' '}
            <Botao variante="texto" onClick={() => void recarregar()}>Tentar de novo</Botao>
          </Aviso>
        )}

        {linhas === null && !erro ? (
          <EsqueletoLista texto="Carregando a agenda…" />
        ) : doDia.length === 0 && !erro ? (
          <div className="vazio">
            <p className="vazio__titulo">Sem aulas neste dia</p>
            {proximoDia ? (
              <Botao variante="contorno" onClick={() => setParams({ dia: proximoDia.chave }, { replace: true })}>
                Ver {rotuloDiaLongo(proximoDia.chave).split(',')[0]!.toLowerCase()}, {proximoDia.numero}
              </Botao>
            ) : (
              <p className="vazio__texto">Nenhuma aula nos próximos dias. Fique de olho nas notificações.</p>
            )}
          </div>
        ) : (
          <ol className="lista-sessoes">
            {doDia.map((s, i) => (
              <li key={s.id}>
                <CartaoSessao
                  sessao={s}
                  agora={agora}
                  ativo={ativo}
                  limiteMin={limiteMin}
                  onAtualizar={recarregar}
                  indice={i}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
