/** Link de convite e mensagens de compartilhamento (tela Alunos). */
import { normalizarCodigo } from './texto'

export function linkConvite(origem: string, codigo: string): string {
  return `${origem.replace(/\/+$/, '')}/convite/${normalizarCodigo(codigo)}`
}

export function mensagemConvite(link: string, nome?: string | null): string {
  const primeiro = nome?.trim().split(/\s+/)[0]
  const saudacao = primeiro ? `Oi, ${primeiro}!` : 'Oi!'
  return `${saudacao} Aqui está o seu convite para o app do RA Funcional, onde você faz check-in nas aulas: ` +
    `${link} — é só abrir o link e criar sua senha.`
}

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export type EstadoConvite = 'pendente' | 'expirado' | 'usado' | 'revogado'

export function estadoConvite(c: { status: 'pendente' | 'usado' | 'revogado'; expira_em: string }, agora: Date): EstadoConvite {
  if (c.status === 'pendente' && new Date(c.expira_em).getTime() <= agora.getTime()) return 'expirado'
  return c.status
}
