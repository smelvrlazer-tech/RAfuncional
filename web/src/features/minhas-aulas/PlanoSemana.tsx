import { useEffect, useState } from 'react'
import { buscarMeuPlano, type MeuPlano } from './api'

/** Plano em aulas por semana e quanto já foi usado. Só informa: passar do limite não bloqueia a reserva. */
export function PlanoSemana({ versao }: { versao: number }) {
  const [plano, setPlano] = useState<MeuPlano | null>(null)

  useEffect(() => {
    let vivo = true
    buscarMeuPlano().then((p) => { if (vivo) setPlano(p) }).catch(() => { if (vivo) setPlano(null) })
    return () => { vivo = false }
  }, [versao])

  if (!plano?.aulas_semana) return null
  const { aulas_semana: limite, usadas_semana: usadas } = plano
  const passou = usadas > limite
  const pct = Math.min(100, Math.round((usadas / limite) * 100))

  return (
    <section className={`plano ${passou ? 'plano--passou' : ''}`} aria-labelledby="titulo-plano">
      <div className="plano__linha">
        <h2 className="plano__titulo" id="titulo-plano">Plano de {limite} {limite === 1 ? 'aula' : 'aulas'} por semana</h2>
        <p className="plano__uso"><strong>{usadas}</strong> de {limite} nesta semana</p>
      </div>
      <span className="barra-vagas barra-vagas--larga" role="img" aria-label={`${usadas} de ${limite} aulas usadas nesta semana`}>
        <span className="barra-vagas__preenchido" style={{ width: `${pct}%` }} />
      </span>
      {passou && <p className="plano__aviso">Você passou do seu plano desta semana. Sua reserva continua valendo; combine com o Rafael se precisar.</p>}
    </section>
  )
}
