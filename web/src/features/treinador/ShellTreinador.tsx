import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Botao } from '../../components/Basicos'
import { Icone, type NomeIcone } from '../../components/Icone'
import { SeloRA } from '../../components/SeloRA'

const ITENS: { para: string; rotulo: string; icone: NomeIcone; fim?: boolean }[] = [
  { para: '/treinador', rotulo: 'Painel', icone: 'grade', fim: true },
  { para: '/treinador/turmas', rotulo: 'Turmas', icone: 'calendario' },
  { para: '/treinador/treinos', rotulo: 'Treinos', icone: 'prancheta' },
  { para: '/treinador/alunos', rotulo: 'Alunos', icone: 'pessoas' },
]

/** Casca do painel do treinador: barra lateral no computador, barra superior no celular. */
export function ShellTreinador() {
  const { perfil, sair } = useAuth()
  const [saindo, setSaindo] = useState(false)
  const primeiroNome = perfil?.nome.split(/\s+/)[0] ?? ''

  return (
    <div className="painel">
      <header className="lateral">
        <div className="lateral__marca">
          <SeloRA tamanho="p" />
          <div>
            <p className="lateral__nome">RA Funcional</p>
            <p className="lateral__papel">Treinador{primeiroNome ? ` · ${primeiroNome}` : ''}</p>
          </div>
        </div>
        <nav className="lateral__nav" aria-label="Painel do treinador">
          <ul>
            {ITENS.map((i) => (
              <li key={i.para}>
                <NavLink to={i.para} end={i.fim} className="lateral__item">
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
