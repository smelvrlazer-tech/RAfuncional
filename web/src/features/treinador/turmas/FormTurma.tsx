import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso, Botao, Campo } from '../../../components/Basicos'
import { CampoSelecao } from '../../../components/Campos'
import { mensagemErro } from '../../../lib/erros'
import type { Turma } from '../../../lib/tipos'
import {
  DIAS_SEMANA, ORDEM_DIAS, formatarHoraTurma, validarTurma, type EntradaTurma, type ErrosTurma,
} from '../../../lib/turmas'
import { atualizarTurma, criarTurma } from './api'

interface Props {
  /** null = nova turma. */
  turma: Turma | null
  onSalvo: (mensagem: string) => void
  onCancelar: () => void
}

function entradaDe(t: Turma | null): EntradaTurma {
  return t
    ? { nome: t.nome, dia_semana: String(t.dia_semana), hora_inicio: formatarHoraTurma(t.hora_inicio),
        duracao_min: String(t.duracao_min), vagas: String(t.vagas) }
    : { nome: '', dia_semana: '1', hora_inicio: '', duracao_min: '60', vagas: '' }
}

export function FormTurma({ turma, onSalvo, onCancelar }: Props) {
  const [e, setE] = useState<EntradaTurma>(() => entradaDe(turma))
  const [erros, setErros] = useState<ErrosTurma>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)
  const editando = turma !== null

  useEffect(() => { titulo.current?.focus() }, [])

  const mudar = (campo: keyof EntradaTurma) => (ev: { target: { value: string } }) =>
    setE((atual) => ({ ...atual, [campo]: ev.target.value }))

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    const r = validarTurma(e)
    setErros(r.erros)
    setErroGeral(null)
    if (!r.dados) return
    setEnviando(true)
    try {
      if (turma) {
        await atualizarTurma(turma.id, { nome: r.dados.nome, duracao_min: r.dados.duracao_min, vagas: r.dados.vagas })
        onSalvo(r.dados.vagas !== turma.vagas
          ? 'Turma atualizada. Nome e duração já valem em todas as aulas; o novo número de vagas vale para as aulas ' +
            'geradas daqui em diante (as já geradas mantêm o número anterior).'
          : 'Turma atualizada. Nome e duração já valem em todas as aulas.')
      } else {
        await criarTurma(r.dados)
        onSalvo('Turma criada. As aulas aparecem na agenda a partir da próxima geração automática (diária).')
      }
    } catch (err) {
      setErroGeral(mensagemErro(err, { treinador: true }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="cartao form-painel" aria-labelledby="titulo-form-turma">
      <h2 className="cartao__titulo" id="titulo-form-turma" ref={titulo} tabIndex={-1}>
        {editando ? `Editar ${turma.nome}` : 'Nova turma'}
      </h2>
      <form className="formulario form-painel__grade" onSubmit={salvar} noValidate>
        <Campo rotulo="Nome da turma" value={e.nome} onChange={mudar('nome')} erro={erros.nome}
          placeholder="Ex.: Funcional Manhã" maxLength={60} required />
        <CampoSelecao rotulo="Dia da semana" value={e.dia_semana} onChange={mudar('dia_semana')}
          erro={erros.dia_semana} disabled={editando}>
          {ORDEM_DIAS.map((d) => <option key={d} value={d}>{DIAS_SEMANA[d]}</option>)}
        </CampoSelecao>
        <Campo rotulo="Horário de início" type="time" value={e.hora_inicio} onChange={mudar('hora_inicio')}
          erro={erros.hora_inicio} disabled={editando} dica="Horário de Brasília (São Paulo)." required />
        <Campo rotulo="Duração (minutos)" type="number" inputMode="numeric" min={1} max={600}
          value={e.duracao_min} onChange={mudar('duracao_min')} erro={erros.duracao_min} required />
        <Campo rotulo="Vagas" type="number" inputMode="numeric" min={1} max={500}
          value={e.vagas} onChange={mudar('vagas')} erro={erros.vagas} required />
        {editando && (
          <Aviso titulo="Dia e horário não mudam na edição">
            As aulas das próximas semanas já foram geradas nesse horário. Para mudar dia ou horário, desative esta
            turma e crie outra; as aulas já geradas continuam na agenda até você cancelá-las no painel do dia.
          </Aviso>
        )}
        {erroGeral && <p className="formulario__retorno formulario__retorno--erro" role="alert">{erroGeral}</p>}
        <div className="form-painel__botoes">
          <Botao type="submit" variante="escuro" carregando={enviando}>
            {editando ? 'Salvar alterações' : 'Criar turma'}
          </Botao>
          <Botao variante="texto" onClick={onCancelar} disabled={enviando}>Cancelar</Botao>
        </div>
      </form>
    </section>
  )
}
