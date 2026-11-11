import { useState } from 'react'
import { Avatar, Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Dialogo } from '../../../components/Dialogo'
import { filtrarAlunos, type FiltroAlunos } from '../../../lib/alunos'
import { chaveDiaSP, inicioDoDiaSP } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import { inicioDoMes, nomeDoMes } from '../../../lib/frequencia'
import type { Perfil } from '../../../lib/tipos'
import { useAgora } from '../../agenda/useAgenda'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { useCarga } from '../useCarga'
import { contarAulasNoPeriodo, definirAlunoAtivo, definirPlano, listarAlunos, listarConvites } from './api'
import { ListaConvites } from './ListaConvites'
import { NovaSenhaAluno } from './NovaSenhaAluno'
import { NovoConvite } from './NovoConvite'
import { RelatorioMensal } from './RelatorioMensal'

export function Alunos() {
  const agora = useAgora()
  const alunos = useCarga(listarAlunos, 'alunos')
  const convites = useCarga(listarConvites, 'convites')
  const [alvo, setAlvo] = useState<Perfil | null>(null)
  const [alvoSenha, setAlvoSenha] = useState<Perfil | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroAlunos>('todos')
  const hoje = chaveDiaSP(agora)
  // Aulas do mês corrente até agora, por aluno. Se falhar, a coluna mostra traço (é informação extra).
  const aulasMes = useCarga(() => contarAulasNoPeriodo(inicioDoDiaSP(inicioDoMes(hoje)), new Date()), `mes-${hoje}`)

  const lista = alunos.dados ?? []
  const ativos = lista.filter((a) => a.ativo).length
  const visiveis = filtrarAlunos(lista, busca, filtro)
  const opcoes: [FiltroAlunos, string, number][] = [
    ['todos', 'Todos', lista.length], ['ativos', 'Ativos', ativos], ['inativos', 'Inativos', lista.length - ativos],
  ]

  async function mudarPlano(a: Perfil, valor: string) {
    try {
      await definirPlano(a.id, valor ? Number(valor) : null)
      setRetorno({ tom: 'sucesso', texto: valor ? `Plano de ${a.nome}: ${valor}x por semana.` : `${a.nome} ficou sem plano definido.` })
      await alunos.recarregar()
    } catch (e) {
      setRetorno({ tom: 'erro', texto: mensagemErro(e, { treinador: true }) })
    }
  }

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
      <Controle titulo="Alunos"
        subtitulo={alunos.dados ? `${ativos} ${ativos === 1 ? 'ativo' : 'ativos'} de ${lista.length} ${lista.length === 1 ? 'aluno' : 'alunos'}` : 'Carregando…'} />

      <div className="alunos-grade">
        <section className="cartao" aria-labelledby="titulo-alunos">
          <h2 className="cartao__titulo" id="titulo-alunos">Lista de alunos</h2>
          <Anuncio retorno={retorno} />
          <EstadoLista carregando={alunos.carregando} erro={alunos.erro} vazio={!lista.length}
            textoCarregando="Carregando alunos…" tituloErro="Não foi possível carregar os alunos"
            tituloVazio="Nenhum aluno ainda" textoVazio="Gere um link de convite e envie para o primeiro aluno."
            onTentar={() => void alunos.recarregar()}>
            <div className="filtro-alunos">
              <label className="sr-only" htmlFor="busca-alunos">Buscar aluno</label>
              <input id="busca-alunos" type="search" className="campo__entrada filtro-alunos__busca"
                placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className="segmentado" role="group" aria-label="Situação">
                {opcoes.map(([valor, rotulo, quantos]) => (
                  <button key={valor} type="button" className="segmentado__opcao" aria-pressed={filtro === valor}
                    onClick={() => setFiltro(valor)}>
                    {rotulo} <span className="segmentado__num">{quantos}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="tabela-rolagem">
              <table className="tabela">
                <caption className="sr-only">Alunos cadastrados, com telefone, aulas no mês e situação</caption>
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col" className="tabela__tel">Telefone</th>
                    <th scope="col" className="tabela__num">Aulas em {nomeDoMes(hoje)}</th>
                    <th scope="col">Plano</th>
                    <th scope="col">Situação</th>
                    <th scope="col"><span className="sr-only">Ação</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.length === 0 && (
                    <tr><td colSpan={6} className="tabela__vazio">Nenhum aluno encontrado.</td></tr>
                  )}
                  {visiveis.map((a) => (
                    <tr key={a.id} className={a.ativo ? '' : 'tabela__linha--inativa'}>
                      <th scope="row">
                        <span className="tabela__nome"><Avatar nome={a.nome} foto={a.foto_url} className="avatar--mini" />{a.nome}</span>
                        {a.telefone && <a className="tabela__tel-movel" href={`tel:${a.telefone.replace(/[^\d+]/g, '')}`}>{a.telefone}</a>}
                      </th>
                      <td className="tabela__tel">{a.telefone ? <a href={`tel:${a.telefone.replace(/[^\d+]/g, '')}`}>{a.telefone}</a> : <span className="tabela__vazio">—</span>}</td>
                      <td className="tabela__num">{aulasMes.dados ? (aulasMes.dados.get(a.id) ?? 0) : '–'}</td>
                      <td>
                        <select className="campo__entrada plano-select" value={a.plano_aulas_semana ?? ''}
                          aria-label={`Plano de ${a.nome}`} onChange={(e) => void mudarPlano(a, e.target.value)}>
                          <option value="">Sem plano</option>
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}x por semana</option>)}
                        </select>
                      </td>
                      <td>{a.ativo ? <span className="situacao-ativo">Ativo</span> : <Chip tom="cancelada">Inativo</Chip>}</td>
                      <td className="tabela__acao">
                        <Botao variante="texto" onClick={() => setAlvoSenha(a)} aria-label={`Nova senha para ${a.nome}`}>
                          Nova senha
                        </Botao>
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

      <RelatorioMensal hoje={hoje} />

      <NovaSenhaAluno aluno={alvoSenha} onFechar={() => setAlvoSenha(null)} />

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
            {alvo.nome} <strong>não conseguirá mais entrar no app</strong> e será desconectado(a) dos aparelhos. Os check-ins que já
            estiverem feitos em aulas futuras <strong>não</strong> são cancelados automaticamente; remova-os na Chamada, se quiser.
          </p>
        ) : (
          <p>{alvo?.nome} volta a poder entrar no app e fazer check-in nas aulas.</p>
        )}
      </Dialogo>
    </div>
  )
}
