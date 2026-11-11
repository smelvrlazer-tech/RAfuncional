import { definirTema, useTema, type Tema } from '../../lib/tema'

const OPCOES: { valor: Tema; nome: string; detalhe: string; cor: string }[] = [
  { valor: 'ciano', nome: 'Ciano', detalhe: 'Identidade do Rafael', cor: '#58e0e8' },
  { valor: 'lima', nome: 'Lima', detalhe: 'Verde-lima', cor: '#a3ff29' },
]

/** Escolha da identidade visual (cor de destaque). Fica salva neste aparelho. */
export function CartaoAparencia() {
  const atual = useTema()
  return (
    <section className="cartao" aria-labelledby="titulo-aparencia">
      <h2 className="cartao__titulo" id="titulo-aparencia">Aparência</h2>
      <p className="cartao__apoio">Escolha a cor de destaque do aplicativo. Vale só neste aparelho.</p>
      <div className="aparencia" role="radiogroup" aria-label="Identidade visual">
        {OPCOES.map((o) => (
          <button key={o.valor} type="button" role="radio" aria-checked={atual === o.valor}
            className="aparencia__opcao" onClick={() => definirTema(o.valor)}>
            <span className="aparencia__amostra" style={{ background: o.cor }} aria-hidden="true" />
            <span className="aparencia__texto">
              <span className="aparencia__nome">{o.nome}</span>
              <span className="aparencia__detalhe">{o.detalhe}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
