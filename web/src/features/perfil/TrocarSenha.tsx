import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Botao, Campo } from '../../components/Basicos'
import { mensagemErro } from '../../lib/erros'
import { supabase } from '../../lib/supabase'
import { TelaAcesso } from '../acesso/TelaAcesso'

export const SENHA_MINIMA = 8

/** Mensagem de validação da nova senha, ou null se estiver tudo certo. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  if (senha !== confirmacao) return 'As duas senhas não são iguais.'
  return null
}

/** Troca a senha pelo Auth e avisa o banco que a troca obrigatória foi concluída. */
async function trocarSenha(nova: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nova })
  if (error) throw error
  const { error: erroRpc } = await supabase.rpc('concluir_troca_senha')
  if (erroRpc) throw erroRpc
}

function textoErro(e: unknown): string {
  const m = e instanceof Error ? e.message : ''
  if (/different from the old password/i.test(m)) return 'Escolha uma senha diferente da atual.'
  return mensagemErro(e)
}

function Formulario({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const problema = validarNovaSenha(senha, confirmacao)
    if (problema) { setErro(problema); return }
    setEnviando(true)
    setErro(null)
    try {
      await trocarSenha(senha)
      setSenha('')
      setConfirmacao('')
      aoConcluir()
    } catch (err) {
      setErro(textoErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <Campo rotulo="Nova senha" icone="cadeado" type="password" autoComplete="new-password" value={senha}
        onChange={(e) => setSenha(e.target.value)} dica={`Mínimo de ${SENHA_MINIMA} caracteres.`} required />
      <Campo rotulo="Repita a nova senha" icone="cadeado" type="password" autoComplete="new-password" value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)} required />
      <p className="formulario__retorno formulario__retorno--erro" role="alert">{erro ?? ''}</p>
      <Botao type="submit" variante="primario" carregando={enviando}>Salvar nova senha</Botao>
    </form>
  )
}

/** Tela cheia mostrada ao aluno que entrou com uma senha provisória: não dá para seguir sem trocar. */
export function TrocarSenhaObrigatoria() {
  const { recarregarPerfil, sair } = useAuth()
  return (
    <TelaAcesso titulo="Crie sua nova senha" subtitulo="Você entrou com uma senha provisória. Escolha uma senha só sua para continuar.">
      <Formulario aoConcluir={() => void recarregarPerfil()} />
      <Botao variante="texto" onClick={() => void sair()}>Sair</Botao>
    </TelaAcesso>
  )
}

/** Cartão do Perfil para trocar a senha quando quiser. */
export function CartaoTrocarSenha() {
  const [feito, setFeito] = useState(false)
  return (
    <section className="cartao" aria-labelledby="titulo-senha">
      <h2 className="cartao__titulo" id="titulo-senha">Trocar senha</h2>
      <Formulario aoConcluir={() => setFeito(true)} />
      {feito && <p className="formulario__retorno formulario__retorno--sucesso" role="status">Senha atualizada.</p>}
    </section>
  )
}
