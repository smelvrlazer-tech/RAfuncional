// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { publicacaoAutomatica, validarTreino, validarUrlVideo } from './treinos'

describe('validarUrlVideo', () => {
  it('vazio é permitido (vídeo é opcional)', () => {
    expect(validarUrlVideo('   ')).toEqual({ valor: null, erro: null })
  })

  it.each([
    'https://www.youtube.com/watch?v=abc',
    'http://instagram.com/p/xyz',
    '  https://drive.google.com/file/d/1  ',
  ])('aceita http(s): %s', (url) => {
    expect(validarUrlVideo(url)).toEqual({ valor: url.trim(), erro: null })
  })

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'ftp://exemplo.com/video.mp4',
    'www.youtube.com/watch?v=abc',
    'https://',
    'não é link',
  ])('rejeita %s', (url) => {
    const r = validarUrlVideo(url)
    expect(r.valor).toBeNull()
    expect(r.erro).toMatch(/http/)
  })
})

describe('validarTreino', () => {
  it('exige título e descrição e normaliza espaços', () => {
    expect(validarTreino({ titulo: ' ', descricao: '', video: '' }).erros).toEqual({
      titulo: 'Informe o título do treino.',
      descricao: 'Descreva o treino.',
    })
    const ok = validarTreino({ titulo: ' Força ', descricao: 'Linha 1\nLinha 2 ', video: '' })
    expect(ok.erros).toEqual({})
    expect(ok.dados).toEqual({ titulo: 'Força', descricao: 'Linha 1\nLinha 2', video_url: null })
  })

  it('propaga o erro do vídeo', () => {
    expect(validarTreino({ titulo: 'a', descricao: 'b', video: 'javascript:x' }).erros.video).toMatch(/http/)
  })
})

describe('publicacaoAutomatica (sábado 08:00 SP antes da semana do treino)', () => {
  it('treino da próxima semana: publica no sábado anterior às 08:00 de SP', () => {
    // hoje: quinta 24/09/2026 12:00 SP; treino na quarta 30/09 -> sábado 26/09 08:00 SP = 11:00Z
    const r = publicacaoAutomatica('2026-09-30', new Date('2026-09-24T15:00:00Z'))
    expect(r?.toISOString()).toBe('2026-09-26T11:00:00.000Z')
  })

  it('domingo pertence à semana que começou na segunda', () => {
    const r = publicacaoAutomatica('2026-10-04', new Date('2026-09-24T15:00:00Z'))
    expect(r?.toISOString()).toBe('2026-09-26T11:00:00.000Z')
  })

  it('se o sábado 08:00 já passou, não há publicação automática', () => {
    // sábado 26/09 08:30 SP: a publicação da semana 28/09 já rodou
    expect(publicacaoAutomatica('2026-09-30', new Date('2026-09-26T11:30:00Z'))).toBeNull()
    // treino desta semana
    expect(publicacaoAutomatica('2026-09-25', new Date('2026-09-24T15:00:00Z'))).toBeNull()
  })

  it('treino daqui a 3 semanas: publicado no sábado anterior àquela semana', () => {
    const r = publicacaoAutomatica('2026-10-14', new Date('2026-09-24T15:00:00Z'))
    expect(r?.toISOString()).toBe('2026-10-10T11:00:00.000Z')
  })

  it('respeita dia e hora configurados (domingo 20h)', () => {
    const r = publicacaoAutomatica('2026-09-30', new Date('2026-09-24T15:00:00Z'), { diaSemana: 0, hora: 20 })
    expect(r?.toISOString()).toBe('2026-09-27T23:00:00.000Z')
  })
})
