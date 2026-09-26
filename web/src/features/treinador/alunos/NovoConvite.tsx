import { useId, useState, type FormEvent } from 'react'
import { Botao, Campo } from '../../../components/Basicos'
import { Icone } from '../../../components/Icone'
import { linkConvite, linkWhatsApp, mensagemConvite } from '../../../lib/convite'
import { mensagemErro } from '../../../lib/erros'
import { Anuncio, type Retorno } from '../comum'
import { criarConvite } from './api'

/** Copia para a área de transferência (true se conseguiu). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

interface Gerado { link: string; mensagem: string }

export function NovoConvite({ onCriado }: { onCriado: () => void }) {
  const id = useId()
  const [nome, setNome] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [gerado, setGerado] = useState<Gerado | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function gerar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setRetorno(null)
    try {
      const codigo = await criarConvite(nome.trim() || null)
      const link = linkConvite(window.location.origin, codigo)
      setGerado({ link, mensagem: mensagemConvite(link, nome) })
      setRetorno({ tom: 'sucesso', texto: 'Link de convite gerado. Envie para o aluno.' })
      setNome('')
      onCriado()
    } catch (err) {
      setRetorno({ tom: 'erro', texto: mensagemErro(err, { treinador: true }) })
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    if (!gerado) return
    const ok = await copiarTexto(gerado.link)
    setRetorno(ok
      ? { tom: 'sucesso', texto: 'Link copiado.' }
      : { tom: 'erro', texto: 'Não foi possível copiar. Selecione o link no campo e copie manualmente.' })
  }

  async function compartilhar() {
    if (!gerado) return
    try {
      await navigator.share({ title: 'Convite RA Funcional', text: gerado.mensagem })
    } catch {
      // Cancelado pelo usuário: nada a fazer.
    }
  }

  return (
    <section className="cartao novo-convite" aria-labelledby={`${id}-titulo`}>
      <h2 className="cartao__titulo" id={`${id}-titulo`}>Convidar aluno</h2>
      <form className="formulario" onSubmit={gerar} noValidate>
        <Campo rotulo="Nome do aluno (opcional)" value={nome} onChange={(e) => setNome(e.target.value)}
          maxLength={80} dica="Ajuda você a identificar o convite na lista e personaliza a mensagem." />
        <Botao type="submit" variante="escuro" carregando={enviando}><Icone nome="mais" /> Gerar link de convite</Botao>
      </form>

      {gerado && (
        <div className="convite-gerado">
          <label className="campo__rotulo" htmlFor={`${id}-link`}>Link do convite</label>
          <input id={`${id}-link`} className="campo__entrada convite-gerado__link" readOnly value={gerado.link}
            onFocus={(e) => e.currentTarget.select()} />
          <div className="convite-gerado__botoes">
            <Botao variante="contorno" onClick={() => void copiar()}><Icone nome="copiar" /> Copiar link</Botao>
            {podeCompartilhar && (
              <Botao variante="contorno" onClick={() => void compartilhar()}><Icone nome="compartilhar" /> Compartilhar</Botao>
            )}
            <a className="botao botao--contorno" href={linkWhatsApp(gerado.mensagem)} target="_blank" rel="noopener noreferrer">
              <Icone nome="mensagem" /> <span>Enviar no WhatsApp <span className="sr-only">(abre em nova aba)</span></span>
            </a>
          </div>
          <p className="nota">Vale por 30 dias e pode ser usado uma única vez.</p>
        </div>
      )}
      <Anuncio retorno={retorno} />
    </section>
  )
}
