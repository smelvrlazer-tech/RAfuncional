import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

async function encerrar(sessaoId: string, horasAtras = 3) {
  await admin.from('sessoes').update({ inicia_em: new Date(Date.now() - horasAtras * 3_600_000).toISOString() }).eq('id', sessaoId)
}

describe('início: estúdio, quem vai, aviso e métricas', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('info_estudio devolve o nome do treinador ao aluno', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const { data, error } = await aluno.cliente.rpc('info_estudio')
    expect(error).toBeNull()
    const { data: p } = await admin.from('perfis').select('nome').eq('id', treinador.id).single()
    expect(data.treinador_nome).toBe(p!.nome)
  })

  it('quem_vai lista só os confirmados, e só para quem tem perfil', async () => {
    const a = await criarUsuario('aluno')
    const b = await criarUsuario('aluno')
    const c = await criarUsuario('aluno')
    const sessao = await criarSessao(180, 1)
    await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await b.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id }) // fila: não aparece
    const { data, error } = await c.cliente.rpc('quem_vai', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data.map((l: { aluno_id: string }) => l.aluno_id)).toEqual([a.id])
  })

  it('aviso: só o treinador envia; alunos ativos recebem notificação e veem o último aviso', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')

    const negado = await aluno.cliente.rpc('treinador_enviar_aviso', { p_texto: 'oi' })
    expect(negado.error?.code).toBe('42501')
    const vazio = await treinador.cliente.rpc('treinador_enviar_aviso', { p_texto: '   ' })
    expect(vazio.error?.message).toContain('aviso_invalido')

    const ok = await treinador.cliente.rpc('treinador_enviar_aviso', { p_texto: 'Cheguem 10 min antes!' })
    expect(ok.error).toBeNull()
    expect(ok.data.enviados).toBeGreaterThanOrEqual(1)
    const { data: notas } = await admin.from('notificacoes').select('titulo, corpo').eq('perfil_id', aluno.id)
    expect(notas!.some((n) => n.titulo === 'Aviso do treinador' && n.corpo === 'Cheguem 10 min antes!')).toBe(true)

    const { data } = await aluno.cliente.rpc('ultimo_aviso')
    expect(data.texto).toBe('Cheguem 10 min antes!')
  })

  it('meu_painel: conta presenças do mês e do trimestre, meta pelo plano e sequência de semanas', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    await treinador.cliente.rpc('treinador_definir_plano', { p_perfil_id: aluno.id, p_aulas: 2 })
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await encerrar(sessao.id)
    await treinador.cliente.rpc('treinador_marcar_presenca', { p_sessao_id: sessao.id, p_aluno_id: aluno.id, p_presenca: 'compareceu' })

    const { data, error } = await aluno.cliente.rpc('meu_painel')
    expect(error).toBeNull()
    expect(data.meta_trimestre).toBe(26)
    expect(data.plano_aulas_semana).toBe(2)
    expect(data.compareceu_trimestre).toBeGreaterThanOrEqual(1)
    expect(data.semanas_seguidas).toBeGreaterThanOrEqual(1)
  })
})
