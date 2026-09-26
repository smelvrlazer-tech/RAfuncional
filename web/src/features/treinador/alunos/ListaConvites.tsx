import { useState } from 'react'
import { Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Dialogo } from '../../../components/Dialogo'
import { estadoConvite, linkConvite, type EstadoConvite } from '../../../lib/convite'
import { chaveDiaSP } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import { formatarDataCurta } from '../../../lib/semana'
import type { Tom } from '../../../lib/estadoSessao'
import type { Convite } from '../../../lib/tipos'
import { Anuncio, EstadoLista, type Retorno } from '../comum'
import type { Carga } from '../useCarga'
import { revogarConvite } from './api'
import { copiarTexto } from './NovoConvite'

const VISUAL: Record<EstadoConvite, { tom: Tom; rotulo: string }> = {
  pendente: { tom: 'espera', rotulo: 'Pendente' },
  expirado: { tom: 'encerrada', rotulo: 'Expirado' },
  usado: { tom: 'confirmado', rotulo: 'Usado' },
  revogado: { tom: 'cancelada', rotulo: 'Revogado' },
}

export function ListaConvites({ carga, agora }: { carga: Carga<Convite[]>; agora: Date }) {
  const { dados, erro, carregando, recarregar } = carga
  const [alvo, setAlvo] = useState<Convite | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)

  async function revogar() {
    if (!alvo) return
    setEnviando(true)
    setErroDialogo(null)
    try {
      const ok = await revogarConvite(alvo.id)
      setAlvo(null)
      setRetorno(ok
        ? { tom: 'sucesso', texto: `Convite ${alvo.codigo} revogado. O link não funciona mais.` }
        : { tom: 'erro', texto: 'Esse convite já não estava pendente (pode ter acabado de ser usado).' })
      await recarregar()
    } catch (e) {
      setErroDialogo(mensagemErro(e, { treinador: true }))
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(c: Convite) {
    const ok = await copiarTexto(linkConvite(window.location.origin, c.codigo))
    setRetorno(ok ? { tom: 'sucesso', texto: `Link do convite ${c.codigo} copiado.` }
      : { tom: 'erro', texto: 'Não foi possível copiar o link.' })
  }

  return (
    <section className="cartao convites" aria-labelledby="titulo-convites">
      <h2 className="cartao__titulo" id="titulo-convites">Convites</h2>
      <Anuncio retorno={retorno} />
      <EstadoLista carregando={carregando} erro={erro} vazio={!dados?.length}
        textoCarregando="Carregando convites…" tituloErro="Não foi possível carregar os convites"
        tituloVazio="Nenhum convite ainda" onTentar={() => void recarregar()}>
        <ul className="convites__lista">
          {dados?.map((c) => {
            const estado = estadoConvite(c, agora)
            const v = VISUAL[estado]
            return (
              <li key={c.id} className="convite">
                <div className="convite__info">
                  <span className="convite__codigo">{c.codigo}</span>
                  <span className="convite__nome">
                    {estado === 'usado' && c.usado_por_nome ? `Usado por ${c.usado_por_nome}` : c.nome_previsto || 'Sem nome'}
                  </span>
                  <span className="convite__data">
                    Criado em {formatarDataCurta(chaveDiaSP(c.criado_em))}
                    {estado === 'pendente' && ` · vence em ${formatarDataCurta(chaveDiaSP(c.expira_em))}`}
                  </span>
                </div>
                <Chip tom={v.tom} icone={estado === 'pendente' ? 'relogio' : undefined}>{v.rotulo}</Chip>
                {estado === 'pendente' && (
                  <div className="convite__acoes">
                    <Botao variante="texto" onClick={() => void copiar(c)} aria-label={`Copiar link do convite ${c.codigo}`}>Copiar link</Botao>
                    <Botao variante="texto" onClick={() => { setErroDialogo(null); setAlvo(c) }} aria-label={`Revogar convite ${c.codigo}`}>Revogar</Botao>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </EstadoLista>

      <Dialogo aberto={alvo !== null} titulo={alvo ? `Revogar o convite ${alvo.codigo}?` : ''}
        rotuloConfirmar="Revogar convite" onConfirmar={() => void revogar()} onFechar={() => setAlvo(null)}
        enviando={enviando} erro={erroDialogo} perigo>
        <p>
          O link deixa de funcionar na hora e ninguém consegue se cadastrar com ele
          {alvo?.nome_previsto ? ` (${alvo.nome_previsto} vai precisar de um convite novo)` : ''}. Isso não pode ser desfeito.
        </p>
      </Dialogo>
    </section>
  )
}
