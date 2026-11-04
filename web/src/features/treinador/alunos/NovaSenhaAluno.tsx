import { useState } from 'react'
import { Botao } from '../../../components/Basicos'
import { Dialogo } from '../../../components/Dialogo'
import { Icone } from '../../../components/Icone'
import { mensagemErro } from '../../../lib/erros'
import type { Perfil } from '../../../lib/tipos'
import { redefinirSenha } from './api'
import { copiarTexto } from './NovoConvite'

/** Texto pronto para mandar ao aluno pelo WhatsApp. */
export function mensagemSenhaProvisoria(nome: string, senha: string, origem: string): string {
  const primeiro = nome.split(/\s+/)[0] ?? ''
  return `Oi, ${primeiro}! Sua senha provisória do RA Funcional é: ${senha}\n\nEntre em ${origem} com o seu e-mail e essa senha. O app vai pedir para você criar uma senha nova.`
}

/**
 * Fluxo "esqueci a senha" do aluno: o professor confirma, o banco sorteia uma senha provisória e
 * ela aparece uma única vez, com botões para copiar e enviar pelo WhatsApp.
 */
export function NovaSenhaAluno({ aluno, onFechar }: { aluno: Perfil | null; onFechar: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [senha, setSenha] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  function fechar() {
    setSenha(null)
    setErro(null)
    setCopiado(false)
    onFechar()
  }

  async function gerar() {
    if (!aluno) return
    setEnviando(true)
    setErro(null)
    try {
      setSenha(await redefinirSenha(aluno.id))
    } catch (e) {
      setErro(mensagemErro(e, { treinador: true }))
    } finally {
      setEnviando(false)
    }
  }

  const mensagem = aluno && senha ? mensagemSenhaProvisoria(aluno.nome, senha, window.location.origin) : ''

  if (aluno && senha) {
    return (
      <Dialogo aberto titulo={`Senha provisória de ${aluno.nome}`} rotuloConfirmar="Concluir" rotuloCancelar="Fechar"
        onConfirmar={fechar} onFechar={fechar}>
        <p>Entregue esta senha ao aluno. Ela <strong>não será mostrada de novo</strong>, e o app vai pedir que ele crie uma senha própria no primeiro acesso.</p>
        <p className="senha-provisoria" aria-label="Senha provisória">{senha}</p>
        <div className="linha-botoes">
          <Botao variante="contorno" onClick={async () => setCopiado(await copiarTexto(mensagem))}>
            <Icone nome="copiar" /> {copiado ? 'Copiado!' : 'Copiar mensagem'}
          </Botao>
          <a className="botao botao--contorno" target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}>
            <Icone nome="mensagem" /> Enviar no WhatsApp
          </a>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo aberto={aluno !== null} titulo={aluno ? `Gerar nova senha para ${aluno.nome}?` : ''}
      rotuloConfirmar="Gerar senha provisória" onConfirmar={() => void gerar()} onFechar={fechar}
      enviando={enviando} erro={erro} perigo>
      <p>A senha atual deixa de valer e {aluno?.nome} é desconectado(a) dos aparelhos. No próximo acesso, ele(a) entra com a senha provisória e cria uma nova.</p>
    </Dialogo>
  )
}
