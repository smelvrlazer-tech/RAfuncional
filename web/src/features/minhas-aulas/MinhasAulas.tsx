import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Botao, EsqueletoLista } from '../../components/Basicos'
import { rotuloDiaLongo } from '../../lib/datetime'
import { mensagemErro } from '../../lib/erros'
import { minhasAulas, textoResumoMinhasAulas } from '../../lib/minhasAulas'
import { CartaoSessao } from '../agenda/CartaoSessao'
import { useAgenda, useLimiteBloqueio } from '../agenda/useAgenda'
import { Frequencia } from './Frequencia'

/** Aba "Minhas aulas": o que a pessoa reservou (confirmado ou fila) e a frequência do mês. */
export function MinhasAulas() {
  const { perfil } = useAuth()
  const { agora, linhas, erro, recarregar } = useAgenda()
  const limiteMin = useLimiteBloqueio()
  const ativo = perfil?.ativo ?? true
  const resumo = useMemo(() => minhasAulas(linhas ?? [], agora), [linhas, agora])

  return (
    <div className="tela tela--minhas-aulas">
      <header className="titulo-aba">
        <h1 className="titulo-aba__titulo">Minhas aulas</h1>
        <p className="titulo-aba__resumo">{linhas ? textoResumoMinhasAulas(resumo) : 'Carregando…'}</p>
      </header>

      <div className="minhas-aulas__lista">
        {erro != null && (
          <Aviso tom="erro" role="alert" titulo="Não foi possível carregar suas aulas">
            {mensagemErro(erro)}{' '}
            <Botao variante="texto" onClick={() => void recarregar()}>Tentar de novo</Botao>
          </Aviso>
        )}

        {linhas === null && !erro ? (
          <EsqueletoLista texto="Carregando suas aulas…" itens={2} />
        ) : resumo.grupos.length === 0 && !erro ? (
          <div className="vazio">
            <p className="vazio__titulo">Você ainda não reservou nenhuma aula</p>
            <p className="vazio__texto">Escolha um horário na agenda e garanta seu lugar.</p>
            <Link to="/" className="botao botao--primario">Ver a agenda</Link>
          </div>
        ) : (
          resumo.grupos.map((grupo) => (
            <section key={grupo.dia} className="dia-agenda" aria-labelledby={`dia-${grupo.dia}`}>
              <div className="dia-agenda__cabeca">
                <h2 id={`dia-${grupo.dia}`} className="dia-agenda__titulo">{rotuloDiaLongo(grupo.dia)}</h2>
              </div>
              <ol className="lista-sessoes">
                {grupo.aulas.map((s) => (
                  <li key={s.id}>
                    <CartaoSessao
                      sessao={s}
                      agora={agora}
                      ativo={ativo}
                      limiteMin={limiteMin}
                      onAtualizar={recarregar}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <Frequencia agora={agora} />
    </div>
  )
}
