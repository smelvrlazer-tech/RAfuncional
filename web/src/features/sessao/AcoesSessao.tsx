import { useEffect, useRef, useState } from 'react'
import { Chip } from '../../components/Chip'
import { Botao } from '../../components/Basicos'
import { formatarHora } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import type { Acao, EstadoSessao } from '../../lib/estadoSessao'
import type { LinhaAgenda } from '../../lib/tipos'
import { executarAcao, type ResultadoAcao } from '../agenda/api'

interface Props {
  sessao: LinhaAgenda
  estado: EstadoSessao
  limiteMin: number
  /** Recarrega os dados do servidor (sempre chamado depois de uma RPC, com ou sem erro). */
  onAtualizar: () => Promise<unknown> | void
  /** Versão do detalhe: botão largo + texto de apoio com o prazo. */
  grande?: boolean
  /** Versão da lista: botão pequeno ("Reservar") e chip também para aula lotada. */
  compacto?: boolean
}

type Retorno = { tom: 'sucesso' | 'erro'; texto: string } | null

function textoSucesso(acao: Acao, r: ResultadoAcao, hora: string): string {
  if (acao === 'cancelar') return 'Presença cancelada.'
  if (acao === 'sair_fila') return 'Você saiu da fila de espera.'
  if (r.status === 'espera') {
    return `A aula lotou: você entrou na fila de espera${r.posicao_fila ? ` (Nº${r.posicao_fila})` : ''}.`
  }
  return `Check-in confirmado! Te esperamos às ${hora}.`
}

/** Texto de apoio sob o botão principal, derivado do início da aula e do prazo de bloqueio. */
function textoApoio(sessao: LinhaAgenda, acao: Acao | null, limiteMin: number): string | null {
  if (acao !== 'checkin' && acao !== 'cancelar') return null
  const limite = formatarHora(new Date(new Date(sessao.inicia_em).getTime() - limiteMin * 60_000))
  return acao === 'cancelar' ? `Pode cancelar até ${limite}` : `Check-in aberto até ${limite}`
}

/** Rótulos curtos da lista (o detalhe e os testes usam os rótulos completos de estadoSessao). */
function rotuloChipCompacto(estado: EstadoSessao, sessao: LinhaAgenda): string {
  if (estado.tom === 'bloqueada') return 'Encerrado'
  if (estado.tom === 'espera') return sessao.minha_posicao ? `Na fila · Nº${sessao.minha_posicao}` : 'Na fila'
  return estado.rotulo
}

export function AcoesSessao({ sessao, estado, limiteMin, onAtualizar, grande = false, compacto = false }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [retorno, setRetorno] = useState<Retorno>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function executar(acao: Acao) {
    setEnviando(true)
    setRetorno(null)
    try {
      const r = await executarAcao(acao, sessao.id)
      setRetorno({ tom: 'sucesso', texto: textoSucesso(acao, r, formatarHora(sessao.inicia_em)) })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setRetorno(null), 8000)
    } catch (erro) {
      // Dado velho (ex.: o card dizia "disponível" mas bloqueou/lotou): mostra a
      // mensagem do servidor e recarrega para refletir o estado real.
      setRetorno({ tom: 'erro', texto: mensagemErro(erro, { limiteMin }) })
    } finally {
      setConfirmando(false)
      try {
        await onAtualizar()
      } finally {
        setEnviando(false)
      }
    }
  }

  const { acao, tom } = estado
  const mostrarChip = tom !== 'disponivel' && (tom !== 'lotada' || compacto)
  const pedeConfirmacao = acao === 'cancelar'
  const principal = acao === 'checkin' || acao === 'entrar_fila'
  const apoio = grande ? textoApoio(sessao, acao, limiteMin) : null
  const rotuloBotao = compacto && acao === 'checkin' ? 'Reservar'
    : compacto && acao === 'entrar_fila' ? 'Entrar na fila'
    : estado.rotuloAcao
  // Na lista o texto é curto; o nome acessível continua dizendo a ação completa e de qual aula.
  const nomeBotao = compacto && principal && !enviando
    ? `${rotuloBotao} (${estado.rotuloAcao?.toLowerCase()}) — ${sessao.turma_nome}, ${formatarHora(sessao.inicia_em)}`
    : undefined

  return (
    <div className={`acoes ${grande ? 'acoes--grande' : ''} ${compacto ? 'acoes--compacto' : ''}`}>
      <div className="acoes__linha">
        {mostrarChip && <Chip tom={tom}>{compacto ? rotuloChipCompacto(estado, sessao) : estado.rotulo}</Chip>}
        {acao && !confirmando && (
          <Botao
            variante={principal ? (grande || compacto ? 'primario' : 'contorno') : 'texto'}
            className={`${principal ? 'acoes__principal' : 'acoes__secundaria'} ${compacto && principal ? 'botao--compacto' : ''}`}
            carregando={enviando}
            aria-label={nomeBotao}
            onClick={() => (pedeConfirmacao ? setConfirmando(true) : void executar(acao))}
          >
            {enviando ? 'Enviando…' : rotuloBotao}
          </Botao>
        )}
      </div>
      {apoio && !confirmando && <p className="acoes__apoio">{apoio}</p>}

      {confirmando && (
        <div className="acoes__confirmar" role="group" aria-label="Confirmar cancelamento">
          <p>Cancelar sua presença? A vaga vai para o próximo da fila.</p>
          <div className="acoes__confirmar-botoes">
            <Botao variante="escuro" carregando={enviando} onClick={() => void executar('cancelar')}>
              Sim, cancelar
            </Botao>
            <Botao variante="texto" disabled={enviando} onClick={() => setConfirmando(false)}>
              Manter presença
            </Botao>
          </div>
        </div>
      )}

      {estado.motivo && <p className={`acoes__motivo acoes__motivo--${tom}`}>{estado.motivo}</p>}

      <p className={`acoes__retorno ${retorno ? `acoes__retorno--${retorno.tom}` : ''}`} aria-live="polite" role="status">
        {retorno?.texto ?? ''}
      </p>
    </div>
  )
}
