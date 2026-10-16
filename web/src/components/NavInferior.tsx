import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { Icone, type NomeIcone } from './Icone'

const ITENS: { para: string; rotulo: string; icone: NomeIcone; fim?: boolean }[] = [
  { para: '/', rotulo: 'Início', icone: 'grade', fim: true },
  { para: '/agenda', rotulo: 'Agenda', icone: 'calendario' },
  { para: '/minhas-aulas', rotulo: 'Aulas', icone: 'prancheta' },
  { para: '/notificacoes', rotulo: 'Avisos', icone: 'sino' },
  { para: '/perfil', rotulo: 'Perfil', icone: 'pessoa' },
]

/** Barra de abas do app do aluno (fixa no rodapé da coluna). */
export function NavInferior() {
  return (
    <nav className="nav-inferior" aria-label="Navegação principal">
      {/* Só aparece no menu lateral do computador. */}
      <div className="nav-inferior__marca" aria-hidden="true"><Logo altura={34} /></div>
      <ul>
        {ITENS.map((item) => (
          <li key={item.para}>
            <NavLink to={item.para} end={item.fim} className="nav-inferior__item">
              <Icone nome={item.icone} tamanho={22} />
              <span>{item.rotulo}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Espaço no fim da página para o conteúdo não ficar escondido atrás da barra fixa. */
export function EspacoNavInferior() {
  return <div className="nav-inferior__espaco" aria-hidden="true" />
}
