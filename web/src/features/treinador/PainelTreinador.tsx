import { useAuth } from '../../auth/AuthContext'
import { Botao, Perfuracao } from '../../components/Basicos'
import { Icone } from '../../components/Icone'
import { SeloRA } from '../../components/SeloRA'

/** Placeholder: o painel do treinador é construído no próximo lote. */
export function PainelTreinador() {
  const { perfil, sair } = useAuth()
  return (
    <main className="acesso">
      <div className="acesso__cartao">
        <div className="acesso__marca">
          <SeloRA tamanho="g" />
          <h1 className="acesso__nome">Painel do treinador</h1>
          <p className="acesso__subtitulo">Olá{perfil ? `, ${perfil.nome.split(' ')[0]}` : ''}. O painel está chegando.</p>
        </div>
        <Perfuracao />
        <p className="acesso__texto">
          Em breve você vai gerenciar turmas, treinos, alunos e ver quem confirmou em cada aula por aqui.
        </p>
        <Botao variante="escuro" className="botao--largo" onClick={() => void sair()}>
          <Icone nome="sair" /> Sair da conta
        </Botao>
      </div>
    </main>
  )
}
