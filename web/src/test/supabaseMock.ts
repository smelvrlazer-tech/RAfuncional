/**
 * Cliente Supabase falso para testes de componente.
 * Cada `from(tabela)` registra a cadeia de métodos chamada (select, eq, update…)
 * e, ao ser aguardado, devolve o que `estado.responder` decidir para aquela chamada.
 *
 *   const h = vi.hoisted(() => ({ estado: null as unknown as EstadoMock }))
 *   vi.mock('../../lib/supabase', async () => {
 *     const m = await import('../../test/supabaseMock')
 *     h.estado = m.criarEstado()
 *     return { supabase: m.criarCliente(h.estado) }
 *   })
 */
import { vi, type Mock } from 'vitest'

export interface Resposta { data: unknown; error: unknown; count?: number | null }

export interface Chamada {
  tabela: string
  metodos: [string, unknown[]][]
  /** Argumentos da primeira chamada ao método `nome` (ou undefined). */
  args(nome: string): unknown[] | undefined
}

export interface EstadoMock {
  chamadas: Chamada[]
  responder: (c: Chamada) => Resposta
  rpc: Mock<(...a: unknown[]) => Promise<Resposta>>
}

export function criarEstado(): EstadoMock {
  return {
    chamadas: [],
    responder: () => ({ data: [], error: null }),
    rpc: vi.fn(async (..._a: unknown[]): Promise<Resposta> => ({ data: null, error: null })),
  }
}

export function criarCliente(estado: EstadoMock) {
  function from(tabela: string) {
    const c: Chamada = {
      tabela,
      metodos: [],
      args(nome) { return this.metodos.find(([m]) => m === nome)?.[1] },
    }
    estado.chamadas.push(c)
    const builder: unknown = new Proxy({}, {
      get(_alvo, prop) {
        if (prop === 'then') {
          return (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
            Promise.resolve().then(() => estado.responder(c)).then(ok, falha)
        }
        return (...args: unknown[]) => {
          c.metodos.push([String(prop), args])
          return builder
        }
      },
    })
    return builder
  }
  return {
    from,
    rpc: (...a: unknown[]) => estado.rpc(...a),
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  }
}
