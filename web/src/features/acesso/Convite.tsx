import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Botao, Campo, Carregando } from '../../components/Basicos'
import {
  lerConvitePendente, limparConvitePendente, salvarConvitePendente,
} from '../../lib/convitePendente'
import { codigoErro, mensagemErro } from '../../lib/erros'
import { supabase } from '../../lib/supabase'
import { normalizarCodigo } from '../../lib/texto'
import { TelaAcesso } from './TelaAcesso'

const SENHA_MINIMA = 8

async function aceitarConvite(codigo: string, nome: string, telefone: string | null): Promise<void> {
  const { error } = await supabase.rpc('aceitar_convite', {
    p_codigo: normalizarCodigo(codigo),
    p_nome: nome.trim(),
    p_telefone: telefone?.trim() || null,
  })
  // perfil_ja_existe: a conta já foi concluída (ex.: em outra aba) — segue a vida.
  if (error && codigoErro(error) !== 'perfil_ja_existe') throw error
}

interface Erros { nome?: string; email?: string; senha?: string; codigo?: string }

/**
 * Cadastro por convite (/convite/:codigo) e conclusão de cadastro para quem já tem
 * login mas ainda não tem perfil (modo `semPerfil`, usado pelo guard).
 * Fluxo: auth.signUp -> rpc('aceitar_convite'). Se o projeto exigir confirmação de
 * e-mail, o signUp não traz sessão: guardamos o convite neste aparelho e ele é
 * concluído automaticamente no primeiro login.
 */
export function Convite({ semPerfil = false }: { semPerfil?: boolean }) {
  const params = useParams()
  const { carregando, sessao, perfil, recarregarPerfil, sair } = useAuth()
  const pendente = lerConvitePendente()

  const [nome, setNome] = useState(pendente?.nome ?? '')
  const [telefone, setTelefone] = useState(pendente?.telefone ?? '')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState(normalizarCodigo(params.codigo ?? pendente?.codigo ?? ''))
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmeEmail, setConfirmeEmail] = useState<string | null>(null)
  const tentouAutomatico = useRef(false)

  const logado = sessao !== null

  async function concluir(c: string, n: string, t: string | null) {
    await aceitarConvite(c, n, t)
    limparConvitePendente()
    await recarregarPerfil() // perfil carregado: as rotas levam para a agenda
  }

  // Voltou logado (confirmou o e-mail / entrou) e há um convite guardado: conclui sozinho.
  useEffect(() => {
    if (carregando || !logado || perfil || tentouAutomatico.current) return
    const p = lerConvitePendente()
    if (!p) return
    tentouAutomatico.current = true
    setEnviando(true)
    concluir(params.codigo ? normalizarCodigo(params.codigo) : p.codigo, p.nome, p.telefone)
      .catch((e) => setErroGeral(mensagemErro(e)))
      .finally(() => setEnviando(false))
  }, [carregando, logado, perfil])

  if (carregando) return <Carregando />
  if (logado && perfil) return <Navigate to={perfil.papel === 'treinador' ? '/treinador' : '/'} replace />

  function validar(): Erros {
    const e: Erros = {}
    if (!nome.trim()) e.nome = 'Informe seu nome.'
    if (!normalizarCodigo(codigo)) e.codigo = 'Informe o código do convite.'
    if (!logado) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Informe um e-mail válido.'
      if (senha.length < SENHA_MINIMA) e.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
    }
    return e
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    const e = validar()
    setErros(e)
    setErroGeral(null)
    if (Object.keys(e).length) return
    setEnviando(true)
    const c = normalizarCodigo(codigo)
    const tel = telefone.trim() || null
    try {
      if (logado) {
        await concluir(c, nome, tel)
        return
      }
      salvarConvitePendente({ codigo: c, nome: nome.trim(), telefone: tel, email: email.trim() })
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/convite/${c}`, data: { nome: nome.trim() } },
      })
      if (error) throw error
      // Com confirmação ligada, e-mail já cadastrado volta como usuário "fantasma" sem identidades.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw { code: 'user_already_exists', message: '' }
      }
      if (data.session) {
        tentouAutomatico.current = true
        await concluir(c, nome, tel)
      } else {
        setConfirmeEmail(email.trim())
      }
    } catch (erro) {
      setErroGeral(mensagemErro(erro))
    } finally {
      setEnviando(false)
    }
  }

  if (confirmeEmail) {
    return (
      <TelaAcesso subtitulo="Falta só confirmar seu e-mail">
        <div className="confirme" role="status">
          <p className="confirme__titulo">Confira sua caixa de entrada</p>
          <p>
            Enviamos um link de confirmação para <strong>{confirmeEmail}</strong>. Abra o link e depois entre com seu
            e-mail e senha: seu convite será concluído automaticamente neste aparelho.
          </p>
          <p className="confirme__dica">Não chegou? Olhe a pasta de spam ou lixo eletrônico.</p>
        </div>
        <Link to="/entrar" className="botao botao--primario botao--largo">Ir para o login</Link>
      </TelaAcesso>
    )
  }

  const subtitulo = semPerfil ? 'Falta pouco para liberar sua agenda' : 'Você foi convidado(a) para treinar'
  const faixa = semPerfil ? (
    <Aviso titulo="Sua conta ainda não está vinculada a um convite">
      Informe o código do convite que o seu treinador enviou. Não tem um? Peça um convite ao seu treinador.
    </Aviso>
  ) : (
    <Aviso>Crie sua conta para fazer check-in nas aulas. O código do convite já vem preenchido pelo link.</Aviso>
  )

  return (
    <TelaAcesso subtitulo={subtitulo} faixa={faixa}>
      {logado && <p className="acesso__conta">Conectado como <strong>{sessao.user.email}</strong></p>}
      <form className="formulario" onSubmit={enviar} noValidate>
        <Campo rotulo="Seu nome" icone="pessoa" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)}
          erro={erros.nome} required />
        <Campo rotulo="Telefone (opcional)" icone="telefone" type="tel" inputMode="tel" autoComplete="tel" value={telefone}
          onChange={(e) => setTelefone(e.target.value)} />
        {!logado && (
          <>
            <Campo rotulo="E-mail" icone="email" type="email" inputMode="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} erro={erros.email} required />
            <Campo rotulo="Crie uma senha" icone="cadeado" type="password" autoComplete="new-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} erro={erros.senha} dica={`Mínimo de ${SENHA_MINIMA} caracteres.`}
              minLength={SENHA_MINIMA} required />
          </>
        )}
        <Campo rotulo="Código do convite" value={codigo} autoCapitalize="characters" autoComplete="off"
          spellCheck={false} className="campo__entrada campo__entrada--codigo"
          onChange={(e) => setCodigo(normalizarCodigo(e.target.value))} erro={erros.codigo} required />
        <p className="formulario__retorno formulario__retorno--erro" role="alert" aria-live="assertive">{erroGeral ?? ''}</p>
        <Botao type="submit" variante="primario" className="botao--largo" carregando={enviando}>
          {enviando ? 'Enviando…' : logado ? 'Concluir cadastro' : 'Criar minha conta'}
        </Botao>
      </form>
      <p className="acesso__rodape">
        {logado ? (
          <button type="button" className="link-botao" onClick={() => void sair()}>Sair e usar outra conta</button>
        ) : (
          <>Já tem conta? <Link to="/entrar">Entrar</Link></>
        )}
      </p>
    </TelaAcesso>
  )
}
