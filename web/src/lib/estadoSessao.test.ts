import { describe, it, expect } from 'vitest'
import {
  estadoSessao, textoVagas, fracaoOcupada, tempoParaFechar, proximaComVaga, JANELA_PRAZO_MIN,
} from './estadoSessao'
import type { LinhaAgenda } from './tipos'

const AGORA = new Date('2026-08-04T08:00:00Z') // 05:00 em SP
const DAQUI_3H = '2026-08-04T11:00:00Z'

function linha(parcial: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    id: 's1', turma_id: 't1', turma_nome: 'Funcional Manhã',
    inicia_em: DAQUI_3H, duracao_min: 60, vagas: 10, cancelada: false, observacao: null,
    confirmados: 3, vagas_restantes: 7, na_espera: 0, bloqueada: false,
    meu_status: null, minha_posicao: null,
    treino_titulo: null, treino_descricao: null, treino_video_url: null,
    ...parcial,
  }
}

const est = (p: Partial<LinhaAgenda>, o: { ativo?: boolean; limiteMin?: number } = {}) =>
  estadoSessao(linha(p), { agora: AGORA, ...o })

describe('estadoSessao', () => {
  it('disponível: oferece check-in', () => {
    expect(est({})).toEqual({
      tom: 'disponivel', acao: 'checkin', rotulo: 'Vagas abertas', rotuloAcao: 'Fazer check-in', motivo: null,
    })
  })

  it('confirmado e liberado: pode cancelar', () => {
    expect(est({ meu_status: 'confirmado' })).toEqual({
      tom: 'confirmado', acao: 'cancelar', rotulo: 'Confirmado', rotuloAcao: 'Cancelar', motivo: null,
    })
  })

  it('confirmado e bloqueado: continua confirmado, sem cancelar, com o motivo', () => {
    expect(est({ meu_status: 'confirmado', bloqueada: true })).toEqual({
      tom: 'confirmado', acao: null, rotulo: 'Confirmado', rotuloAcao: null,
      motivo: 'Cancelamento bloqueado — faltam menos de 1h',
    })
  })

  it('na fila: mostra a posição e permite sair', () => {
    expect(est({ meu_status: 'espera', minha_posicao: 2, vagas_restantes: 0 })).toEqual({
      tom: 'espera', acao: 'sair_fila', rotulo: 'Fila de espera · Nº2', rotuloAcao: 'Sair da fila', motivo: null,
    })
  })

  it('na fila sem posição conhecida', () => {
    expect(est({ meu_status: 'espera', minha_posicao: null }).rotulo).toBe('Fila de espera')
  })

  it('na fila e bloqueada: sair continua livre, mas avisa que a fila congelou', () => {
    expect(est({ meu_status: 'espera', minha_posicao: 1, bloqueada: true, vagas_restantes: 0 })).toEqual({
      tom: 'espera', acao: 'sair_fila', rotulo: 'Fila de espera · Nº1', rotuloAcao: 'Sair da fila',
      motivo: 'A fila congelou — faltam menos de 1h para a aula',
    })
  })

  it('bloqueada sem check-in: nunca esconde o motivo', () => {
    expect(est({ bloqueada: true })).toEqual({
      tom: 'bloqueada', acao: null, rotulo: 'Bloqueado — faltam menos de 1h', rotuloAcao: null,
      motivo: 'Check-in e cancelamento fecham 1h antes da aula.',
    })
  })

  it('bloqueada e lotada sem check-in: bloqueio prevalece', () => {
    expect(est({ bloqueada: true, vagas_restantes: 0 }).tom).toBe('bloqueada')
  })

  it('lotada sem check-in: oferece lista de espera', () => {
    expect(est({ vagas_restantes: 0, confirmados: 10, na_espera: 2 })).toEqual({
      tom: 'lotada', acao: 'entrar_fila', rotulo: 'Lotada', rotuloAcao: 'Entrar na lista de espera', motivo: null,
    })
  })

  it('cancelada: sem ação e com a observação do treinador', () => {
    expect(est({ cancelada: true, observacao: 'Chuva forte' })).toEqual({
      tom: 'cancelada', acao: null, rotulo: 'Aula cancelada', rotuloAcao: null, motivo: 'Chuva forte',
    })
  })

  it('cancelada prevalece sobre confirmado e bloqueada', () => {
    const e = est({ cancelada: true, meu_status: 'confirmado', bloqueada: true })
    expect(e.tom).toBe('cancelada')
    expect(e.acao).toBeNull()
    expect(e.motivo).toBeNull()
  })

  it('aula em andamento', () => {
    const e = estadoSessao(linha({ inicia_em: '2026-08-04T07:30:00Z', bloqueada: true }), { agora: AGORA })
    expect(e).toMatchObject({ tom: 'encerrada', acao: null, rotulo: 'Aula em andamento' })
  })

  it('aula encerrada; confirmado vê que participou', () => {
    const passada = { inicia_em: '2026-08-04T06:00:00Z', bloqueada: true }
    expect(estadoSessao(linha(passada), { agora: AGORA })).toMatchObject({ tom: 'encerrada', rotulo: 'Aula encerrada' })
    expect(estadoSessao(linha({ ...passada, meu_status: 'confirmado' }), { agora: AGORA }))
      .toMatchObject({ tom: 'encerrada', rotulo: 'Aula encerrada · você estava confirmado(a)' })
  })

  it('aluno desativado: somente leitura com mensagem clara', () => {
    expect(est({}, { ativo: false })).toEqual({
      tom: 'disponivel', acao: null, rotulo: 'Vagas abertas', rotuloAcao: null,
      motivo: 'Sua conta está desativada. Fale com o seu treinador.',
    })
    expect(est({ meu_status: 'confirmado' }, { ativo: false })).toMatchObject({ tom: 'confirmado', acao: null })
    expect(est({ meu_status: 'espera', minha_posicao: 1 }, { ativo: false }).acao).toBeNull()
  })

  it('tela aberta há muito tempo: prazo passou desde a consulta, reflete bloqueio localmente', () => {
    // começa em 59 min; o servidor ainda dizia bloqueada=false quando consultou
    const e = estadoSessao(linha({ inicia_em: '2026-08-04T08:59:00Z', bloqueada: false }), { agora: AGORA })
    expect(e.tom).toBe('bloqueada')
    // 61 min antes ainda está liberada
    const l = estadoSessao(linha({ inicia_em: '2026-08-04T09:01:00Z', bloqueada: false }), { agora: AGORA })
    expect(l.tom).toBe('disponivel')
  })

  it('usa o prazo configurado no banco no texto do bloqueio', () => {
    expect(est({ bloqueada: true }, { limiteMin: 90 }).rotulo).toBe('Bloqueado — faltam menos de 1h30')
    expect(est({ bloqueada: true }, { limiteMin: 30 }).motivo).toBe('Check-in e cancelamento fecham 30 min antes da aula.')
  })
})

