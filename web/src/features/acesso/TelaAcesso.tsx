import type { ReactNode } from 'react'
import { SeloRA } from '../../components/SeloRA'

/**
 * Cartão central das telas de entrada (login, convite, sem perfil): topo verde-petróleo
 * com o selo e o lema, picote na divisa e o formulário no corpo claro.
 * `subtitulo` é a linha de contexto da tela (opcional), abaixo do lema.
 */
export function TelaAcesso({ subtitulo, faixa, children }: { subtitulo?: string; faixa?: ReactNode; children: ReactNode }) {
  return (
    <main className="acesso">
      <div className="acesso__cartao">
        <div className="acesso__topo">
          <SeloRA tamanho="g" />
          <h1 className="acesso__nome">RA Funcional</h1>
          <p className="acesso__lema">
            Seu lugar na turma, <span className="acesso__destaque">reservado.</span>
          </p>
          {subtitulo && <p className="acesso__subtitulo">{subtitulo}</p>}
        </div>
        <div className="acesso__corpo">
          {faixa && <div className="acesso__faixa">{faixa}</div>}
          {children}
        </div>
      </div>
    </main>
  )
}
