import { useCallback, useEffect, useState } from 'react'
import { chaveDiaSP, inicioDoDiaSP } from '../../lib/datetime'
import { frequenciaDoMes, inicioDoMes, semanasDoMes } from '../../lib/frequencia'
import type { LinhaAgenda } from '../../lib/tipos'
import { useAoFocar } from '../../lib/useFoco'
import { buscarAgenda } from '../agenda/api'

const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

/** Aulas do mês corrente até agora. Falha de rede some com a seção (é informação extra). */
function useAulasDoMes(agora: Date): LinhaAgenda[] | null {
  const hoje = chaveDiaSP(agora)
  const [linhas, setLinhas] = useState<LinhaAgenda[] | null>(null)
  const carregar = useCallback(async () => {
    try {
      setLinhas(await buscarAgenda(inicioDoDiaSP(inicioDoMes(hoje)), new Date()))
    } catch {
      setLinhas(null)
    }
  }, [hoje])
  useEffect(() => { void carregar() }, [carregar])
  useAoFocar(() => void carregar())
  return linhas
}

/** "Frequência em outubro": total de aulas feitas e um calendário do mês com os dias marcados. */
export function Frequencia({ agora }: { agora: Date }) {
  const linhas = useAulasDoMes(agora)
  if (!linhas) return null

  const hoje = chaveDiaSP(agora)
  const f = frequenciaDoMes(linhas, agora)
  const dias = [...f.dias].sort().map((d) => Number(d.slice(8, 10)))
  const descricao = f.total === 0
    ? `Nenhuma aula feita em ${f.mes} até agora.`
    : `${f.total} ${f.total === 1 ? 'aula feita' : 'aulas feitas'} em ${f.mes}, ${dias.length === 1 ? 'no dia' : 'nos dias'} ${dias.join(', ')}.`

  return (
    <section className="frequencia" aria-labelledby="frequencia-titulo">
      <div className="frequencia__cabeca">
        <h2 id="frequencia-titulo" className="frequencia__titulo">Frequência em {f.mes}</h2>
        <p className="frequencia__total" aria-hidden="true">
          <strong>{f.total}</strong> {f.total === 1 ? 'aula' : 'aulas'}
        </p>
      </div>
      <p className="sr-only">{descricao}</p>
      <div className="calendario" aria-hidden="true">
        {SEMANA.map((s, i) => <span key={`s${i}`} className="calendario__semana">{s}</span>)}
        {semanasDoMes(hoje).flat().map((d, i) => (
          <span
            key={d ?? `v${i}`}
            className={[
              'calendario__dia',
              d === null ? 'calendario__dia--vazio' : '',
              d && f.dias.has(d) ? 'calendario__dia--feito' : '',
              d === hoje ? 'calendario__dia--hoje' : '',
              d && d > hoje ? 'calendario__dia--futuro' : '',
            ].filter(Boolean).join(' ')}
          >
            {d ? Number(d.slice(8, 10)) : ''}
          </span>
        ))}
      </div>
    </section>
  )
}
