import { describe, it, expect } from 'vitest'
import { iniciais, paragrafos, descreverVideo, normalizarCodigo, blocosDoTreino, miniaturaYoutube } from './texto'

describe('iniciais', () => {
  it('primeira e última palavra', () => {
    expect(iniciais('Ana Souza')).toBe('AS')
    expect(iniciais('ana maria de souza')).toBe('AS')
    expect(iniciais('Bruno')).toBe('B')
    expect(iniciais('  ')).toBe('?')
    expect(iniciais('Élia Ürsula')).toBe('ÉÜ')
  })
})

describe('paragrafos', () => {
  it('quebra em linhas em branco e descarta vazios', () => {
    expect(paragrafos('A\n\nB\n\n\nC')).toEqual(['A', 'B', 'C'])
    expect(paragrafos('linha 1\nlinha 2')).toEqual(['linha 1\nlinha 2'])
    expect(paragrafos('')).toEqual([])
    expect(paragrafos(null)).toEqual([])
  })
})

describe('descreverVideo', () => {
  it('reconhece plataformas comuns', () => {
    expect(descreverVideo('https://www.youtube.com/watch?v=abc')).toEqual({ plataforma: 'YouTube', seguro: true })
    expect(descreverVideo('https://youtu.be/abc')).toEqual({ plataforma: 'YouTube', seguro: true })
    expect(descreverVideo('https://www.instagram.com/reel/x')).toEqual({ plataforma: 'Instagram', seguro: true })
    expect(descreverVideo('https://drive.google.com/file/d/x')).toEqual({ plataforma: 'Google Drive', seguro: true })
    expect(descreverVideo('https://vimeo.com/1')).toEqual({ plataforma: 'vimeo.com', seguro: true })
  })

  it('rejeita esquemas perigosos ou inválidos', () => {
    expect(descreverVideo('javascript:alert(1)').seguro).toBe(false)
    expect(descreverVideo('não é url').seguro).toBe(false)
  })
})

describe('normalizarCodigo', () => {
  it('maiúsculas, sem espaços', () => {
    expect(normalizarCodigo(' cd0b 3295 9f17 ')).toBe('CD0B32959F17')
  })
})

describe('blocosDoTreino', () => {
  it('parágrafos com rótulo viram blocos com título', () => {
    const t = 'Aquecimento: 8 min de mobilidade.\n\nBloco principal (4 voltas, 40s / 20s): agachamento, remada.\n\nFinalizador: 3 min de burpees.'
    expect(blocosDoTreino(t)).toEqual([
      { titulo: 'Aquecimento', texto: '8 min de mobilidade.' },
      { titulo: 'Bloco principal (4 voltas, 40s / 20s)', texto: 'agachamento, remada.' },
      { titulo: 'Finalizador', texto: '3 min de burpees.' },
    ])
  })

  it('parágrafo sem rótulo fica sem título', () => {
    expect(blocosDoTreino('Treino livre hoje, vamos de mobilidade.')).toEqual([
      { titulo: null, texto: 'Treino livre hoje, vamos de mobilidade.' },
    ])
  })

  it('horário no começo não é título; rótulo longo demais também não', () => {
    expect(blocosDoTreino('06:00 começa o aquecimento')[0]!.titulo).toBeNull()
    const longo = `${'a'.repeat(70)}: resto`
    expect(blocosDoTreino(longo)[0]!.titulo).toBeNull()
  })

  it('texto vazio: nenhum bloco', () => {
    expect(blocosDoTreino(null)).toEqual([])
    expect(blocosDoTreino('   ')).toEqual([])
  })
})

describe('miniaturaYoutube', () => {
  const mini = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=10',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ])('reconhece %s', (url) => {
    expect(miniaturaYoutube(url)).toBe(mini)
  })

  it.each([
    'https://instagram.com/p/abc',
    'https://www.youtube.com/watch?v=curto',
    'https://youtube.com.golpe.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'nao é url',
  ])('ignora %s', (url) => {
    expect(miniaturaYoutube(url)).toBeNull()
  })
})
