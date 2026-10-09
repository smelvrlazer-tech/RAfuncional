import { useAvisos } from '../../avisos'
import { Aviso, Botao } from '../../components/Basicos'
import { Icone } from '../../components/Icone'

/**
 * Avisos no celular (Web Push). Só aparece quando há algo a fazer ou a saber: sem suporte ou sem
 * chave no build não ocupa espaço, e o sino do app segue como canal garantido.
 */
export function CartaoAvisos() {
  const { estado, erro, trabalhando, ativar, desativar } = useAvisos()

  if (estado === 'carregando' || estado === 'indisponivel') return null

  return (
    <section className="cartao instalar avisos" aria-labelledby="avisos-titulo">
      <h2 className="cartao__titulo" id="avisos-titulo">Avisos no celular</h2>

      {estado === 'instalar-ios' && (
        <p>No iPhone, primeiro adicione o app à tela de início (veja abaixo). Depois você poderá ativar os avisos aqui.</p>
      )}

      {estado === 'bloqueado' && (
        <p>Os avisos estão bloqueados neste navegador. Libere as notificações nas configurações do site para receber.</p>
      )}

      {estado === 'inativo' && (
        <>
          <p>Receba um aviso quando abrir uma vaga na lista de espera, quando uma aula for cancelada e quando os treinos da semana saírem.</p>
          <Botao variante="contorno" carregando={trabalhando} onClick={() => void ativar()}>
            <Icone nome="sino" /> Ativar avisos
          </Botao>
        </>
      )}

      {estado === 'ativo' && (
        <>
          <p>Ativados neste aparelho.</p>
          <Botao variante="texto" carregando={trabalhando} onClick={() => void desativar()}>Desativar</Botao>
        </>
      )}

      {erro && <Aviso tom="erro" role="alert">{erro}</Aviso>}
    </section>
  )
}
