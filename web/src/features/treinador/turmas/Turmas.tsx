import { useState } from 'react'
import { Aviso, Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Dialogo } from '../../../components/Dialogo'
import { Icone } from '../../../components/Icone'
import { SEMANA_CURTA, chaveDiaSP, diaDaSemana, formatarDataHoraCurta } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import { MIDIA_LARGA, useMidia } from '../../../lib/useMidia'
import type { Turma } from '../../../lib/tipos'
import {
  DIAS_SEMANA, ORDEM_DIAS, descreverOcupacao, formatarHoraTurma, gradeSemanal, type RelatorioTurma,
} from '../../../lib/turmas'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { useCarga } from '../useCarga'
import { contarAulasFuturas, definirTurmaAtiva, listarTurmas } from './api'
import { FormTurma } from './FormTurma'

type Form = { turma: Turma | null } | null
interface Desativar { turma: Turma; aulas: number | null }

const descreverTurma = (t: Turma) => `${t.nome} (${DIAS_SEMANA[t.dia_semana]!.toLowerCase()}, ${formatarHoraTurma(t.hora_inicio)})`

/** "SEG 05/10 · 06:00", no fuso de São Paulo. */
const quando = (iso: string) => `${SEMANA_CURTA[diaDaSemana(chaveDiaSP(iso))]} ${formatarDataHoraCurta(iso)}`

/**
 * Depois de editar: aulas que tinham alunos (ficaram com horário e vagas antigos) e aulas
 * canceladas (continuam canceladas no horário antigo). O treinador decide no painel do dia.
 */
function AulasNaoAlteradas({ relatorio, onFechar }: { relatorio: RelatorioTurma; onFechar: () => void }) {
  const { preservadas, canceladas } = relatorio
  if (!preservadas.length && !canceladas.length) return null
  const titulo = preservadas.length === 0 ? 'Aulas canceladas não foram alteradas'
    : preservadas.length === 1 ? '1 aula com alunos ficou como estava'
    : `${preservadas.length} aulas com alunos ficaram como estavam`
  return (
    <Aviso tom="alerta" titulo={titulo}>
      {preservadas.length > 0 && (
        <>
          <p>
            Estas aulas já tinham alunos confirmados ou na espera, então mantiveram o horário e as vagas anteriores.
            Se não vão acontecer assim, cancele-as no painel do dia (os alunos são avisados).
          </p>
          <ul className="aulas-nao-alteradas" aria-label="Aulas com alunos que ficaram como estavam">
            {preservadas.map((a) => (
              <li key={a.id}>
                <strong>{quando(a.inicia_em)}</strong> · {a.vagas} vagas · {descreverOcupacao(a)}
              </li>
            ))}
          </ul>
        </>
      )}
      {canceladas.length > 0 && (
        <>
          <p>
            Aulas canceladas continuam canceladas no horário anterior. Se a aula no novo horário dessas semanas
            também não vai acontecer, cancele-a no painel do dia.
          </p>
          <ul className="aulas-nao-alteradas" aria-label="Aulas canceladas">
            {canceladas.map((a) => <li key={a.id}><strong>{quando(a.inicia_em)}</strong> · cancelada</li>)}
          </ul>
        </>
      )}
      <Botao variante="texto" onClick={onFechar}>Entendi</Botao>
    </Aviso>
  )
}

