import { Link } from 'react-router-dom'
import { Icone } from './Icone'
import { useNaoLidas } from '../features/notificacoes/NotificacoesContext'

export function Sino() {
  const { naoLidas } = useNaoLidas()
  const rotulo = naoLidas === 0
    ? 'Notificações'
    : `Notificações, ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
  return (
    <Link to="/notificacoes" className="sino" aria-label={rotulo}>
      <Icone nome="sino" tamanho={22} />
      {naoLidas > 0 && <span className="sino__badge" aria-hidden="true">{naoLidas > 9 ? '9+' : naoLidas}</span>}
    </Link>
  )
}
