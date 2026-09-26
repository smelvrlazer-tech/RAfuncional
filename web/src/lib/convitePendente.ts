/**
 * Quando o projeto exige confirmação de e-mail, o signUp não devolve sessão e
 * aceitar_convite (que precisa de auth.uid()) só pode rodar depois do primeiro login.
 * Guardamos os dados do convite neste aparelho para concluir sozinho após o login.
 */
const CHAVE = 'ra.convitePendente'

export interface ConvitePendente {
  codigo: string
  nome: string
  telefone: string | null
  email: string
}

export function salvarConvitePendente(c: ConvitePendente): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c))
  } catch {
    /* armazenamento indisponível: o aluno digita o código de novo */
  }
}

export function lerConvitePendente(): ConvitePendente | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const v = JSON.parse(bruto) as Partial<ConvitePendente>
    if (typeof v.codigo !== 'string' || typeof v.nome !== 'string') return null
    return { codigo: v.codigo, nome: v.nome, telefone: v.telefone ?? null, email: v.email ?? '' }
  } catch {
    return null
  }
}

export function limparConvitePendente(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* nada a fazer */
  }
}
