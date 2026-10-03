import { useEffect, useRef } from 'react'
import type { DiaSeletor } from '../../lib/datetime'
import { rotuloDiaLongo } from '../../lib/datetime'

interface Props {
  dias: DiaSeletor[]
  selecionado: string
  onSelecionar: (chave: string) => void
  /** Dias em que o aluno está confirmado ou na fila (o ponto fica verde). */
  marcados: Set<string>
  /** Dias com pelo menos uma aula (ponto coral; os demais ficam esmaecidos). */
  comAula: Set<string>
}

export function SeletorDias({ dias, selecionado, onSelecionar, marcados, comAula }: Props) {
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = lista.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selecionado])

  return (
    <nav className="seletor-dias" aria-label="Escolha o dia">
      <ul ref={lista} className="seletor-dias__lista">
        {dias.map((d) => {
          const ativo = d.chave === selecionado
          const partes = [d.hoje ? 'Hoje' : null, rotuloDiaLongo(d.chave),
            comAula.has(d.chave) ? null : 'sem aulas',
            marcados.has(d.chave) ? 'você tem aula marcada' : null].filter(Boolean)
          return (
            <li key={d.chave}>
              <button
                type="button"
                className={`dia ${ativo ? 'dia--ativo' : ''} ${d.hoje ? 'dia--hoje' : ''} ${comAula.has(d.chave) ? '' : 'dia--vazio'}`}
                aria-pressed={ativo}
                aria-label={partes.join(', ')}
                onClick={() => onSelecionar(d.chave)}
              >
                <span className="dia__semana">{d.semanaCurta}</span>
                <span className="dia__numero">{d.numero}</span>
                <span
                  className={`dia__ponto ${marcados.has(d.chave) ? 'dia__ponto--meu' : comAula.has(d.chave) ? 'dia__ponto--on' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
