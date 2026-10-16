/** Validação das turmas (molde semanal). Espelha as restrições de 0002_turmas_sessoes.sql. */

export const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
] as const

/** Ordem de exibição: segunda primeiro, domingo por último. */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0] as const

export interface EntradaTurma {
  nome: string
  dia_semana: string
  hora_inicio: string
  duracao_min: string
  vagas: string
}

export interface DadosTurma {
  nome: string
  dia_semana: number
  hora_inicio: string
  duracao_min: number
  vagas: number
}

export type ErrosTurma = Partial<Record<keyof EntradaTurma, string>>

const HORA = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/

function inteiro(texto: string): number | null {
  return /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null
}

export function validarTurma(e: EntradaTurma): { dados: DadosTurma | null; erros: ErrosTurma } {
  const erros: ErrosTurma = {}
  const nome = e.nome.trim()
  if (!nome) erros.nome = 'Informe o nome da turma.'
  else if (nome.length > 60) erros.nome = 'Use no máximo 60 caracteres.'

  const dia = inteiro(e.dia_semana)
  if (dia === null || dia > 6) erros.dia_semana = 'Escolha o dia da semana.'

  const hora = HORA.exec(e.hora_inicio.trim())
  if (!hora) erros.hora_inicio = 'Informe o horário no formato HH:MM (ex.: 06:30).'

  const duracao = inteiro(e.duracao_min)
  if (duracao === null || duracao < 1 || duracao > 600) erros.duracao_min = 'A duração vai de 1 a 600 minutos.'

  const vagas = inteiro(e.vagas)
  if (vagas === null || vagas < 1 || vagas > 500) erros.vagas = 'Informe um número de vagas entre 1 e 500.'

  if (Object.keys(erros).length) return { dados: null, erros }
  return {
    dados: {
      nome,
      dia_semana: dia!,
      hora_inicio: `${hora![1]}:${hora![2]}:00`,
      duracao_min: duracao!,
      vagas: vagas!,
    },
    erros,
  }
}

export function formatarHoraTurma(hora: string): string {
  return hora.slice(0, 5)
}

/* ------------------------------------------------ edição pela RPC treinador_atualizar_turma (0011) */

/** Aula futura que tinha alguém confirmado ou na espera: ficou com o horário e as vagas antigos. */
export interface AulaPreservada {
  id: string
  inicia_em: string
  vagas: number
  confirmados: number
  na_espera: number
}

/** Retorno de treinador_atualizar_turma. */
export interface RelatorioTurma {
  movidas: number
  atualizadas: number
  removidas: number
  criadas: number
  preservadas: AulaPreservada[]
  canceladas: { id: string; inicia_em: string }[]
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Normaliza o jsonb da RPC (campos ausentes viram 0 / lista vazia). */
export function lerRelatorioTurma(dados: unknown): RelatorioTurma {
  const d = (dados && typeof dados === 'object' ? dados : {}) as Record<string, unknown>
  return {
    movidas: n(d.movidas),
    atualizadas: n(d.atualizadas),
    removidas: n(d.removidas),
    criadas: n(d.criadas),
    preservadas: lista<AulaPreservada>(d.preservadas),
    canceladas: lista<{ id: string; inicia_em: string }>(d.canceladas),
  }
}

const aulas = (q: number) => (q === 1 ? '1 aula' : `${q} aulas`)

/** Frase curta de sucesso após editar uma turma. A lista de preservadas vai à parte. */
export function resumoEdicaoTurma(r: RelatorioTurma, vagas: number): string {
  const partes = ['Turma atualizada.']
  const soVagas = r.atualizadas - r.movidas
  if (r.movidas > 0) {
    partes.push(`${aulas(r.movidas)} sem check-in ${r.movidas === 1 ? 'foi' : 'foram'} para o novo dia e horário.`)
  }
  if (soVagas > 0) {
    partes.push(`${aulas(soVagas)} sem check-in ${soVagas === 1 ? 'passou' : 'passaram'} a ter ${vagas} vagas.`)
  }
  if (r.criadas > 0) {
    partes.push(`${aulas(r.criadas)} ${r.criadas === 1 ? 'nova criada' : 'novas criadas'} no novo horário.`)
  }
  if (r.removidas > 0) {
    partes.push(`${aulas(r.removidas)} sem check-in que não ${r.removidas === 1 ? 'cabia' : 'cabiam'} no novo horário ` +
      `${r.removidas === 1 ? 'foi removida' : 'foram removidas'}.`)
  }
  partes.push('Nome e duração já valem em todas as aulas.')
  return partes.join(' ')
}

/** "2 confirmados, 1 na espera" — o que segura a aula no horário antigo. */
export function descreverOcupacao(a: AulaPreservada): string {
  const itens: string[] = []
  if (a.confirmados > 0) itens.push(`${a.confirmados} ${a.confirmados === 1 ? 'confirmado' : 'confirmados'}`)
  if (a.na_espera > 0) itens.push(`${a.na_espera} na espera`)
  return itens.join(', ')
}

/* ------------------------------------------------ grade semanal (tela Turmas no computador) */
export interface GradeSemanal<T> {
  /** Dias com pelo menos uma turma, de segunda a domingo. */
  dias: number[]
  /** Horários de início (HH:MM) presentes em algum dia, em ordem. */
  horarios: string[]
  /** Turmas daquele horário naquele dia (normalmente 0 ou 1). */
  celula: (horario: string, dia: number) => T[]
}

/** Organiza as turmas numa grade horário × dia. */
export function gradeSemanal<T extends { dia_semana: number; hora_inicio: string; nome: string }>(turmas: T[]): GradeSemanal<T> {
  const mapa = new Map<string, T[]>()
  for (const t of turmas) {
    const chave = `${formatarHoraTurma(t.hora_inicio)}|${t.dia_semana}`
    mapa.set(chave, [...(mapa.get(chave) ?? []), t].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  }
  return {
    dias: ORDEM_DIAS.filter((d) => turmas.some((t) => t.dia_semana === d)),
    horarios: [...new Set(turmas.map((t) => formatarHoraTurma(t.hora_inicio)))].sort(),
    celula: (horario, dia) => mapa.get(`${horario}|${dia}`) ?? [],
  }
}
