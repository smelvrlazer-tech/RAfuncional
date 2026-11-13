import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarrasSemanais } from '../../../components/BarrasSemanais'
import { buscarAlunosAtencao, buscarEstudioSemanal, type AlunoEmAtencao, type SemanaEstudio } from './api'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

const MOTIVO: Record<AlunoEmAtencao['motivo'], (a: AlunoEmAtencao) => string> = {
  faltas: (a) => `${a.faltas_30d} faltas em 30 dias`,
  afastado: (a) => `Sem aula há ${a.dias_sem_aula} dias`,
  faltas_e_afastado: (a) => `${a.faltas_30d} faltas em 30 dias · sem aula há ${a.dias_sem_aula} dias`,
}

/** "Frequência do estúdio" (ocupação das últimas 8 semanas) e "Precisa de atenção". Cada bloco some se a consulta falhar ou vier vazia. */
export function FrequenciaEstudio() {
  const [semanas, setSemanas] = useState<SemanaEstudio[] | null>(null)
  const [atencao, setAtencao] = useState<AlunoEmAtencao[] | null>(null)

  useEffect(() => {
    let vivo = true
    buscarEstudioSemanal(8).then((s) => { if (vivo) setSemanas(s) }).catch(() => { if (vivo) setSemanas([]) })
    buscarAlunosAtencao().then((a) => { if (vivo) setAtencao(a) }).catch(() => { if (vivo) setAtencao([]) })
    return () => { vivo = false }
  }, [])

  const serie = semanas && semanas.some((s) => s.vagas > 0) ? semanas : null
  const lista = atencao && atencao.length > 0 ? atencao : null
  if (!serie && !lista) return null

  return (
    <div className="frequencia-estudio">
      {serie && (
        <section className="cartao" aria-labelledby="titulo-freq-estudio">
          <h2 className="cartao__titulo" id="titulo-freq-estudio">Frequência do estúdio</h2>
          <p className="desempenho__apoio">Ocupação das aulas encerradas, por semana (confirmados sobre vagas, em %).</p>
          <BarrasSemanais
            legenda="Ocupação por semana, em porcentagem"
            maximo={100}
            sufixo="%"
            barras={serie.map((s, i) => ({
              rotulo: dm(s.semana_inicio),
              valor: pct(s.confirmados, s.vagas),
              atual: i === serie.length - 1,
              texto: `Semana de ${dm(s.semana_inicio)}: ${pct(s.confirmados, s.vagas)}% de ocupação, ${s.confirmados} de ${s.vagas} vagas em ${s.aulas} aulas${i === serie.length - 1 ? ' (semana atual)' : ''}`,
            }))}
          />
        </section>
      )}
      {lista && (
        <section className="cartao" aria-labelledby="titulo-atencao">
          <h2 className="cartao__titulo" id="titulo-atencao">Precisa de atenção</h2>
          <ul className="atencao">
            {lista.map((a) => (
              <li key={a.aluno_id} className="atencao__item">
                <span className="atencao__nome">{a.nome}</span>
                <span className="atencao__motivo">{MOTIVO[a.motivo](a)}</span>
              </li>
            ))}
          </ul>
          <Link to="/treinador/alunos" className="inicio__link">Ver todos os alunos</Link>
        </section>
      )}
    </div>
  )
}
