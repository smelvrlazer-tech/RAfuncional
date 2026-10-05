import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso, Botao, Campo } from '../../../components/Basicos'
import { CampoTexto } from '../../../components/Campos'
import { Dialogo } from '../../../components/Dialogo'
import { chaveDiaSP, formatarHora, rotuloDiaLongo } from '../../../lib/datetime'
import { mensagemErro } from '../../../lib/erros'
import type { Treino } from '../../../lib/tipos'
import { publicacaoAutomatica, validarTreino, type ConfigSpoiler, type ErrosTreino } from '../../../lib/treinos'
import { definirPublicacao, salvarTreino } from './api'

interface Props {
  data: string
  treino: Treino | null
  agora: Date
  config: ConfigSpoiler
  onSalvo: (mensagem: string) => void
  onFechar: () => void
}

type Envio = 'salvar' | 'publicar' | 'rascunho' | null

function quando(d: Date): string {
  return `${rotuloDiaLongo(chaveDiaSP(d)).toLowerCase()}, às ${formatarHora(d)}`
}

export function FormTreino({ data, treino, agora, config, onSalvo, onFechar }: Props) {
  const [titulo, setTitulo] = useState(treino?.titulo ?? '')
  const [descricao, setDescricao] = useState(treino?.descricao ?? '')
  const [video, setVideo] = useState(treino?.video_url ?? '')
  const [erros, setErros] = useState<ErrosTreino>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [envio, setEnvio] = useState<Envio>(null)
  const [confirmarRascunho, setConfirmarRascunho] = useState(false)
  const cabeca = useRef<HTMLHeadingElement>(null)

  useEffect(() => { cabeca.current?.focus() }, [])

  const publicado = Boolean(treino?.publicado_em)
  const auto = publicacaoAutomatica(data, agora, config)

  async function executar(tipo: Exclude<Envio, null>) {
    setErroGeral(null)
    let dados = null
    if (tipo !== 'rascunho') {
      const r = validarTreino({ titulo, descricao, video })
      setErros(r.erros)
      if (!r.dados) return
      dados = r.dados
    }
    setEnvio(tipo)
    try {
      if (tipo === 'rascunho') {
        await definirPublicacao(treino!.id, false)
        setConfirmarRascunho(false)
        onSalvo('Treino voltou para rascunho. Os alunos veem “Em breve” neste dia.')
      } else {
        await salvarTreino(treino, data, dados!, tipo === 'publicar')
        onSalvo(tipo === 'publicar'
          ? 'Treino publicado. Os alunos já podem ver (a publicação manual não envia notificação).'
          : publicado ? 'Alterações salvas. Os alunos já veem a versão nova.' : 'Rascunho salvo.')
      }
    } catch (e) {
      setErroGeral(mensagemErro(e, { treinador: true }))
    } finally {
      setEnvio(null)
    }
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    void executar('salvar')
  }

  return (
    <section className="cartao form-painel editor-treino" aria-labelledby="titulo-editor-treino">
      <div className="editor-treino__topo">
        <h2 className="cartao__titulo" id="titulo-editor-treino" ref={cabeca} tabIndex={-1}>
          {rotuloDiaLongo(data)}
        </h2>
        <Botao variante="texto" onClick={onFechar}>Fechar</Botao>
      </div>

      {publicado ? (
        <Aviso tom="sucesso" titulo={`Publicado desde ${quando(new Date(treino!.publicado_em!))}`} />
      ) : auto ? (
        <Aviso titulo={treino ? 'Rascunho' : 'Sem treino cadastrado'}>
          Os alunos veem “Em breve”. Publica sozinho em {quando(auto)}, com aviso a todos, ou use “Publicar agora” (sem notificação).
        </Aviso>
      ) : (
        <Aviso tom="alerta" titulo={treino ? 'Rascunho' : 'Sem treino cadastrado'}>
          Os alunos veem “Em breve”. A publicação automática desta semana já passou: use “Publicar agora” (sem notificação).
        </Aviso>
      )}

      <form className="formulario" onSubmit={enviar} noValidate>
        <Campo rotulo="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} erro={erros.titulo}
          maxLength={120} placeholder="Ex.: Circuito de força total" required />
        <CampoTexto rotulo="Descrição do treino" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao} rows={9} dica="Deixe uma linha em branco para separar os blocos (aquecimento, principal…)." required />
        <Campo rotulo="Link do vídeo (opcional)" type="url" inputMode="url" value={video}
          onChange={(e) => setVideo(e.target.value)} erro={erros.video} placeholder="https://www.youtube.com/…"
          dica="YouTube, Instagram ou Google Drive. Precisa começar com https://." />
        {erroGeral && <p className="formulario__retorno formulario__retorno--erro" role="alert">{erroGeral}</p>}
        <div className="form-painel__botoes">
          <Botao type="submit" variante={publicado ? 'primario' : 'contorno'} carregando={envio === 'salvar'} disabled={envio !== null}>
            {publicado ? 'Salvar alterações' : 'Salvar rascunho'}
          </Botao>
          {!publicado && (
            <Botao variante="primario" carregando={envio === 'publicar'} disabled={envio !== null}
              onClick={() => void executar('publicar')}>
              Publicar agora
            </Botao>
          )}
          {publicado && (
            <Botao variante="texto" disabled={envio !== null} onClick={() => setConfirmarRascunho(true)}>
              Voltar para rascunho
            </Botao>
          )}
        </div>
      </form>

      <Dialogo
        aberto={confirmarRascunho}
        titulo="Voltar este treino para rascunho?"
        rotuloConfirmar="Voltar para rascunho"
        onConfirmar={() => void executar('rascunho')}
        onFechar={() => setConfirmarRascunho(false)}
        enviando={envio === 'rascunho'}
        erro={confirmarRascunho ? erroGeral : null}
      >
        <p>
          Os alunos deixam de ver este treino e passam a ver “Em breve”.{' '}
          {auto
            ? `Atenção: ele será publicado de novo automaticamente em ${quando(auto)}.`
            : 'Ele não será publicado de novo automaticamente.'}
        </p>
      </Dialogo>
    </section>
  )
}
