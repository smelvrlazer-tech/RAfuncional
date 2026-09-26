import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, BarraTopo, Botao, Carregando } from '../../components/Basicos'
import { Icone } from '../../components/Icone'
import { formatarDataHoraCurta } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { supabase } from '../../lib/supabase'
import type { Notificacao } from '../../lib/tipos'
import { useAoFocar } from '../../lib/useFoco'
import { useNaoLidas } from './NotificacoesContext'

/** Não lidas primeiro; dentro de cada grupo, mais recentes primeiro. */
export function ordenarNotificacoes(lista: Notificacao[]): Notificacao[] {
  return [...lista].sort((a, b) => {
    const la = a.lida_em ? 1 : 0
    const lb = b.lida_em ? 1 : 0
    if (la !== lb) return la - lb
    return b.criado_em.localeCompare(a.criado_em)
  })
}

/** Só segue links internos (ex.: /sessao/<id>); nunca navega para fora do app. */
function linkInterno(link: string | null): string | null {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null
}

export function Notificacoes() {
  const navigate = useNavigate()
  const { recarregarNaoLidas } = useNaoLidas()
  const [lista, setLista] = useState<Notificacao[] | null>(null)
  const [erro, setErro] = useState<unknown>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, titulo, corpo, link, lida_em, criado_em')
      .order('criado_em', { ascending: false })
      .limit(50)
    if (error) setErro(error)
    else {
      setErro(null)
      setLista(ordenarNotificacoes((data ?? []) as Notificacao[]))
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useAoFocar(() => void carregar())

  async function marcarLidas(ids: string[]) {
    if (!ids.length) return
    const agora = new Date().toISOString()
    const { error } = await supabase.from('notificacoes').update({ lida_em: agora }).in('id', ids)
    if (error) setErro(error)
    await Promise.all([carregar(), recarregarNaoLidas()])
  }

  async function abrir(n: Notificacao) {
    if (!n.lida_em) await marcarLidas([n.id])
    const destino = linkInterno(n.link)
    if (destino && destino !== '/notificacoes') navigate(destino)
  }

  const naoLidas = (lista ?? []).filter((n) => !n.lida_em)

  return (
    <div className="tela">
      <BarraTopo titulo="Notificações" />
      {erro != null && <Aviso tom="erro" role="alert">{mensagemErro(erro)}</Aviso>}
      {lista === null && !erro ? (
        <Carregando />
      ) : lista && lista.length === 0 ? (
        <div className="vazio">
          <Icone nome="sino" tamanho={28} />
          <p className="vazio__titulo">Nada por aqui ainda</p>
          <p className="vazio__texto">Avisos de vaga liberada, aula cancelada e treinos da semana aparecem aqui.</p>
        </div>
      ) : (
        <>
          {naoLidas.length > 1 && (
            <div className="notificacoes__topo">
              <Botao variante="texto" onClick={() => void marcarLidas(naoLidas.map((n) => n.id))}>
                Marcar todas como lidas
              </Botao>
            </div>
          )}
          <ul className="notificacoes">
            {(lista ?? []).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notificacao ${n.lida_em ? 'notificacao--lida' : 'notificacao--nova'}`}
                  onClick={() => void abrir(n)}
                >
                  <span className="notificacao__marca" aria-hidden="true" />
                  <span className="notificacao__corpo">
                    <span className="notificacao__titulo">
                      {!n.lida_em && <span className="sr-only">Não lida: </span>}
                      {n.titulo}
                    </span>
                    <span className="notificacao__texto">{n.corpo}</span>
                    <span className="notificacao__data">{formatarDataHoraCurta(n.criado_em)}</span>
                  </span>
                  {!n.lida_em && <span className="notificacao__nova" aria-hidden="true">Nova</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
