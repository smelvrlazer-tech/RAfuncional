import type { ReactNode } from 'react'
import { Perfuracao } from '../../components/Basicos'
import { SeloRA } from '../../components/SeloRA'

/** Cartão central das telas de entrada (login, convite, sem perfil). */
export function TelaAcesso({ subtitulo, faixa, children }: { subtitulo: string; faixa?: ReactNode; children: ReactNode }) {
  return (
    <main className="acesso">
      <div className="acesso__cartao">
        <div className="acesso__marca">
          <SeloRA tamanho="g" />
          <h1 className="acesso__nome">RA Funcional</h1>
          <p className="acesso__subtitulo">{subtitulo}</p>
        </div>
        <Perfuracao />
        {faixa && <div className="acesso__faixa">{faixa}</div>}
        {children}
      </div>
    </main>
  )
}
