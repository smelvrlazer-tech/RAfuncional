import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icone } from './Icone'

type Modo = 'computador' | 'celular'

const CHAVE = 'ra.visao'
/** Abaixo disso a tela já é "de celular": o seletor não faz sentido. */
export const LARGURA_MINIMA_PX = 900

function lerModo(): Modo {
  try { return localStorage.getItem(CHAVE) === 'celular' ? 'celular' : 'computador' } catch { return 'computador' }
}
function gravarModo(modo: Modo) {
  try { localStorage.setItem(CHAVE, modo) } catch { /* sem armazenamento: vale só nesta visita */ }
}

/** Dentro do quadro de celular o app roda como página normal, sem o seletor. */
function dentroDeQuadro(): boolean {
  try { return window.self !== window.top } catch { return true }
}

function useTelaLarga(): boolean {
  const consulta = `(min-width: ${LARGURA_MINIMA_PX}px)`
  const [larga, setLarga] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(consulta)
    const atualizar = () => setLarga(m.matches)
    atualizar()
    m.addEventListener('change', atualizar)
    return () => m.removeEventListener('change', atualizar)
  }, [consulta])
  return larga
}

/**
 * Em telas largas, deixa ver o app "como no celular" ou "como no computador".
 * O modo celular carrega o próprio app dentro de um quadro de 390px (iframe da mesma origem),
 * então as regras responsivas reagem de verdade, como num aparelho, e o login é compartilhado.
 * Fica fora do AuthProvider: no modo celular só o app de dentro do quadro conversa com o servidor.
 */
export function VisaoDispositivo({ children }: { children: ReactNode }) {
  const larga = useTelaLarga()
  const [modo, setModo] = useState<Modo>(lerModo)
  const [origem, setOrigem] = useState(() => location.pathname + location.search)
  const quadro = useRef<HTMLIFrameElement>(null)

  if (dentroDeQuadro() || !larga) return <>{children}</>

  function irParaCelular() {
    setOrigem(location.pathname + location.search)
    gravarModo('celular')
    setModo('celular')
  }

  function irParaComputador() {
    // Leva junto a página em que a pessoa estava dentro do quadro.
    const local = quadro.current?.contentWindow?.location
    const destino = local ? local.pathname + local.search + local.hash : origem
    gravarModo('computador')
    window.location.assign(destino)
  }

  return (
    <>
      {modo === 'celular' ? (
        <div className="molde-celular">
          <div className="molde-celular__aparelho">
            <iframe ref={quadro} className="molde-celular__tela" title="Visualização em celular" src={origem} />
          </div>
        </div>
      ) : children}

      <div className="visao" role="group" aria-label="Ver o app como">
        <span className="visao__rotulo">Ver como</span>
        <button type="button" className="visao__opcao" aria-pressed={modo === 'celular'}
          onClick={modo === 'celular' ? undefined : irParaCelular}>
          <Icone nome="telefone" tamanho={16} /> Celular
        </button>
        <button type="button" className="visao__opcao" aria-pressed={modo === 'computador'}
          onClick={modo === 'computador' ? undefined : irParaComputador}>
          <Icone nome="monitor" tamanho={16} /> Computador
        </button>
      </div>
    </>
  )
}
