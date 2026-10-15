import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Botao, EsqueletoLista } from '../../components/Basicos'
import { Icone } from '../../components/Icone'
import { Sino } from '../../components/Sino'
import { chaveDiaSP, rotuloDiaLongo, semanaSeguinte } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { proximaAulaMinha, rotuloQuando } from '../../lib/proximaAula'
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
  const proxima = useMemo(() => proximaAulaMinha(linhas ?? [], agora), [linhas, agora])

  return (
    <div className="tela tela--agenda">
      {/* Uma linha: quem é e qual dia está aberto. O dia escolhido é o título da tela. */}
      <header className="topo-agenda">
        <div className="topo-agenda__texto">
          <p className="topo-agenda__ola">{primeiroNome ? `Olá, ${primeiroNome}` : 'RA Funcional'}</p>
          <h1 className="topo-agenda__titulo" id="rotulo-dia">{rotuloDiaLongo(selecionado)}</h1>
        </div>
        <Sino />
      </header>

      {proxima && (
        <Link to={`/sessao/${proxima.id}`} className={`proxima ${proxima.meu_status === 'espera' ? 'proxima--espera' : ''}`}>
          <span className="proxima__rotulo">
            {proxima.meu_status === 'espera'
              ? `Você está na fila${proxima.minha_posicao ? ` · Nº${proxima.minha_posicao}` : ''}`
              : 'Sua próxima aula'}
          </span>
          <span className="proxima__quando">{rotuloQuando(proxima, agora)}</span>
          <span className="proxima__nome">{proxima.turma_nome}</span>
          <Icone nome="seta" tamanho={20} />
        </Link>
      )}

      {!ativo && (
        <Aviso tom="alerta" titulo="Conta desativada">
          Você pode ver a agenda e os treinos, mas não pode fazer check-in. Fale com o seu treinador para reativar.
        </Aviso>
      )}

      {mostrarBanner && (
        <div className="banner-semana">
          <Aviso titulo="Os treinos da próxima semana já estão no ar" />
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
            {doDia.map((s) => (
              <li key={s.id}>
                <CartaoSessao
                  sessao={s}
                  agora={agora}
                  ativo={ativo}
                  limiteMin={limiteMin}
                  onAtualizar={recarregar}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
