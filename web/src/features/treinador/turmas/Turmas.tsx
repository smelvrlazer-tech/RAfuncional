import { useState } from 'react'
import { Aviso, Botao } from '../../../components/Basicos'
import { Chip } from '../../../components/Chip'
import { Dialogo } from '../../../components/Dialogo'
import { Icone } from '../../../components/Icone'
import { mensagemErro } from '../../../lib/erros'
import type { Turma } from '../../../lib/tipos'
import { DIAS_SEMANA, ORDEM_DIAS, formatarHoraTurma } from '../../../lib/turmas'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { useCarga } from '../useCarga'
import { contarAulasFuturas, definirTurmaAtiva, listarTurmas } from './api'
import { FormTurma } from './FormTurma'

type Form = { turma: Turma | null } | null
interface Desativar { turma: Turma; aulas: number | null }

const descreverTurma = (t: Turma) => `${t.nome} (${DIAS_SEMANA[t.dia_semana]!.toLowerCase()}, ${formatarHoraTurma(t.hora_inicio)})`

export function Turmas() {
  const { dados, erro, carregando, recarregar } = useCarga(listarTurmas, 'turmas')
  const [form, setForm] = useState<Form>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)
  const [desativar, setDesativar] = useState<Desativar | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erroDialogo, setErroDialogo] = useState<string | null>(null)

  const turmas = dados ?? []
  const semTurma = ORDEM_DIAS.filter((d) => !turmas.some((t) => t.dia_semana === d))

  async function salvo(mensagem: string) {
    setForm(null)
    setRetorno({ tom: 'sucesso', texto: mensagem })
    await recarregar()
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

  return (
    <div className="tela-treinador">
      <Controle compacto sobre="Agenda semanal" titulo="Turmas"
        subtitulo="Os horários fixos da semana. A partir deles, as aulas são geradas automaticamente todos os dias para as próximas 4 semanas.">
        {!form && (
          <Botao variante="primario" onClick={() => { setRetorno(null); setForm({ turma: null }) }}>
            <Icone nome="mais" /> Nova turma
          </Botao>
        )}
      </Controle>

      {form && <FormTurma key={form.turma?.id ?? 'nova'} turma={form.turma} onSalvo={(m) => void salvo(m)} onCancelar={() => setForm(null)} />}
      <Anuncio retorno={retorno} />

      <EstadoLista carregando={carregando} erro={erro} vazio={!turmas.length}
        textoCarregando="Carregando as turmas…" tituloErro="Não foi possível carregar as turmas"
        tituloVazio="Nenhuma turma cadastrada" textoVazio="Crie a primeira turma com o botão “Nova turma”."
        onTentar={() => void recarregar()}>
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
                      <p className="turma__meta">{t.duracao_min} min · {t.vagas} vagas</p>
                    </div>
                    <Chip tom={t.ativa ? 'disponivel' : 'cancelada'}>{t.ativa ? 'Ativa' : 'Inativa'}</Chip>
                    <div className="turma__acoes">
                      <Botao variante="contorno" aria-label={`Editar ${descreverTurma(t)}`}
                        onClick={() => { setRetorno(null); setForm({ turma: t }) }}>
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
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {semTurma.length > 0 && (
          <p className="nota">Sem turmas: {semTurma.map((d) => DIAS_SEMANA[d]).join(', ')}.</p>
        )}
      </EstadoLista>

      <Aviso titulo="Como as mudanças chegam à agenda">
        Criar ou reativar uma turma faz as aulas aparecerem na próxima geração automática (diária). Turmas nunca são
        apagadas: desativar só interrompe a geração de aulas novas e preserva todo o histórico de presença.
      </Aviso>

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
