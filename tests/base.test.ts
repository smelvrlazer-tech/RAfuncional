import { describe, it, expect } from 'vitest'
import { admin, criarUsuario } from './helpers/db'

describe('fundação', () => {
  it('traz o limite de bloqueio padrão de 60 minutos', async () => {
    const { data, error } = await admin.from('configuracoes')
      .select('valor').eq('chave', 'limite_bloqueio_min').single()
    expect(error).toBeNull()
    expect(data!.valor).toBe('60')
  })

  it('cria usuário autenticado com perfil de aluno', async () => {
    const aluno = await criarUsuario('aluno')
    const { data } = await admin.from('perfis').select('papel, ativo').eq('id', aluno.id).single()
    expect(data!.papel).toBe('aluno')
    expect(data!.ativo).toBe(true)
  })

  it('eh_treinador distingue os papéis', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const r1 = await treinador.cliente.rpc('eh_treinador')
    const r2 = await aluno.cliente.rpc('eh_treinador')
    expect(r1.data).toBe(true)
    expect(r2.data).toBe(false)
  })
})
