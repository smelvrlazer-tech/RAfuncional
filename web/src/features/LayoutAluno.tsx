import { Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Sino } from '../components/Sino'
import { EspacoNavInferior, NavInferior } from '../components/NavInferior'

/**
 * Telas "de aba" do aluno (agenda, minhas aulas, notificações, perfil).
 * Celular: conteúdo + barra de abas fixa no rodapé. Computador (>= 900px): a mesma navegação
 * vira um menu lateral e o conteúdo ocupa o resto da largura.
 */
export function LayoutAluno() {
  return (
    <div className="app-aluno">
      <div className="app-aluno__topo sup-escura">
        <span className="app-aluno__marca" aria-hidden="true">
          <Logo altura={26} />
          <span className="app-aluno__topo-nome">RA Funcional</span>
        </span>
        <Sino />
      </div>
      <div className="app-aluno__conteudo">
        <Outlet />
      </div>
      <EspacoNavInferior />
      <NavInferior />
    </div>
  )
}
