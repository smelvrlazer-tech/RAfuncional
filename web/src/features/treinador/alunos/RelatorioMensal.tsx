import { useState } from 'react'
import { Botao } from '../../../components/Basicos'
import { Icone } from '../../../components/Icone'
import { nomeDoMes } from '../../../lib/frequencia'
import { EstadoLista } from '../comum'
import { useCarga } from '../useCarga'
import { relatorioMensal } from './api'

/** Relatório do mês: reservas, presenças e no-show (falta marcada + aula sem marcação) por aluno. */
export function RelatorioMensal({ hoje }: { hoje: string }) {
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)))
  const carga = useCarga(() => relatorioMensal(ano, mes), `rel-${ano}-${mes}`)
  const linhas = carga.dados ?? []
  const atual = ano === Number(hoje.slice(0, 4)) && mes === Number(hoje.slice(5, 7))
  const semMarcar = linhas.reduce((n, l) => n + l.sem_marcacao, 0)

  function mover(delta: number) {
    const total = ano * 12 + (mes - 1) + delta
    setAno(Math.floor(total / 12))
    setMes((total % 12) + 1)
  }

  return (
    <section className="cartao" aria-labelledby="titulo-relatorio">
      <div className="relatorio__cabeca">
        <h2 className="cartao__titulo" id="titulo-relatorio">Relatório de {nomeDoMes(`${ano}-${String(mes).padStart(2, '0')}-01`)} de {ano}</h2>
        <div className="relatorio__mes">
          <Botao variante="contorno" onClick={() => mover(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></Botao>
          <Botao variante="contorno" onClick={() => mover(1)} disabled={atual} aria-label="Próximo mês"><Icone nome="seta" /></Botao>
        </div>
      </div>
      <EstadoLista carregando={carga.carregando} erro={carga.erro} vazio={!linhas.length}
        textoCarregando="Carregando o relatório…" tituloErro="Não foi possível carregar o relatório"
        tituloVazio="Nenhum aluno ativo" textoVazio="Quando houver alunos ativos, o relatório aparece aqui."
        onTentar={() => void carga.recarregar()}>
        {semMarcar > 0 && (
          <p className="relatorio__dica">
            {semMarcar} {semMarcar === 1 ? 'aula encerrada ainda sem presença marcada' : 'aulas encerradas ainda sem presença marcada'}:
            contam como falta até você marcar na tela da aula.
          </p>
        )}
        <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Relatório mensal por aluno (role para o lado)">
          <table className="tabela">
            <caption className="sr-only">Reservas, presenças e faltas por aluno no mês</caption>
            <thead>
              <tr>
                <th scope="col">Aluno</th>
                <th scope="col" className="tabela__num">Plano</th>
                <th scope="col" className="tabela__num">Reservas</th>
                <th scope="col" className="tabela__num">Compareceu</th>
                <th scope="col" className="tabela__num">Faltou</th>
                <th scope="col" className="tabela__num">Sem marcação</th>
                <th scope="col" className="tabela__num">No-show</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.aluno_id}>
                  <th scope="row">{l.nome}</th>
                  <td className="tabela__num">{l.plano_aulas_semana ? `${l.plano_aulas_semana}x` : '–'}</td>
                  <td className="tabela__num">{l.reservas}</td>
                  <td className="tabela__num">{l.compareceu}</td>
                  <td className="tabela__num">{l.faltas}</td>
                  <td className="tabela__num">{l.sem_marcacao}</td>
                  <td className={`tabela__num ${l.no_show > 0 ? 'relatorio__alerta' : ''}`}>{l.no_show}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoLista>
    </section>
  )
}
