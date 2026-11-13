import { useEffect, useState } from 'react'
import { BarrasSemanais } from '../../components/BarrasSemanais'
import { buscarMeuPlano, buscarMinhasSemanas, type SemanaDoAluno } from './api'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** "Suas últimas 8 semanas": aulas com presença por semana, com o plano como linha de referência. Some se não houver dados. */
export function EvolucaoSemanal({ versao = 0 }: { versao?: number }) {
  const [semanas, setSemanas] = useState<SemanaDoAluno[] | null>(null)
  const [plano, setPlano] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    buscarMinhasSemanas(8).then((s) => { if (vivo) setSemanas(s) }).catch(() => { if (vivo) setSemanas([]) })
    buscarMeuPlano().then((p) => { if (vivo) setPlano(p.aulas_semana) }).catch(() => {})
    return () => { vivo = false }
  }, [versao])

  if (!semanas || semanas.every((s) => s.reservas === 0)) return null
  const maximo = Math.max(plano ?? 0, ...semanas.map((s) => s.compareceu), 1)
  const total = semanas.reduce((n, s) => n + s.compareceu, 0)
  return (
    <section className="evolucao" aria-labelledby="titulo-evolucao">
      <h3 className="evolucao__titulo" id="titulo-evolucao">Suas últimas {semanas.length} semanas</h3>
      <BarrasSemanais
        legenda="Aulas com presença por semana"
        maximo={maximo}
        marco={plano}
        rotuloMarco={plano ? `Seu plano: ${plano} por semana` : undefined}
        barras={semanas.map((s, i) => ({
          rotulo: dm(s.semana_inicio),
          valor: s.compareceu,
          atual: i === semanas.length - 1,
          texto: `Semana de ${dm(s.semana_inicio)}: ${s.compareceu} ${s.compareceu === 1 ? 'aula' : 'aulas'} com presença de ${s.reservas} ${s.reservas === 1 ? 'reservada' : 'reservadas'}${i === semanas.length - 1 ? ' (semana atual)' : ''}`,
        }))}
      />
      <p className="desempenho__apoio">{total} {total === 1 ? 'aula' : 'aulas'} com presença nessas semanas.</p>
    </section>
  )
}
