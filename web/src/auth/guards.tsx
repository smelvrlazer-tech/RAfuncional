import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Aviso, Botao, Carregando } from '../components/Basicos'
import { mensagemErro } from '../lib/erros'
import { Convite } from '../features/acesso/Convite'
import { TrocarSenhaObrigatoria } from '../features/perfil/TrocarSenha'
import { NotificacoesProvider } from '../features/notificacoes/NotificacoesContext'
import { useAuth } from './AuthContext'

function ErroPerfil() {
  const { erroPerfil, recarregarPerfil, sair } = useAuth()
  return (
    <main className="tela tela--centro">
      <Aviso tom="erro" role="alert" titulo="Não foi possível carregar sua conta">
        {mensagemErro(erroPerfil)}
      </Aviso>
      <div className="linha-botoes">
        <Botao variante="primario" onClick={() => void recarregarPerfil()}>Tentar de novo</Botao>
        <Botao variante="texto" onClick={() => void sair()}>Sair</Botao>
      </div>
    </main>
  )
}

/**
 * Área do aluno:
 *  - sem login -> /entrar
 *  - login sem perfil (não aceitou convite) -> tela "peça um convite / informe o código"
 *  - treinador -> /treinador
 *  - aluno desativado entra, mas as telas ficam somente leitura (perfil.ativo = false)
 */
export function ExigeAluno() {
  const { carregando, sessao, perfil, erroPerfil } = useAuth()
  const local = useLocation()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />
  if (erroPerfil) return <ErroPerfil />
  if (!perfil) return <Convite semPerfil />
  if (perfil.papel === 'treinador') return <Navigate to="/treinador" replace />
  if (perfil.trocar_senha) return <TrocarSenhaObrigatoria />
  return (
    <NotificacoesProvider>
      <Outlet />
    </NotificacoesProvider>
  )
}

/** Área do treinador: só `perfis.papel = 'treinador'`; aluno volta para a agenda. */
export function ExigeTreinador({ children }: { children: ReactNode }) {
  const { carregando, sessao, perfil, erroPerfil } = useAuth()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  if (erroPerfil) return <ErroPerfil />
  if (!perfil) return <Convite semPerfil />
  if (perfil.papel !== 'treinador') return <Navigate to="/" replace />
  return <>{children}</>
}

/** /entrar: quem já está logado vai para onde tentava ir (ou para a agenda). */
export function SomenteDeslogado({ children }: { children: ReactNode }) {
  const { carregando, sessao, perfil } = useAuth()
  const local = useLocation()
  if (carregando) return <Carregando />
  if (sessao) {
    const de = (local.state as { de?: string } | null)?.de
    const destino = perfil?.papel === 'treinador' ? '/treinador' : de && de !== '/entrar' ? de : '/'
    return <Navigate to={destino} replace />
  }
  return <>{children}</>
}
