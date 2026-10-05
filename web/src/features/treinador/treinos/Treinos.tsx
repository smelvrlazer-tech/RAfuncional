import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chip } from '../../../components/Chip'
import { Icone } from '../../../components/Icone'
import { chaveDiaSP, rotuloDiaLongo, somarDias } from '../../../lib/datetime'
import { diasDaSemana, formatarDataCurta, inicioSemana } from '../../../lib/semana'
import type { ConfigSpoiler } from '../../../lib/treinos'
import { useAgora } from '../../agenda/useAgenda'
import { Anuncio, Controle, EstadoLista, type Retorno } from '../comum'
import { useCarga } from '../useCarga'
import { buscarConfigSpoiler, listarTreinos } from './api'
import { FormTreino } from './FormTreino'

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/

export function Treinos() {
  const agora = useAgora()
  const hoje = chaveDiaSP(agora)
  const [params, setParams] = useSearchParams()
  const pedida = params.get('semana')
  const semana = inicioSemana(pedida && DIA_VALIDO.test(pedida) ? pedida : hoje)
  const fim = somarDias(semana, 6)
  const dias = diasDaSemana(semana, hoje)
  const { dados, erro, carregando, recarregar } = useCarga(() => listarTreinos(semana, fim), semana)
  const [config, setConfig] = useState<ConfigSpoiler>({})
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Retorno>(null)

  useEffect(() => { buscarConfigSpoiler().then(setConfig).catch(() => {}) }, [])
  useEffect(() => { setSelecionado(null) }, [semana])

  const estaSemana = inicioSemana(hoje)
  const irPara = (s: string) => { setRetorno(null); setParams(s === estaSemana ? {} : { semana: s }, { replace: true }) }
  const porData = new Map((dados ?? []).map((t) => [t.data, t]))
  const treinoSel = selecionado ? porData.get(selecionado) ?? null : null
  const rotuloSemana = semana === estaSemana ? 'Esta semana' : semana === somarDias(estaSemana, 7) ? 'Próxima semana' : null

  async function salvo(mensagem: string) {
    setRetorno({ tom: 'sucesso', texto: mensagem })
    await recarregar()
  }

  return (
    <div className="tela-treinador">
      <Controle compacto sobre="Calendário" titulo="Treinos"
        subtitulo={<>{rotuloSemana && <strong>{rotuloSemana} · </strong>}{formatarDataCurta(semana)} a {formatarDataCurta(fim)}</>}>
        <nav className="navegar-dia" aria-label="Escolher a semana">
          <button type="button" className="navegar-dia__seta" onClick={() => irPara(somarDias(semana, -7))}>
            <Icone nome="voltar" tamanho={20} /><span className="sr-only">Semana anterior</span>
          </button>
          <div className="navegar-dia__atalhos">
            <button type="button" className="navegar-dia__atalho" aria-pressed={semana === estaSemana}
              onClick={() => irPara(estaSemana)}>Esta semana</button>
            <button type="button" className="navegar-dia__atalho" aria-pressed={semana === somarDias(estaSemana, 7)}
              onClick={() => irPara(somarDias(estaSemana, 7))}>Próxima</button>
          </div>
          <button type="button" className="navegar-dia__seta" onClick={() => irPara(somarDias(semana, 7))}>
            <Icone nome="seta" tamanho={20} /><span className="sr-only">Próxima semana</span>
          </button>
        </nav>
      </Controle>

      <Anuncio retorno={retorno} />

      <EstadoLista carregando={carregando} erro={erro} vazio={dados === undefined}
        textoCarregando="Carregando os treinos da semana…" tituloErro="Não foi possível carregar os treinos"
        tituloVazio="" onTentar={() => void recarregar()}>
        <ol className="semana-treinos" aria-label={`Treinos de ${formatarDataCurta(semana)} a ${formatarDataCurta(fim)}`}>
          {dias.map((d) => {
            const t = porData.get(d.chave)
            const estado = !t ? 'vazio' : t.publicado_em ? 'publicado' : 'rascunho'
            return (
              <li key={d.chave}>
                <button type="button" aria-pressed={selecionado === d.chave}
                  className={`dia-treino dia-treino--${estado} ${d.hoje ? 'dia-treino--hoje' : ''}`}
                  onClick={() => { setRetorno(null); setSelecionado(d.chave) }}
                  aria-label={`${rotuloDiaLongo(d.chave)}${d.hoje ? ' (hoje)' : ''}: ${t ? `${t.titulo}, ${estado}` : 'sem treino, cadastrar'}`}>
                  <span className="dia-treino__dia">{d.semanaCurta} <strong>{d.numero}</strong></span>
                  <span className="dia-treino__titulo">{t?.titulo ?? 'Sem treino'}</span>
                  {t ? (
                    t.publicado_em ? null : <Chip tom="espera" icone="lapis">Rascunho</Chip>
                  ) : (
                    <span className="dia-treino__cadastrar"><Icone nome="mais" /> Cadastrar</span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </EstadoLista>

      {selecionado && dados && (
        <FormTreino key={`${selecionado}-${treinoSel?.id ?? 'novo'}-${treinoSel?.publicado_em ?? ''}`}
          data={selecionado} treino={treinoSel} agora={agora} config={config}
          onSalvo={(m) => void salvo(m)} onFechar={() => setSelecionado(null)} />
      )}
      {!selecionado && dados && (
        <p className="nota">Escolha um dia para cadastrar ou editar o treino. Um treino por dia vale para todas as turmas daquele dia.</p>
      )}
    </div>
  )
}
