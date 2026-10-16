import { useEstudio } from '../lib/useInicio'
import { Avatar } from './Basicos'

/** "Coach Rafael Alvarenga" com a foto do treinador (some enquanto o nome não chega). */
export function Coach({ comFoto = true }: { comFoto?: boolean }) {
  const estudio = useEstudio()
  if (!estudio?.treinador_nome) return null
  return (
    <span className="coach">
      {comFoto && <Avatar nome={estudio.treinador_nome} foto={estudio.treinador_foto_url} className="avatar--mini" />}
      <span>Coach {estudio.treinador_nome}</span>
    </span>
  )
}
