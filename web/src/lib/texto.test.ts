import { describe, it, expect } from 'vitest'
import { iniciais, paragrafos, descreverVideo, normalizarCodigo } from './texto'

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
