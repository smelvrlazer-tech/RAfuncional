import { chaveDiaSP } from './datetime'
import type { LinhaAgenda } from './tipos'

/** Endereço que abre uma aula no painel ao lado da agenda (layout de computador). */
export function enderecoNoPainel(s: Pick<LinhaAgenda, 'id' | 'inicia_em'>): string {
  return `/agenda?dia=${chaveDiaSP(s.inicia_em)}&aula=${s.id}`
}
