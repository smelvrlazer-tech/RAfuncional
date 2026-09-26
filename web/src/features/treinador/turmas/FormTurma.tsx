import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso, Botao, Campo } from '../../../components/Basicos'
import { CampoSelecao } from '../../../components/Campos'
import { mensagemErro } from '../../../lib/erros'
import type { Turma } from '../../../lib/tipos'
import {
  DIAS_SEMANA, ORDEM_DIAS, formatarHoraTurma, resumoEdicaoTurma, validarTurma,
  type EntradaTurma, type ErrosTurma, type RelatorioTurma,
} from '../../../lib/turmas'
import { atualizarTurma, criarTurma } from './api'

interface Props {
  /** null = nova turma. */
  turma: Turma | null
  /** `relatorio` só vem na edição (retorno da RPC). */
  onSalvo: (mensagem: string, relatorio?: RelatorioTurma) => void
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
        const relatorio = await atualizarTurma(turma.id, r.dados)
        onSalvo(resumoEdicaoTurma(relatorio, r.dados.vagas), relatorio)
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
          erro={erros.dia_semana}>
          {ORDEM_DIAS.map((d) => <option key={d} value={d}>{DIAS_SEMANA[d]}</option>)}
        </CampoSelecao>
        <Campo rotulo="Horário de início" type="time" value={e.hora_inicio} onChange={mudar('hora_inicio')}
          erro={erros.hora_inicio} dica="Horário de Brasília (São Paulo)." required />
        <Campo rotulo="Duração (minutos)" type="number" inputMode="numeric" min={1} max={600}
          value={e.duracao_min} onChange={mudar('duracao_min')} erro={erros.duracao_min} required />
        <Campo rotulo="Vagas" type="number" inputMode="numeric" min={1} max={500}
          value={e.vagas} onChange={mudar('vagas')} erro={erros.vagas} required />
        {editando && (
          <Aviso titulo="Como a mudança chega às aulas">
            Dia, horário e vagas novos valem na hora para as aulas futuras sem check-in. Aulas que já têm alunos
            confirmados ou na espera ficam como estão; ao salvar, mostramos quais são para você decidir no painel do
            dia. Aulas passadas e canceladas não mudam.
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
