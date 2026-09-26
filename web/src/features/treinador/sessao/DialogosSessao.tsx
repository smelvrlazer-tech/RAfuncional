import { useEffect, useId, useState } from 'react'
import { Dialogo } from '../../../components/Dialogo'
import type { AlunoNaSessao, ListaSessao } from '../../../lib/checkins'
import { formatarPrazo } from '../../../lib/datetime'

export interface AlvoRemocao { aluno: AlunoNaSessao; confirmado: boolean }

/** O que acontece ao remover (espelha treinador_remover_aluno + promover_da_espera). */
export function consequenciaRemocao(alvo: AlvoRemocao, lista: ListaSessao, fechada: boolean, limiteMin: number): string {
  const { nome } = alvo.aluno
  const aviso = `${nome} recebe uma notificação avisando que a presença foi removida.`
  if (!alvo.confirmado) return `${nome} sai da lista de espera. ${aviso} Quem está atrás na fila mantém a ordem.`
  const proximo = lista.espera[0]
  if (fechada) {
    return `${nome} sai da aula. ${aviso} Como faltam menos de ${formatarPrazo(limiteMin)} para a aula, a fila está ` +
      'congelada: a vaga fica aberta e ninguém é promovido.'
  }
  if (proximo) {
    return `${nome} sai da aula. ${aviso} A vaga passa automaticamente para ${proximo.nome}, 1º da lista de ` +
      'espera, que também recebe uma notificação.'
  }
  return `${nome} sai da aula. ${aviso} A vaga fica livre para novos check-ins.`
}

interface RemoverProps {
  alvo: AlvoRemocao | null
  texto: string
  enviando: boolean
  erro: string | null
  onConfirmar: () => void
  onFechar: () => void
}

export function DialogoRemover({ alvo, texto, enviando, erro, onConfirmar, onFechar }: RemoverProps) {
  return (
    <Dialogo
      aberto={alvo !== null}
      titulo={alvo ? `Remover ${alvo.aluno.nome}?` : ''}
      rotuloConfirmar="Sim, remover"
      onConfirmar={onConfirmar}
      onFechar={onFechar}
      enviando={enviando}
      erro={erro}
      perigo
    >
      <p>{texto}</p>
    </Dialogo>
  )
}

interface CancelarProps {
  aberto: boolean
  lista: ListaSessao
  enviando: boolean
  erro: string | null
  onConfirmar: (observacao: string) => void
  onFechar: () => void
}

export function DialogoCancelar({ aberto, lista, enviando, erro, onConfirmar, onFechar }: CancelarProps) {
  const id = useId()
  const [obs, setObs] = useState('')
  useEffect(() => { if (aberto) setObs('') }, [aberto])
  const c = lista.confirmados.length
  const f = lista.espera.length
  const total = c + f
  const pessoas = total === 1 ? '1 pessoa será avisada' : `${total} pessoas serão avisadas`
  return (
    <Dialogo
      aberto={aberto}
      titulo="Cancelar esta aula?"
      rotuloConfirmar="Cancelar a aula"
      rotuloCancelar="Manter a aula"
      onConfirmar={() => onConfirmar(obs.trim())}
      onFechar={onFechar}
      enviando={enviando}
      erro={erro}
      confirmarDesabilitado={!obs.trim()}
      focoInicial="textarea"
      perigo
      extra={
        <div className="campo">
          <label className="campo__rotulo" htmlFor={`${id}-obs`}>Motivo (obrigatório)</label>
          <textarea
            id={`${id}-obs`}
            className="campo__entrada campo__entrada--texto"
            rows={3}
            maxLength={300}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            aria-describedby={`${id}-dica`}
            required
          />
          <p className="campo__dica" id={`${id}-dica`}>Vai no aviso dos alunos. Ex.: “Chuva forte, nos vemos amanhã.”</p>
        </div>
      }
    >
      <p>
        {total > 0
          ? `${pessoas} (${c} ${c === 1 ? 'confirmado' : 'confirmados'} e ${f} na fila), com o motivo abaixo.`
          : 'Ninguém está inscrito nesta aula: nenhuma notificação será enviada.'}{' '}
        A aula continua na agenda marcada como cancelada, e isso não pode ser desfeito pelo app.
      </p>
    </Dialogo>
  )
}