describe('tempoParaFechar', () => {
  const tempo = (p: Partial<LinhaAgenda>, limiteMin?: number) => tempoParaFechar(linha(p), { agora: AGORA, limiteMin })

  it('dentro da janela final: minutos restantes e fração da barra', () => {
    // aula às 08:00Z+3h, prazo 1h: fecha em 2h
    const t = tempo({})
    expect(t?.restanteMin).toBe(120)
    expect(t?.fracao).toBeCloseTo(120 / JANELA_PRAZO_MIN)
  })

  it('arredonda minutos para cima e respeita o prazo configurado', () => {
    expect(tempo({ inicia_em: '2026-08-04T09:30:30Z' }, 30)?.restanteMin).toBe(61)
    expect(tempo({ inicia_em: '2026-08-04T10:30:00Z' }, 90)?.restanteMin).toBe(60)
  })

  it('longe do prazo, depois dele, bloqueada ou cancelada: nada a mostrar', () => {
    expect(tempo({ inicia_em: '2026-08-04T13:00:00Z' })).toBeNull() // fecha em 4h
    expect(tempo({ inicia_em: '2026-08-04T08:59:00Z' })).toBeNull() // já passou
    expect(tempo({ bloqueada: true })).toBeNull()
    expect(tempo({ cancelada: true })).toBeNull()
  })
})

describe('proximaComVaga', () => {
  const atual = linha({ id: 'atual', inicia_em: '2026-08-04T11:00:00Z', vagas_restantes: 0 })
  const outra = (id: string, inicia_em: string, p: Partial<LinhaAgenda> = {}) => linha({ id, inicia_em, ...p })
  const prox = (c: LinhaAgenda[]) => proximaComVaga(c, atual, { agora: AGORA })?.id ?? null

  it('devolve a primeira aula depois da atual com vaga, mesmo desordenada', () => {
    expect(prox([outra('c', '2026-08-05T11:00:00Z'), outra('b', '2026-08-04T21:00:00Z')])).toBe('b')
  })

  it('ignora a própria aula, anteriores, lotadas, canceladas, bloqueadas e as que o aluno já tem', () => {
    expect(prox([
      atual,
      outra('antes', '2026-08-04T09:30:00Z'),
      outra('lotada', '2026-08-04T12:00:00Z', { vagas_restantes: 0 }),
      outra('cancelada', '2026-08-04T13:00:00Z', { cancelada: true }),
      outra('bloqueada', '2026-08-04T14:00:00Z', { bloqueada: true }),
      outra('minha', '2026-08-04T15:00:00Z', { meu_status: 'confirmado' }),
      outra('fila', '2026-08-04T16:00:00Z', { meu_status: 'espera' }),
      outra('ok', '2026-08-04T17:00:00Z'),
    ])).toBe('ok')
  })

  it('sem nenhuma opção: null', () => {
    expect(prox([])).toBeNull()
    expect(prox([outra('lotada', '2026-08-05T11:00:00Z', { vagas_restantes: 0 })])).toBeNull()
  })

  it('ignora aula cujo prazo já passou localmente, mesmo que o servidor ainda diga liberada', () => {
    // começa 08:59Z (agora 08:00Z, prazo 1h): já fechou
    expect(prox([outra('fechando', '2026-08-04T12:00:00Z', { inicia_em: '2026-08-04T08:59:00Z' })])).toBeNull()
  })
})

describe('textoVagas / fracaoOcupada', () => {
  it('plural, singular e lotada', () => {
    expect(textoVagas(linha({ vagas_restantes: 7 }))).toBe('7 vagas livres')
    expect(textoVagas(linha({ vagas_restantes: 1 }))).toBe('1 vaga livre')
    expect(textoVagas(linha({ vagas_restantes: 0 }))).toBe('Lotada')
  })

  it('lotada com fila informa o tamanho da fila', () => {
    expect(textoVagas(linha({ vagas_restantes: 0, na_espera: 3 }))).toBe('Lotada · 3 na fila')
  })

  it('fração ocupada entre 0 e 1', () => {
    expect(fracaoOcupada(linha({ vagas: 10, confirmados: 3 }))).toBeCloseTo(0.3)
    expect(fracaoOcupada(linha({ vagas: 10, confirmados: 12 }))).toBe(1)
    expect(fracaoOcupada(linha({ vagas: 0, confirmados: 0 }))).toBe(1)
  })
})
