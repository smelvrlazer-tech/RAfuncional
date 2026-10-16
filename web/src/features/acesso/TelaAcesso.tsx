import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'

/**
 * Base das telas de entrada (login, convite, confirmação de e-mail).
 * Celular: faixa preta com a marca no topo e o formulário embaixo.
 * A partir de 900px: marca à esquerda ocupando a altura toda, formulário à direita.
 * O painel da marca recebe a foto do Rafael quando chegar (ver .acesso__marca no CSS).
 */
export function TelaAcesso({ titulo, subtitulo, faixa, children }: {
  titulo: string
  subtitulo?: ReactNode
  faixa?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="acesso">
      <div className="acesso__marca">
        <h2 className="sr-only">RA Funcional</h2>
        <Logo variante="horizontal" altura={72} />
        <p className="acesso__lema">Seu lugar na turma, reservado.</p>
      </div>
      <div className="acesso__corpo">
        <div className="acesso__conteudo">
          <header className="acesso__cabeca">
            <h1 className="acesso__titulo">{titulo}</h1>
            {subtitulo && <p className="acesso__subtitulo">{subtitulo}</p>}
          </header>
          {faixa}
          {children}
        </div>
      </div>
    </main>
  )
}
