/**
 * Login por código de acesso. O professor não precisa de e-mail de verdade: entra com um código curto
 * (ex.: "rafael") e a senha. Por baixo, o Auth continua exigindo um e-mail, então o código vira um
 * endereço interno `<codigo>@acesso.ra-funcional.local` (que nunca recebe mensagens).
 * Quem digita um e-mail (com "@") entra normalmente.
 */
export const DOMINIO_CODIGO = 'acesso.ra-funcional.local'

export function emailDoAcesso(entrada: string): string {
  const valor = entrada.trim()
  if (valor.includes('@')) return valor
  return `${valor.toLowerCase().replace(/\s+/g, '')}@${DOMINIO_CODIGO}`
}
