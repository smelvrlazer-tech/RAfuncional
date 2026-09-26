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
  grande?: boolean
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

export function AcoesSessao({ sessao, estado, limiteMin, onAtualizar, grande = false }: Props) {
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
  const mostrarChip = tom !== 'disponivel' && tom !== 'lotada'
  const pedeConfirmacao = acao === 'cancelar'

  return (
    <div className={`acoes ${grande ? 'acoes--grande' : ''}`}>
      <div className="acoes__linha">
        {mostrarChip && <Chip tom={tom}>{estado.rotulo}</Chip>}
        {acao && !confirmando && (
          <Botao
            variante={acao === 'checkin' || acao === 'entrar_fila' ? (grande ? 'primario' : 'contorno') : 'texto'}
            className={acao === 'checkin' || acao === 'entrar_fila' ? 'acoes__principal' : 'acoes__secundaria'}
            carregando={enviando}
            onClick={() => (pedeConfirmacao ? setConfirmando(true) : void executar(acao))}
          >
            {enviando ? 'Enviando…' : estado.rotuloAcao}
          </Botao>
        )}
      </div>

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
