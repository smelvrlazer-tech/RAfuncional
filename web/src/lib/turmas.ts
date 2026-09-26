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
