import { Outlet } from 'react-router-dom'
import { EspacoNavInferior, NavInferior } from '../components/NavInferior'

/** Telas "de aba" do aluno (agenda, minhas aulas, notificações, perfil): conteúdo + barra inferior. */
export function LayoutAluno() {
  return (
    <>
      <Outlet />
      <EspacoNavInferior />
      <NavInferior />
    </>
  )
}
