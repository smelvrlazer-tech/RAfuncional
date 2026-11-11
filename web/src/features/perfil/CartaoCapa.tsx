import { useState } from 'react'
import { Botao } from '../../components/Basicos'
import { enviarCapa, removerCapa, useCapa } from '../../lib/capa'
import { mensagemErro } from '../../lib/erros'

/** Só para o professor: foto de capa do estúdio, usada no fundo dos destaques do app dos alunos. */
export function CartaoCapa() {
  const url = useCapa()
  const [ocupado, setOcupado] = useState(false)
  const [retorno, setRetorno] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null)

  async function trocar(arquivo: File | undefined) {
    if (!arquivo) return
    setOcupado(true)
    setRetorno(null)
    try {
      await enviarCapa(arquivo)
      setRetorno({ tom: 'sucesso', texto: 'Foto de capa atualizada.' })
    } catch (e) {
      setRetorno({ tom: 'erro', texto: e instanceof Error && e.message === 'foto_invalida' ? 'Não consegui ler essa imagem. Tente outra foto.' : mensagemErro(e, { treinador: true }) })
    } finally {
      setOcupado(false)
    }
  }

  async function tirar() {
    setOcupado(true)
    try { await removerCapa() } catch (e) { setRetorno({ tom: 'erro', texto: mensagemErro(e, { treinador: true }) }) } finally { setOcupado(false) }
  }

  return (
    <section className="cartao" aria-labelledby="titulo-capa">
      <h2 className="cartao__titulo" id="titulo-capa">Foto de capa do estúdio</h2>
      <p className="cartao__apoio">Aparece ao fundo da próxima aula e do detalhe da aula, para os alunos. Use uma foto horizontal do treino ou do espaço.</p>
      <div className={`previa-capa sup-escura ${url ? 'capa--com-foto' : ''}`} style={url ? ({ '--capa-foto': `url("${url}")` } as React.CSSProperties) : undefined}>
        <span className="previa-capa__texto">{url ? 'Prévia da capa' : 'Nenhuma foto enviada'}</span>
      </div>
      <div className="linha-botoes linha-botoes--inicio">
        <label className="botao botao--contorno">
          {ocupado ? 'Enviando…' : url ? 'Trocar foto' : 'Enviar foto'}
          <input type="file" accept="image/*" className="sr-only" disabled={ocupado}
            onChange={(e) => { void trocar(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {url && <Botao variante="texto" onClick={() => void tirar()} disabled={ocupado}>Remover</Botao>}
      </div>
      <p className={`formulario__retorno ${retorno ? `formulario__retorno--${retorno.tom}` : ''}`} role="status" aria-live="polite">{retorno?.texto ?? ''}</p>
    </section>
  )
}
