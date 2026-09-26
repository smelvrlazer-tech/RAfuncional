import { useState } from 'react'
import { Avatar, Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Dialogo } from '../../../components/Dialogo'
import { mensagemErro } from '../../../lib/erros'
import type { Perfil } from '../../../lib/tipos'
import { useAgora } from '../../agenda/useAgenda'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { useCarga } from '../useCarga'
import { definirAlunoAtivo, listarAlunos, listarConvites } from './api'
import { ListaConvites } from './ListaConvites'
import { NovoConvite } from './NovoConvite'

export function Alunos() {
  const agora = useAgora()
  const alunos = useCarga(listarAlunos, 'alunos')
  const convites = useCarga(listarConvites, 'convites')
  const [alvo, setAlvo] = useState<Perfil | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)

  const lista = alunos.dados ?? []
  const ativos = lista.filter((a) => a.ativo).length

  async function confirmar() {
    if (!alvo) return
    const ativar = !alvo.ativo
    setEnviando(true)
    setErroDialogo(null)
    try {
      await definirAlunoAtivo(alvo.id, ativar)
      setRetorno({ tom: 'sucesso', texto: `${alvo.nome} ${ativar ? 'foi reativado(a)' : 'foi desativado(a)'}.` })
      setAlvo(null)
      await alunos.recarregar()
    } catch (e) {
      setErroDialogo(mensagemErro(e, { treinador: true }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela-treinador">
      <Controle compacto sobre="Turma de alunos" titulo="Alunos"
        subtitulo={alunos.dados ? `${ativos} ${ativos === 1 ? 'ativo' : 'ativos'} de ${lista.length} ${lista.length === 1 ? 'aluno' : 'alunos'}` : 'Carregando…'} />

      <div className="alunos-grade">
        <section className="cartao" aria-labelledby="titulo-alunos">
          <h2 className="cartao__titulo" id="titulo-alunos">Lista de alunos</h2>
          <Anuncio retorno={retorno} />
          <EstadoLista carregando={alunos.carregando} erro={alunos.erro} vazio={!lista.length}
            textoCarregando="Carregando alunos…" tituloErro="Não foi possível carregar os alunos"
            tituloVazio="Nenhum aluno ainda" textoVazio="Gere um link de convite e envie para o primeiro aluno."
            onTentar={() => void alunos.recarregar()}>
            <div className="tabela-rolagem">
              <table className="tabela">
                <caption className="sr-only">Alunos cadastrados, com telefone e situação</caption>
                <thead>
                  <tr><th scope="col">Nome</th><th scope="col" className="tabela__tel">Telefone</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ação</span></th></tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id} className={a.ativo ? '' : 'tabela__linha--inativa'}>
                      <th scope="row">
                        <span className="tabela__nome"><Avatar nome={a.nome} className="avatar--mini" />{a.nome}</span>
                        {a.telefone && <a className="tabela__tel-movel" href={`tel:${a.telefone.replace(/[^\d+]/g, '')}`}>{a.telefone}</a>}
                      </th>
                      <td className="tabela__tel">{a.telefone ? <a href={`tel:${a.telefone.replace(/[^\d+]/g, '')}`}>{a.telefone}</a> : <span className="tabela__vazio">—</span>}</td>
                      <td><Chip tom={a.ativo ? 'confirmado' : 'cancelada'}>{a.ativo ? 'Ativo' : 'Inativo'}</Chip></td>
                      <td className="tabela__acao">
                        <Botao variante="texto" onClick={() => { setErroDialogo(null); setAlvo(a) }}
                          aria-label={`${a.ativo ? 'Desativar' : 'Reativar'} ${a.nome}`}>
                          {a.ativo ? 'Desativar' : 'Reativar'}
                        </Botao>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </EstadoLista>
        </section>

        <div className="alunos-grade__lado">
          <NovoConvite onCriado={() => void convites.recarregar()} />
          <ListaConvites carga={convites} agora={agora} />
        </div>
      </div>

      <Dialogo
        aberto={alvo !== null}
        titulo={alvo ? `${alvo.ativo ? 'Desativar' : 'Reativar'} ${alvo.nome}?` : ''}
        rotuloConfirmar={alvo?.ativo ? 'Desativar aluno' : 'Reativar aluno'}
        onConfirmar={() => void confirmar()}
        onFechar={() => setAlvo(null)}
        enviando={enviando}
        erro={erroDialogo}
        perigo={alvo?.ativo}
      >
        {alvo?.ativo ? (
          <p>
            {alvo.nome} não poderá mais fazer check-in, mas continua vendo a agenda e o histórico. Os check-ins que já
            estiverem feitos em aulas futuras <strong>não</strong> são cancelados automaticamente.
          </p>
        ) : (
          <p>{alvo?.nome} volta a poder fazer check-in nas aulas.</p>
        )}
      </Dialogo>
    </div>
  )
}
