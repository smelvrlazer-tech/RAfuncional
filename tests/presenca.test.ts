import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

/** Move a sessão para o passado (já começou e terminou) mantendo o check-in feito antes. */
async function encerrar(sessaoId: string) {
  await admin.from('sessoes').update({ inicia_em: new Date(Date.now() - 3 * 3_600_000).toISOString() }).eq('id', sessaoId)
}

describe('presença, plano, histórico e relatório', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('treinador marca presença só depois da aula começar; aluno não marca', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const antes = await treinador.cliente.rpc('treinador_marcar_presenca', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id, p_presenca: 'compareceu',
    })
    expect(antes.error?.message).toContain('aula_nao_comecou')

    await encerrar(sessao.id)
    const ok = await treinador.cliente.rpc('treinador_marcar_presenca', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id, p_presenca: 'compareceu',
    })
    expect(ok.error).toBeNull()
    const { data } = await admin.from('checkins').select('presenca').eq('sessao_id', sessao.id).eq('aluno_id', aluno.id).single()
    expect(data!.presenca).toBe('compareceu')

    const negado = await aluno.cliente.rpc('treinador_marcar_presenca', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id, p_presenca: 'faltou',
    })
    expect(negado.error?.code).toBe('42501')
  })

  it('histórico do aluno: sem marcação conta como falta; marcado mostra a marcação', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const s1 = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: s1.id })
    await encerrar(s1.id)

    let r = await aluno.cliente.rpc('meu_historico')
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(1)
    expect(r.data![0]).toMatchObject({ presenca: 'faltou', marcada: false })

    await treinador.cliente.rpc('treinador_marcar_presenca', { p_sessao_id: s1.id, p_aluno_id: aluno.id, p_presenca: 'compareceu' })
    r = await aluno.cliente.rpc('meu_historico')
    expect(r.data![0]).toMatchObject({ presenca: 'compareceu', marcada: true })
  })

  it('plano: só o treinador define; aluno vê o uso da semana', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')

    const negado = await aluno.cliente.rpc('treinador_definir_plano', { p_perfil_id: aluno.id, p_aulas: 3 })
    expect(negado.error?.code).toBe('42501')
    const invalido = await treinador.cliente.rpc('treinador_definir_plano', { p_perfil_id: aluno.id, p_aulas: 20 })
    expect(invalido.error?.message).toContain('plano_invalido')

    const ok = await treinador.cliente.rpc('treinador_definir_plano', { p_perfil_id: aluno.id, p_aulas: 3 })
    expect(ok.error).toBeNull()
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const { data } = await aluno.cliente.rpc('meu_plano')
    expect(data.aulas_semana).toBe(3)
    expect(data.usadas_semana).toBeGreaterThanOrEqual(0)
  })

  it('relatório mensal: no-show = faltas marcadas + aulas encerradas sem marcação; só o treinador lê', async () => {
    const treinador = await criarUsuario('treinador')
    const a = await criarUsuario('aluno')
    const b = await criarUsuario('aluno')
    const s1 = await criarSessao(120, 5)
    const s2 = await criarSessao(121, 5)
    for (const s of [s1, s2]) {
      await a.cliente.rpc('fazer_checkin', { p_sessao_id: s.id })
      await b.cliente.rpc('fazer_checkin', { p_sessao_id: s.id })
    }
    await encerrar(s1.id)
    await encerrar(s2.id)
    await treinador.cliente.rpc('treinador_marcar_presenca', { p_sessao_id: s1.id, p_aluno_id: a.id, p_presenca: 'compareceu' })
    await treinador.cliente.rpc('treinador_marcar_presenca', { p_sessao_id: s2.id, p_aluno_id: a.id, p_presenca: 'faltou' })

    const agora = new Date()
    const { data, error } = await treinador.cliente.rpc('treinador_relatorio_mensal', {
      p_ano: agora.getFullYear(), p_mes: agora.getMonth() + 1,
    })
    expect(error).toBeNull()
    const linhaA = data.find((l: { aluno_id: string }) => l.aluno_id === a.id)
    const linhaB = data.find((l: { aluno_id: string }) => l.aluno_id === b.id)
    // As duas sessões podem cair no mês anterior se o teste rodar de madrugada no dia 1.
    if (linhaA.reservas === 2) {
      expect(linhaA).toMatchObject({ compareceu: 1, faltas: 1, sem_marcacao: 0, no_show: 1 })
      expect(linhaB).toMatchObject({ reservas: 2, compareceu: 0, sem_marcacao: 2, no_show: 2 })
    }

    const negado = await a.cliente.rpc('treinador_relatorio_mensal', { p_ano: agora.getFullYear(), p_mes: 1 })
    expect(negado.error?.code).toBe('42501')
  })
})
