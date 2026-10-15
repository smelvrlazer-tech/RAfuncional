import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ExigeAluno, ExigeTreinador, SomenteDeslogado } from './auth/guards'
import { AvisoOffline } from './components/AvisoOffline'
import { VisaoDispositivo } from './components/VisaoDispositivo'
import { Convite } from './features/acesso/Convite'
import { Entrar } from './features/acesso/Entrar'
import { Agenda } from './features/agenda/Agenda'
import { LayoutAluno } from './features/LayoutAluno'
import { MinhasAulas } from './features/minhas-aulas/MinhasAulas'
import { Notificacoes } from './features/notificacoes/Notificacoes'
import { Perfil } from './features/perfil/Perfil'
import { DetalheSessao } from './features/sessao/DetalheSessao'
import { Alunos } from './features/treinador/alunos/Alunos'
import { PainelDia } from './features/treinador/painel/PainelDia'
import { SessaoTreinador } from './features/treinador/sessao/SessaoTreinador'
import { ShellTreinador } from './features/treinador/ShellTreinador'
import { Treinos } from './features/treinador/treinos/Treinos'
import { Turmas } from './features/treinador/turmas/Turmas'
import { configuracaoAusente } from './lib/supabase'

function NaoEncontrada() {
  return (
    <main className="tela tela--centro">
      <div className="vazio">
        <p className="vazio__titulo">Página não encontrada</p>
        <Link to="/" className="botao botao--contorno">Ir para a agenda</Link>
      </div>
    </main>
  )
}

export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<SomenteDeslogado><Entrar /></SomenteDeslogado>} />
      <Route path="/convite" element={<Convite />} />
      <Route path="/convite/:codigo" element={<Convite />} />
      <Route path="/treinador" element={<ExigeTreinador><ShellTreinador /></ExigeTreinador>}>
        <Route index element={<PainelDia />} />
        <Route path="sessao/:id" element={<SessaoTreinador />} />
        <Route path="turmas" element={<Turmas />} />
        <Route path="treinos" element={<Treinos />} />
        <Route path="alunos" element={<Alunos />} />
        <Route path="*" element={<Navigate to="/treinador" replace />} />
      </Route>
      <Route element={<ExigeAluno />}>
        <Route element={<LayoutAluno />}>
          <Route index element={<Agenda />} />
          <Route path="/minhas-aulas" element={<MinhasAulas />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/perfil" element={<Perfil />} />
        </Route>
        {/* O detalhe tem a própria barra de ação fixa; sem a barra de abas. */}
        <Route path="/sessao/:id" element={<DetalheSessao />} />
      </Route>
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}

/** O painel do treinador usa a largura toda (desktop-first); o app do aluno, a coluna estreita. */
function Conteudo() {
  const { pathname } = useLocation()
  const treinador = pathname === '/treinador' || pathname.startsWith('/treinador/')
  return (
    <div id="conteudo" className={treinador ? 'coluna coluna--larga' : 'coluna'}>
      <Rotas />
    </div>
  )
}

export function App() {
  if (configuracaoAusente) {
    return (
      <main className="tela tela--centro">
        <p className="vazio__titulo">Configuração ausente</p>
        <p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em web/.env.local (veja web/.env.example).</p>
      </main>
    )
  }
  const app = (
    <AuthProvider>
      <a href="#conteudo" className="pular">Pular para o conteúdo</a>
      <AvisoOffline />
      <Conteudo />
    </AuthProvider>
  )
  // "Ver como celular/computador" é ferramenta de desenvolvimento: não vai para o app publicado.
  return import.meta.env.DEV ? <VisaoDispositivo>{app}</VisaoDispositivo> : app
}
