import { describe, it, expect } from 'vitest'
import { admin, criarUsuario, clienteAnonimo } from './helpers/db'

interface Job {
  jobname: string
  schedule: string
  command: string
  active: boolean
  username: string
}

interface EstadoCron {
  jobs: Job[]
  privilegios: Record<string, boolean>
}

async function estadoCron(): Promise<EstadoCron> {
  const { data, error } = await admin.rpc('debug_cron_jobs')
  if (error) throw error
  return data as EstadoCron
}

/** Normaliza espaços e caixa para comparar o comando SQL do job. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

describe('agendamentos pg_cron', () => {
  it('gerar-sessoes roda todo dia 06:00 UTC (03:00 em São Paulo)', async () => {
    const { jobs } = await estadoCron()
    const job = jobs.filter(j => j.jobname === 'gerar-sessoes')
    expect(job).toHaveLength(1)
    expect(job[0].schedule).toBe('0 6 * * *')
    expect(norm(job[0].command)).toBe('select public.gerar_sessoes();')
    expect(job[0].active).toBe(true)
  })

  it('publicar-treinos roda de hora em hora, sem argumento (vale o relógio do banco)', async () => {
    const { jobs } = await estadoCron()
    const job = jobs.filter(j => j.jobname === 'publicar-treinos')
    expect(job).toHaveLength(1)
    expect(job[0].schedule).toBe('0 * * * *')
    expect(norm(job[0].command)).toBe('select public.publicar_treinos_semana();')
    expect(job[0].active).toBe(true)
  })

  it('não há jobs duplicados nem outro job chamando as mesmas funções', async () => {
    const { jobs } = await estadoCron()
    const nomes = jobs.map(j => j.jobname)
    expect(new Set(nomes).size).toBe(nomes.length)

    const chamamGerar = jobs.filter(j => /gerar_sessoes/i.test(j.command))
    const chamamPublicar = jobs.filter(j => /publicar_treinos_semana/i.test(j.command))
    expect(chamamGerar.map(j => j.jobname)).toEqual(['gerar-sessoes'])
    expect(chamamPublicar.map(j => j.jobname)).toEqual(['publicar-treinos'])
  })

  it('os jobs rodam como o dono das funções, que ainda pode executá-las', async () => {
    const { jobs, privilegios } = await estadoCron()
    const donos = new Set(
      jobs.filter(j => ['gerar-sessoes', 'publicar-treinos'].includes(j.jobname)).map(j => j.username),
    )
    expect([...donos]).toEqual(['postgres'])
    // EXECUTE foi revogado de public/anon/authenticated, mas não do dono.
    expect(privilegios.dono_jobs_executa_gerar_sessoes).toBe(true)
    expect(privilegios.dono_jobs_executa_publicar_treinos).toBe(true)
  })

  // ---------------------------------------------------------------- exposição do schema cron

  it('anon e authenticated não têm USAGE no schema cron', async () => {
    const { privilegios } = await estadoCron()
    expect(privilegios.anon_usa_cron).toBe(false)
    expect(privilegios.authenticated_usa_cron).toBe(false)
  })

  // PGRST106: o PostgREST recusa o schema antes de chegar ao Postgres.
  it('anon não lê cron.job pela API', async () => {
    const { data, error } = await clienteAnonimo().schema('cron').from('job').select('*')
    expect(error?.code).toBe('PGRST106')
    expect(data).toBeNull()
  })

  it('aluno e treinador não leem cron.job nem cron.job_run_details pela API', async () => {
    for (const papel of ['aluno', 'treinador'] as const) {
      const u = await criarUsuario(papel)
      for (const tabela of ['job', 'job_run_details']) {
        const { data, error } = await u.cliente.schema('cron').from(tabela).select('*')
        expect(error?.code).toBe('PGRST106')
        expect(data).toBeNull()
      }
    }
  })

  it('ninguém agenda job pela API (cron.schedule não é alcançável)', async () => {
    const aluno = await criarUsuario('aluno')
    const args = { job_name: 'invasor', schedule: '* * * * *', command: 'select 1' }

    const viaCron = await aluno.cliente.schema('cron').rpc('schedule', args)
    expect(viaCron.error?.code).toBe('PGRST106')
    const viaPublic = await aluno.cliente.rpc('schedule', args)
    expect(viaPublic.error).not.toBeNull()

    const { jobs } = await estadoCron()
    expect(jobs.some(j => j.jobname === 'invasor')).toBe(false)
  })

  // "permission denied" (e não "função não encontrada"): prova que ela existe e foi revogada.
  it('debug_cron_jobs é só do service_role', async () => {
    const anon = await clienteAnonimo().rpc('debug_cron_jobs')
    expect(anon.error?.message).toMatch(/permission denied/i)
    expect(anon.data).toBeNull()

    for (const papel of ['aluno', 'treinador'] as const) {
      const u = await criarUsuario(papel)
      const r = await u.cliente.rpc('debug_cron_jobs')
      expect(r.error?.message).toMatch(/permission denied/i)
      expect(r.data).toBeNull()
    }
  })
})