export function Turmas() {
  const { dados, erro, carregando, recarregar } = useCarga(listarTurmas, 'turmas')
  const [form, setForm] = useState<Form>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)
  const [relatorio, setRelatorio] = useState<RelatorioTurma | null>(null)
  const [desativar, setDesativar] = useState<Desativar | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)

  const turmas = dados ?? []
  const semTurma = ORDEM_DIAS.filter((d) => !turmas.some((t) => t.dia_semana === d))

  async function salvo(mensagem: string, rel?: RelatorioTurma) {
    setForm(null)
    const n = rel?.preservadas.length ?? 0
    const aviso = n === 1 ? ' Atenção: 1 aula com alunos ficou como estava — veja abaixo.'
      : n > 1 ? ` Atenção: ${n} aulas com alunos ficaram como estavam — veja abaixo.` : ''
    setRetorno({ tom: 'sucesso', texto: mensagem + aviso })
    setRelatorio(rel ?? null)
    await recarregar()
  }

  function abrirForm(turma: Turma | null) {
    setRetorno(null)
    setRelatorio(null)
    setForm({ turma })
  }

  function pedirDesativar(t: Turma) {
    setErroDialogo(null)
    setDesativar({ turma: t, aulas: null })
    contarAulasFuturas(t.id)
      .then((n) => setDesativar((d) => (d?.turma.id === t.id ? { ...d, aulas: n } : d)))
      .catch(() => setDesativar((d) => (d?.turma.id === t.id ? { ...d, aulas: -1 } : d)))
  }

  async function mudarAtiva(t: Turma, ativa: boolean) {
    setEnviando(t.id)
    setErroDialogo(null)
    try {
      await definirTurmaAtiva(t.id, ativa)
      setDesativar(null)
      setRetorno({
        tom: 'sucesso',
        texto: ativa
          ? `${t.nome} reativada. As aulas voltam a aparecer a partir da próxima geração automática (diária).`
          : `${t.nome} desativada. Nenhuma aula nova será gerada para ela.`,
      })
      await recarregar()
    } catch (e) {
      const texto = mensagemErro(e, { treinador: true })
      if (ativa) setRetorno({ tom: 'erro', texto })
      else setErroDialogo(texto)
    } finally {
      setEnviando(null)
    }
  }

  const aulas = desativar?.aulas
  const continuam = ', com os check-ins que já tiverem; se precisar, cancele-as no painel do dia.'
  const textoAulas = aulas == null ? 'Contando as aulas já geradas…'
    : aulas < 0 ? `As aulas já geradas continuam na agenda${continuam}`
    : aulas === 0 ? 'Não há aulas futuras já geradas para ela.'
    : aulas === 1 ? `A aula futura já gerada continua na agenda${continuam}`
    : `As ${aulas} aulas futuras já geradas continuam na agenda${continuam}`

  // Computador: grade horário × dia. Celular: lista por dia (mais fácil de rolar com o polegar).
  const largo = useMidia(MIDIA_LARGA)
  const grade = gradeSemanal(turmas)

  function acoes(t: Turma) {
    return (
      <div className="turma__acoes">
        <Botao variante="contorno" aria-label={`Editar ${descreverTurma(t)}`}
          onClick={() => abrirForm(t)}>
          <Icone nome="lapis" /> Editar
        </Botao>
        {t.ativa ? (
          <Botao variante="texto" aria-label={`Desativar ${descreverTurma(t)}`} onClick={() => pedirDesativar(t)}>
            Desativar
          </Botao>
        ) : (
          <Botao variante="texto" aria-label={`Reativar ${descreverTurma(t)}`} carregando={enviando === t.id}
            onClick={() => void mudarAtiva(t, true)}>
            Reativar
          </Botao>
        )}
      </div>
    )
  }

  return (
    <div className="tela-treinador">
      <Controle titulo="Turmas"
        subtitulo="Horários fixos da semana. As aulas são geradas sozinhas para as próximas 4 semanas.">
        {!form && (
          <Botao variante="primario" onClick={() => abrirForm(null)}>
            <Icone nome="mais" /> Nova turma
          </Botao>
        )}
      </Controle>

      {form && <FormTurma key={form.turma?.id ?? 'nova'} turma={form.turma} onSalvo={(m, r) => void salvo(m, r)} onCancelar={() => setForm(null)} />}
      <Anuncio retorno={retorno} />
      {relatorio && <AulasNaoAlteradas relatorio={relatorio} onFechar={() => setRelatorio(null)} />}

      <EstadoLista carregando={carregando} erro={erro} vazio={!turmas.length}
        textoCarregando="Carregando as turmas…" tituloErro="Não foi possível carregar as turmas"
        tituloVazio="Nenhuma turma cadastrada" textoVazio="Crie a primeira turma com o botão “Nova turma”."
        onTentar={() => void recarregar()}>
        {largo ? (
          <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Grade de turmas da semana">
            <table className="grade-turmas">
              <caption className="sr-only">Turmas da semana por horário e dia</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Horário</span></th>
                  {grade.dias.map((d) => <th scope="col" key={d}>{DIAS_SEMANA[d]!.split('-')[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {grade.horarios.map((h) => (
                  <tr key={h}>
                    <th scope="row" className="grade-turmas__hora">{h}</th>
                    {grade.dias.map((d) => (
                      <td key={d}>
                        {grade.celula(h, d).map((t) => (
                          <div key={t.id} className={`celula-turma ${t.ativa ? '' : 'celula-turma--inativa'}`}>
                            <p className="celula-turma__nome">{t.nome}</p>
                            <p className="celula-turma__meta">
                              {t.duracao_min} min · {t.vagas} vagas
                              {!t.ativa && <Chip tom="cancelada">Inativa</Chip>}
                            </p>
                            {acoes(t)}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grade-dias">
            {ORDEM_DIAS.filter((d) => !semTurma.includes(d)).map((d) => (
              <section key={d} className="dia-turmas" aria-labelledby={`dia-${d}`}>
                <h2 className="dia-turmas__titulo" id={`dia-${d}`}>{DIAS_SEMANA[d]}</h2>
                <ul className="turmas">
                  {turmas.filter((t) => t.dia_semana === d).map((t) => (
                    <li key={t.id} className={`turma ${t.ativa ? '' : 'turma--inativa'}`}>
                      <span className="turma__hora">{formatarHoraTurma(t.hora_inicio)}</span>
                      <div className="turma__info">
                        <p className="turma__nome">{t.nome}</p>
                        <p className="turma__meta">
                          {t.duracao_min} min · {t.vagas} vagas
                          {!t.ativa && <Chip tom="cancelada">Inativa</Chip>}
                        </p>
                      </div>
                      {acoes(t)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {semTurma.length > 0 && (
          <p className="nota">Sem turmas: {semTurma.map((d) => DIAS_SEMANA[d]).join(', ')}.</p>
        )}
      </EstadoLista>

      {/* Explicação de consulta, não aviso: fica recolhida para não competir com a grade. */}
      <details className="explicacao">
        <summary>Como as mudanças chegam à agenda</summary>
        <p>
          Criar ou reativar uma turma faz as aulas aparecerem na próxima geração automática (diária). Editar dia,
          horário ou vagas muda na hora as aulas futuras sem check-in; as que já têm alunos ficam como estão e são
          listadas para você. Turmas nunca são apagadas: desativar só interrompe a geração de aulas novas e preserva
          todo o histórico de presença.
        </p>
      </details>

      <Dialogo
        aberto={desativar !== null}
        titulo={desativar ? `Desativar ${desativar.turma.nome}?` : ''}
        rotuloConfirmar="Desativar turma"
        onConfirmar={() => desativar && void mudarAtiva(desativar.turma, false)}
        onFechar={() => setDesativar(null)}
        enviando={enviando !== null}
        erro={erroDialogo}
        perigo
      >
        {desativar && (
          <p>
            {descreverTurma(desativar.turma)} deixa de gerar aulas novas. {textoAulas} Nada é apagado e você pode
            reativar depois.
          </p>
        )}
      </Dialogo>
    </div>
  )
}
