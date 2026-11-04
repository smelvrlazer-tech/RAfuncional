/**
 * Barra de rolagem discreta: invisível em repouso; aparece fina e translúcida quando o mouse chega
 * perto da borda (direita ou de baixo) e por um instante enquanto a página rola. A cor vem de
 * `html.barra-visivel` no CSS (base.css); nas áreas que rolam por dentro, o próprio :hover cuida disso.
 */
const PERTO_PX = 24
const DURACAO_ROLAGEM_MS = 900

export function ativarBarraDiscreta(): () => void {
  const raiz = document.documentElement
  let timer: number | undefined

  const aoMover = (e: MouseEvent) => {
    const perto = e.clientX >= window.innerWidth - PERTO_PX || e.clientY >= window.innerHeight - PERTO_PX
    raiz.classList.toggle('barra-visivel', perto)
  }
  const aoRolar = () => {
    raiz.classList.add('barra-visivel')
    window.clearTimeout(timer)
    timer = window.setTimeout(() => raiz.classList.remove('barra-visivel'), DURACAO_ROLAGEM_MS)
  }
  const aoSair = () => raiz.classList.remove('barra-visivel')

  window.addEventListener('mousemove', aoMover, { passive: true })
  window.addEventListener('scroll', aoRolar, { passive: true })
  document.addEventListener('mouseleave', aoSair)
  return () => {
    window.removeEventListener('mousemove', aoMover)
    window.removeEventListener('scroll', aoRolar)
    document.removeEventListener('mouseleave', aoSair)
    window.clearTimeout(timer)
  }
}
