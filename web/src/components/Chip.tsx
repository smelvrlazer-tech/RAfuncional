import type { Tom } from '../lib/estadoSessao'
import { Icone, type NomeIcone } from './Icone'

const ICONE: Partial<Record<Tom, NomeIcone>> = {
  confirmado: 'check',
  disponivel: 'check',
  espera: 'fila',
  bloqueada: 'cadeado',
  cancelada: 'x',
  lotada: 'lotada',
  encerrada: 'relogio',
}

/** Status sempre com ícone + texto (cor nunca é o único sinal). */
export function Chip({ tom, children, icone: forcado }: { tom: Tom; children: string; icone?: NomeIcone }) {
  const icone = forcado ?? ICONE[tom]
  return (
    <span className={`chip chip--${tom}`}>
      {icone && <Icone nome={icone} tamanho={15} />}
      <span>{children}</span>
    </span>
  )
}
