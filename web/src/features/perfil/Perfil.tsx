import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Aviso, Avatar, Botao, Campo, Perfuracao } from '../../components/Basicos'
import { Icone } from '../../components/Icone'
import { mensagemErro } from '../../lib/erros'
import { supabase } from '../../lib/supabase'
import { useInstalacao } from '../../pwa'

export function Perfil() {
  const { perfil, sessao, recarregarPerfil, sair } = useAuth()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '')
  const [salvando, setSalvando] = useState(false)
  const [retorno, setRetorno] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [saindo, setSaindo] = useState(false)
  const instalacao = useInstalacao()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!perfil) return
    if (!nome.trim()) {
      setRetorno({ tom: 'erro', texto: 'Informe seu nome.' })
      return
    }
    setSalvando(true)
    setRetorno(null)
    // Só nome e telefone são editáveis pela API (grant de coluna em 0008_rls.sql).
    const { error } = await supabase
      .from('perfis')
      .update({ nome: nome.trim(), telefone: telefone.trim() || null })
      .eq('id', perfil.id)
    setSalvando(false)
    if (error) setRetorno({ tom: 'erro', texto: mensagemErro(error) })
    else {
      setRetorno({ tom: 'sucesso', texto: 'Dados salvos.' })
      await recarregarPerfil()
    }
  }

  async function sairDaConta() {
    setSaindo(true)
    await sair()
  }

  return (
    <div className="tela">
      <header className="titulo-aba">
        <h1 className="titulo-aba__titulo">Perfil</h1>
      </header>

      <section className="cartao perfil-cartao">
        <div className="perfil-cartao__topo">
          <Avatar nome={perfil?.nome ?? ''} className="avatar--grande" />
          <div>
            <p className="perfil-cartao__nome">{perfil?.nome}</p>
            <p className="perfil-cartao__email">{sessao?.user.email}</p>
          </div>
        </div>
        {perfil && !perfil.ativo && (
          <Aviso tom="alerta" titulo="Conta desativada">
            Você não pode fazer check-in no momento. Fale com o seu treinador.
          </Aviso>
        )}
        <Perfuracao />
        <form className="formulario" onSubmit={salvar} noValidate>
          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
          <Campo
            rotulo="Telefone (opcional)"
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            autoComplete="tel"
            dica="Só o treinador vê. Usado para contato."
          />
          <Botao type="submit" variante="primario" carregando={salvando}>Salvar dados</Botao>
          <p className={`formulario__retorno ${retorno ? `formulario__retorno--${retorno.tom}` : ''}`} role="status" aria-live="polite">
            {retorno?.texto ?? ''}
          </p>
        </form>
      </section>

      {/* Já instalado é o padrão: não ocupa espaço. O cartão só aparece quando há o que fazer. */}
      {!instalacao.instalado && (
        <section className="cartao instalar">
          <h2 className="cartao__titulo">Instalar o app</h2>
          {instalacao.podeInstalar ? (
            <>
              <p>Abra o RA Funcional em tela cheia, direto da tela de início, como um aplicativo.</p>
              <Botao variante="contorno" onClick={() => void instalacao.instalar()}>
                <Icone nome="instalar" /> Instalar app
              </Botao>
            </>
          ) : instalacao.ios ? (
            <p>
              No iPhone: toque em <strong>Compartilhar</strong> <Icone nome="compartilhar" tamanho={16} /> no Safari e depois em{' '}
              <strong>Adicionar à Tela de Início</strong>. Assim o app abre em tela cheia.
            </p>
          ) : (
            <p>
              No Android (Chrome): abra o menu <strong>⋮</strong> e toque em <strong>Instalar app</strong> ou{' '}
              <strong>Adicionar à tela inicial</strong>. No iPhone, use o Safari: <strong>Compartilhar</strong> →{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          )}
        </section>
      )}

      <Botao variante="contorno" className="botao--largo" carregando={saindo} onClick={() => void sairDaConta()}>
        <Icone nome="sair" /> Sair da conta
      </Botao>
    </div>
  )
}
