import { Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ExigeAluno, ExigeTreinador, SomenteDeslogado } from './auth/guards'
import { AvisoOffline } from './components/AvisoOffline'
import { Convite } from './features/acesso/Convite'
import { Entrar } from './features/acesso/Entrar'
import { Agenda } from './features/agenda/Agenda'
import { Notificacoes } from './features/notificacoes/Notificacoes'
import { Perfil } from './features/perfil/Perfil'
import { DetalheSessao } from './features/sessao/DetalheSessao'
import { PainelTreinador } from './features/treinador/PainelTreinador'
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
      <Route path="/treinador" element={<ExigeTreinador><PainelTreinador /></ExigeTreinador>} />
      <Route element={<ExigeAluno />}>
        <Route index element={<Agenda />} />
        <Route path="/sessao/:id" element={<DetalheSessao />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/perfil" element={<Perfil />} />
      </Route>
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
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
  return (
    <AuthProvider>
      <a href="#conteudo" className="pular">Pular para o conteúdo</a>
      <AvisoOffline />
      <div id="conteudo" className="coluna">
        <Rotas />
      </div>
    </AuthProvider>
  )
}
