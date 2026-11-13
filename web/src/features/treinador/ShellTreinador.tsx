import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Botao } from '../../components/Basicos'
import { Icone, type NomeIcone } from '../../components/Icone'
import { Logo } from '../../components/Logo'

const ITENS: { para: string; rotulo: string; icone: NomeIcone; fim?: boolean }[] = [
  { para: '/treinador', rotulo: 'Hoje', icone: 'grade', fim: true },
  { para: '/treinador/turmas', rotulo: 'Turmas', icone: 'calendario' },
  { para: '/treinador/treinos', rotulo: 'Treinos', icone: 'prancheta' },
  { para: '/treinador/alunos', rotulo: 'Alunos', icone: 'pessoas' },
  { para: '/treinador/perfil', rotulo: 'Perfil', icone: 'pessoa' },
]

/** Casca do painel do treinador: barra lateral no computador, barra superior no celular. */
export function ShellTreinador() {
  const { perfil, sair } = useAuth()
  const [saindo, setSaindo] = useState(false)
  const primeiroNome = perfil?.nome.split(/\s+/)[0] ?? ''
  const caminho = useLocation().pathname
  const sessaoAberta = caminho.startsWith('/treinador/sessao/')
  const chamadaAberta = caminho === '/treinador/chamada'

  return (
    <div className="painel">
      <header className="lateral sup-escura">
        <div className="lateral__marca">
          <Logo altura={28} />
          <div>
            <p className="lateral__nome">RA Funcional</p>
            <p className="lateral__papel">Treinador{primeiroNome ? ` · ${primeiroNome}` : ''}</p>
          </div>
        </div>
        <nav className="lateral__nav" aria-label="Painel do treinador">
          <ul>
            {ITENS.map((i) => (
              <li key={i.para}>
                <NavLink
                  to={i.para}
                  end={i.fim}
                  // Chamada (outros dias) e a visão da sessão fazem parte de "Hoje": mantém a aba marcada.
                  className={({ isActive }) =>
                    `lateral__item ${isActive || (i.para === '/treinador' && (sessaoAberta || chamadaAberta)) ? 'active' : ''}`}
                >
                  <Icone nome={i.icone} tamanho={20} />
                  <span>{i.rotulo}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Botao
          variante="texto"
          className="lateral__sair"
          carregando={saindo}
          onClick={() => { setSaindo(true); void sair() }}
        >
          <Icone nome="sair" /> Sair
        </Botao>
      </header>
      <main className="painel__conteudo">
        <Outlet />
      </main>
    </div>
  )
}
