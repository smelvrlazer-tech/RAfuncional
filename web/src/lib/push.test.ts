import { describe, it, expect } from 'vitest'
import {
  chaveVapidParaBytes, estadoDosAvisos, interpretarPush, linkSeguro, TITULO_PADRAO, type Ambiente,
} from './push'

describe('linkSeguro', () => {
  it('aceita caminhos internos', () => {
    expect(linkSeguro('/sessao/abc')).toBe('/sessao/abc')
    expect(linkSeguro('/')).toBe('/')
    expect(linkSeguro('/perfil?x=1')).toBe('/perfil?x=1')
  })

  it.each([
    ['https://outro.site/x'], ['//outro.site/x'], ['/\\outro.site'], ['sessao/abc'], ['javascript:alert(1)'], [''], [null], [undefined], [42],
  ])('qualquer outra coisa abre a agenda: %s', (entrada) => {
    expect(linkSeguro(entrada)).toBe('/')
  })
})

describe('interpretarPush', () => {
  it('lê o formato enviado pela Edge Function', () => {
    expect(interpretarPush(JSON.stringify({ id: 'n1', titulo: 'Vaga liberada!', corpo: 'Você foi confirmado.', link: '/sessao/s1' })))
      .toEqual({ id: 'n1', titulo: 'Vaga liberada!', corpo: 'Você foi confirmado.', link: '/sessao/s1' })
  })

  it('sem corpo, JSON inválido ou formato estranho: aviso genérico, sem quebrar', () => {
    for (const entrada of [null, undefined, '', 'isso não é json', '"texto"', '42', 'null', '[]']) {
      const d = interpretarPush(entrada)
      expect(d.titulo).toBe(TITULO_PADRAO)
      expect(d.link).toBe('/')
      expect(d.corpo.length).toBeGreaterThan(0)
    }
  })

  it('campos faltando ou vazios caem nos padrões', () => {
    const d = interpretarPush(JSON.stringify({ titulo: '   ', corpo: 7, link: 'https://x.com' }))
    expect(d).toEqual({ id: null, titulo: TITULO_PADRAO, corpo: 'Você tem uma novidade no app.', link: '/' })
  })

  it('link externo vindo no push nunca é repassado', () => {
    expect(interpretarPush(JSON.stringify({ titulo: 'a', corpo: 'b', link: '//malicioso.com' })).link).toBe('/')
  })
})

describe('chaveVapidParaBytes', () => {
  it('converte base64url (com - e _) em bytes, com ou sem padding', () => {
    // 0xfb 0xff 0xbe -> "-_--" em base64url (e "+/++" no base64 comum)
    expect([...chaveVapidParaBytes('-_--')]).toEqual([0xfb, 0xff, 0xbe])
    expect([...chaveVapidParaBytes('AQI')]).toEqual([1, 2])
    expect([...chaveVapidParaBytes('AQI=')]).toEqual([1, 2])
  })

  it('uma chave pública VAPID tem 65 bytes e começa com 0x04', () => {
    const exemplo = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    const bytes = chaveVapidParaBytes(exemplo)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
  })
})

describe('estadoDosAvisos', () => {
  const base: Ambiente = {
    temChave: true, suportado: true, temServiceWorker: true, ios: false, instalado: false,
    permissao: 'default', temInscricao: false,
  }
  const est = (p: Partial<Ambiente>) => estadoDosAvisos({ ...base, ...p })

  it('pode ativar: permissão ainda não pedida', () => {
    expect(est({})).toBe('inativo')
  })

  it('ativo só com permissão concedida E inscrição no aparelho', () => {
    expect(est({ permissao: 'granted', temInscricao: true })).toBe('ativo')
    expect(est({ permissao: 'granted', temInscricao: false })).toBe('inativo')
    expect(est({ permissao: 'default', temInscricao: true })).toBe('inativo')
  })

  it('permissão negada: bloqueado', () => {
    expect(est({ permissao: 'denied' })).toBe('bloqueado')
    expect(est({ permissao: 'denied', temInscricao: true })).toBe('bloqueado')
  })

  it('sem chave no build: indisponível, mesmo no iPhone', () => {
    expect(est({ temChave: false })).toBe('indisponivel')
    expect(est({ temChave: false, ios: true })).toBe('indisponivel')
  })

  it('sem suporte ou sem service worker (desenvolvimento): indisponível', () => {
    expect(est({ suportado: false })).toBe('indisponivel')
    expect(est({ temServiceWorker: false })).toBe('indisponivel')
  })

  it('iPhone fora do app instalado: pede para instalar primeiro (o Safari nem expõe PushManager)', () => {
    expect(est({ ios: true, instalado: false, suportado: false, temServiceWorker: false })).toBe('instalar-ios')
  })

  it('iPhone com o app instalado segue o fluxo normal', () => {
    expect(est({ ios: true, instalado: true })).toBe('inativo')
    expect(est({ ios: true, instalado: true, permissao: 'granted', temInscricao: true })).toBe('ativo')
  })
})
