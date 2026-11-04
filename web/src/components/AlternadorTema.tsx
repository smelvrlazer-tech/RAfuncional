import { definirTema, useTema, type Tema } from '../lib/tema'

const OPCOES: [Tema, string][] = [['lima', 'Lima'], ['ciano', 'Ciano']]

/** Só em desenvolvimento: o Rafael compara as duas identidades visuais lado a lado. */
export function AlternadorTema() {
  const atual = useTema()
  // Dentro do quadro "Ver como celular" a escolha é feita na janela de fora.
  if (window.self !== window.top) return null
  return (
    <div className="alternador-tema" role="group" aria-label="Identidade visual">
      <span className="alternador-tema__rotulo">Identidade</span>
      {OPCOES.map(([valor, rotulo]) => (
        <button key={valor} type="button" className="alternador-tema__opcao" aria-pressed={atual === valor}
          onClick={() => definirTema(valor)}>
          {rotulo}
        </button>
      ))}
    </div>
  )
}
