// Edge Function enviar-push (Deno): drena a fila `notificacoes` (enviado_push_em is null) e
// envia por Web Push (VAPID). Chamada a cada minuto pelo pg_cron (migration 0012), só quando há
// pendência. A decisão do que enviar, repetir ou descartar mora em ./logica.ts (testada em
// tests/enviar-push.test.ts); aqui só ligamos o banco e o web-push a ela.
//
// Autenticação: verify_jwt = false (supabase/config.toml) e um segredo compartilhado no header
// `x-push-segredo`, o mesmo guardado no Vault do banco (push_segredo). Assim nenhuma chave do
// Supabase precisa ser copiada para dentro do banco.
//
// Segredos (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// PUSH_SEGREDO. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm injetados pelo Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { LIMITE_LOTE, processar, VALIDADE_MS, type Dependencias, type Inscricao, type Notificacao } from './logica.ts'

function iguais(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diferenca = 0
  for (let i = 0; i < ea.length; i++) diferenca |= ea[i] ^ eb[i]
  return diferenca === 0
}

function exigir(nome: string): string {
  const valor = Deno.env.get(nome)
  if (!valor) throw new Error(`variável ${nome} não configurada`)
  return valor
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método não permitido', { status: 405 })

  let segredo: string
  try {
    segredo = exigir('PUSH_SEGREDO')
  } catch (e) {
    console.error(String(e))
    return Response.json({ erro: 'função não configurada' }, { status: 500 })
  }
  if (!iguais(req.headers.get('x-push-segredo') ?? '', segredo)) {
    return new Response('não autorizado', { status: 401 })
  }

  try {
    webpush.setVapidDetails(exigir('VAPID_SUBJECT'), exigir('VAPID_PUBLIC_KEY'), exigir('VAPID_PRIVATE_KEY'))
    const supabase = createClient(exigir('SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    })

    const deps: Dependencias = {
      async listarPendentes(limite = LIMITE_LOTE) {
        const { data, error } = await supabase
          .from('notificacoes')
          .select('id, perfil_id, titulo, corpo, link, criado_em')
          .is('enviado_push_em', null)
          .order('criado_em', { ascending: true })
          .limit(limite)
        if (error) throw error
        return (data ?? []) as Notificacao[]
      },
      async listarInscricoes(perfis) {
        const { data, error } = await supabase
          .from('inscricoes_push')
          .select('id, perfil_id, endpoint, chaves')
          .in('perfil_id', perfis)
        if (error) throw error
        return (data ?? []) as Inscricao[]
      },
      async enviar(inscricao, payload) {
        await webpush.sendNotification(
          { endpoint: inscricao.endpoint, keys: inscricao.chaves },
          payload,
          { TTL: Math.floor(VALIDADE_MS / 1000), urgency: 'high' },
        )
      },
      async removerInscricoes(ids) {
        const { error } = await supabase.from('inscricoes_push').delete().in('id', ids)
        if (error) throw error
      },
      async marcarEnviadas(ids) {
        const { error } = await supabase.rpc('marcar_push_enviado', { p_ids: ids })
        if (error) throw error
      },
      agora: () => new Date(),
      log: (mensagem, detalhe) => console.error(mensagem, detalhe),
    }

    return Response.json(await processar(deps))
  } catch (e) {
    console.error('falha no envio de push', e)
    return Response.json({ erro: 'falha no envio' }, { status: 500 })
  }
})
