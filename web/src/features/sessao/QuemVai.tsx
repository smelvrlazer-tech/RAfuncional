import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Avatar } from '../../components/Basicos'
import { buscarQuemVai, type ColegaConfirmado } from '../../lib/inicio'

/** Colegas confirmados na aula (foto e primeiro nome). Falha ou lista vazia: a seção some. */
export function QuemVai({ sessaoId, versao }: { sessaoId: string; versao: number }) {
  const { perfil } = useAuth()
  const [lista, setLista] = useState<ColegaConfirmado[] | null>(null)

  useEffect(() => {
    let vivo = true
    buscarQuemVai(sessaoId).then((l) => { if (vivo) setLista(l) }).catch(() => { if (vivo) setLista(null) })
    return () => { vivo = false }
  }, [sessaoId, versao])

  if (!lista || lista.length === 0) return null
  return (
    <section className="quem-vai" aria-labelledby={`quem-vai-${sessaoId}`}>
      <h3 className="treino__sobre" id={`quem-vai-${sessaoId}`}>Quem vai nessa aula ({lista.length})</h3>
      <ul className="quem-vai__lista">
        {lista.map((c) => (
          <li key={c.aluno_id} className="quem-vai__item">
            <Avatar nome={c.nome} foto={c.foto_url} className="avatar--mini" />
            <span>{c.nome.split(/\s+/)[0]}{c.aluno_id === perfil?.id ? ' (você)' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
