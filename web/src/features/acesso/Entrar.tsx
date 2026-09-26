import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Aviso, Botao, Campo } from '../../components/Basicos'
import { mensagemErro } from '../../lib/erros'
import { supabase } from '../../lib/supabase'
import { TelaAcesso } from './TelaAcesso'

export function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe seu e-mail e sua senha.')
      return
    }
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    // Sucesso: o AuthContext recebe a sessão e a rota redireciona sozinha.
    if (error) {
      setErro(mensagemErro(error))
      setEnviando(false)
    }
  }

  return (
    <TelaAcesso
      subtitulo="Seu lugar na aula, garantido"
      faixa={<Aviso>Entre com o e-mail e a senha que você cadastrou pelo convite.</Aviso>}
    >
      <form className="formulario" onSubmit={entrar} noValidate>
        <Campo rotulo="E-mail" type="email" inputMode="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha}
          onChange={(e) => setSenha(e.target.value)} required />
        <p className="formulario__retorno formulario__retorno--erro" role="alert" aria-live="assertive">{erro ?? ''}</p>
        <Botao type="submit" variante="primario" className="botao--largo" carregando={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>
      <p className="acesso__rodape">
        Ainda não tem conta? O cadastro é só por convite — <Link to="/convite">tenho um código</Link>.
      </p>
    </TelaAcesso>
  )
}
