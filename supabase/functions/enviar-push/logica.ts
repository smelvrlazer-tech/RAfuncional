// Lógica do envio de push, sem dependência de Deno nem de bibliotecas: tudo que toca o
// mundo (banco, web-push, relógio) entra por `Dependencias`. Assim os testes (tests/
// enviar-push.test.ts) rodam no Node sem servidor nem rede.

export interface Notificacao {
  id: string
  perfil_id: string
  titulo: string
  corpo: string
  link: string | null
  criado_em: string
}

export interface Inscricao {
  id: string
  perfil_id: string
  endpoint: string
  chaves: { p256dh: string; auth: string }
}

export interface Dependencias {
  listarPendentes(limite: number): Promise<Notificacao[]>
  listarInscricoes(perfis: string[]): Promise<Inscricao[]>
  /** Lança um erro com `statusCode` (HTTP do serviço de push) quando o envio falha. */
  enviar(inscricao: Inscricao, payload: string): Promise<void>
  removerInscricoes(ids: string[]): Promise<void>
  marcarEnviadas(ids: string[]): Promise<void>
  agora(): Date
  log?(mensagem: string, detalhe?: unknown): void
}

export interface Resumo {
  /** Notificações lidas da fila neste lote. */
  pendentes: number
  /** Notificações tiradas da fila (enviadas, sem aparelho, vencidas ou rejeitadas). */
  marcadas: number
  /** Envios aceitos pelo serviço de push (um por aparelho). */
  pushes: number
  /** Inscrições apagadas por expiradas (404/410). */
  removidas: number
  /** Ficaram na fila para tentar de novo no próximo minuto. */
  adiadas: number
  /** Passaram da validade e foram marcadas sem enviar. */
  vencidas: number
}

export const LIMITE_LOTE = 100
/** "Vaga liberada" com 6 h de atraso só atrapalha: depois disso fica só no sino do app. */
export const VALIDADE_MS = 6 * 60 * 60 * 1000
export const CONCORRENCIA = 10

type Resultado = 'ok' | 'morta' | 'transitoria' | 'rejeitada'

/** 404/410: aparelho desinstalou ou revogou. 429/5xx/sem status: tentar de novo. Outros 4xx: não adianta repetir. */
export function classificarFalha(erro: unknown): Exclude<Resultado, 'ok'> {
  const status = (erro as { statusCode?: unknown } | null)?.statusCode
  if (typeof status !== 'number') return 'transitoria'
  if (status === 404 || status === 410) return 'morta'
  if (status === 429 || status >= 500) return 'transitoria'
  return 'rejeitada'
}

export function montarPayload(n: Notificacao): string {
  return JSON.stringify({ id: n.id, titulo: n.titulo, corpo: n.corpo, link: n.link ?? '/' })
}

async function emParalelo<T>(tarefas: Array<() => Promise<T>>, limite: number): Promise<T[]> {
  const resultados: T[] = new Array(tarefas.length)
  let proximo = 0
  async function trabalhador() {
    while (proximo < tarefas.length) {
      const i = proximo++
      resultados[i] = await tarefas[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, tarefas.length) }, trabalhador))
  return resultados
}

export async function processar(deps: Dependencias): Promise<Resumo> {
  const resumo: Resumo = { pendentes: 0, marcadas: 0, pushes: 0, removidas: 0, adiadas: 0, vencidas: 0 }

  const pendentes = await deps.listarPendentes(LIMITE_LOTE)
  resumo.pendentes = pendentes.length
  if (pendentes.length === 0) return resumo

  const agora = deps.agora().getTime()
  const vencida = (n: Notificacao) => agora - new Date(n.criado_em).getTime() > VALIDADE_MS
  const vivas = pendentes.filter((n) => !vencida(n))
  const marcar = new Set<string>(pendentes.filter(vencida).map((n) => n.id))
  resumo.vencidas = marcar.size

  const porPerfil = new Map<string, Inscricao[]>()
  if (vivas.length > 0) {
    const perfis = [...new Set(vivas.map((n) => n.perfil_id))]
    for (const i of await deps.listarInscricoes(perfis)) {
      porPerfil.set(i.perfil_id, [...(porPerfil.get(i.perfil_id) ?? []), i])
    }
  }

  // Um envio por (notificação, aparelho).
  const envios = vivas.flatMap((n) =>
    (porPerfil.get(n.perfil_id) ?? []).map((inscricao) => ({ n, inscricao })),
  )
  const resultados = await emParalelo(
    envios.map(({ n, inscricao }) => async (): Promise<Resultado> => {
      try {
        await deps.enviar(inscricao, montarPayload(n))
        return 'ok'
      } catch (e) {
        const tipo = classificarFalha(e)
        if (tipo !== 'morta') deps.log?.(`falha ao enviar push (${tipo})`, { endpoint: inscricao.endpoint, e })
        return tipo
      }
    }),
    CONCORRENCIA,
  )

  const porNotificacao = new Map<string, Resultado[]>()
  const mortas = new Set<string>()
  envios.forEach(({ n, inscricao }, i) => {
    porNotificacao.set(n.id, [...(porNotificacao.get(n.id) ?? []), resultados[i]])
    if (resultados[i] === 'morta') mortas.add(inscricao.id)
    if (resultados[i] === 'ok') resumo.pushes++
  })

  for (const n of vivas) {
    const r = porNotificacao.get(n.id) ?? []
    // Sem aparelho inscrito, ao menos um envio aceito ou nenhuma falha a repetir: sai da fila
    // (o sino do app é o fallback). Só fica se TODAS as tentativas falharam por motivo passageiro.
    const soTransitorias = r.length > 0 && r.every((x) => x === 'transitoria')
    if (soTransitorias) resumo.adiadas++
    else marcar.add(n.id)
  }

  if (mortas.size > 0) {
    await deps.removerInscricoes([...mortas])
    resumo.removidas = mortas.size
  }
  if (marcar.size > 0) {
    await deps.marcarEnviadas([...marcar])
    resumo.marcadas = marcar.size
  }
  return resumo
}
