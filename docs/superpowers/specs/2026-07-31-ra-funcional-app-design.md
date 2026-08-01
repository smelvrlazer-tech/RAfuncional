# RA Funcional — Documento de Design (v1)

**Data:** 2026-07-31
**Cliente:** Rafael Alvarenga (treinamento funcional)
**Status:** Aguardando aprovação para gerar plano de implementação
**Marca:** "RA Funcional" é nome provisório. Logo e paleta definitivos serão fornecidos pelo cliente depois.

---

## 1. Problema

Hoje a gestão das turmas é manual: treinos enviados por WhatsApp, presença controlada de cabeça ou em papel, faltas de última hora sem aviso. Isso gera três custos: tempo do Rafael fora da aula, imprevisibilidade do tamanho da turma (espaço e equipamento), e uma experiência de aluno que não sustenta o posicionamento premium do serviço.

## 2. Objetivo

Um aplicativo próprio que centralize a experiência do aluno e automatize as regras do negócio:

- **Check-in inteligente** — aluno garante presença em poucos toques.
- **Regra de bloqueio (comprometimento)** — check-in e cancelamento só até 1h antes da aula.
- **Spoiler da semana** — treinos da semana seguinte liberados automaticamente no fim de semana anterior, gerando expectativa.
- **Previsibilidade** — Rafael sabe exatamente quantos alunos terá em cada aula.

## 3. Restrições

| Restrição | Decisão |
|---|---|
| **Custo zero** | Criação, implantação e operação sem custo recorrente para o Rafael. Nenhum serviço pago, nenhum domínio pago no v1. |
| **Uso comercial** | O app serve um negócio real, então todo serviço usado precisa permitir uso comercial no plano gratuito. |
| **Plataforma** | Web App / PWA instalável. Sem lojas de aplicativo. |
| **Local** | Um único local de treino. |
| **Pagamentos** | Fora de escopo no v1. |

---

## 4. Papéis

**Aluno** — vê a agenda da semana, faz e cancela check-in, entra em lista de espera, lê o treino do dia, recebe notificações.

**Treinador** (Rafael, admin único no v1) — cadastra horários das turmas, publica os treinos, vê quem confirmou em cada aula, convida e gerencia alunos.

Não há papel de "recepcionista" ou multi-treinador no v1. O modelo de dados prevê o campo de papel, então adicionar depois não exige refazer nada.

---

## 5. Arquitetura

### 5.1 Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | **Next.js** (export estático / SPA) | Ecossistema maduro, PWA bem suportado, sem servidor próprio para manter. |
| Hospedagem | **Netlify** (free) | Free tier permite uso comercial. 100 GB de banda/mês e 300 min de build — ordens de grandeza acima do consumo previsto. Painel simples, importante porque o Rafael vai ser dono da conta. |
| Banco + Auth | **Supabase** (free) | Postgres com Row Level Security, autenticação pronta, 500 MB — sobra muito para esse caso. |
| Lógica de servidor | **Supabase Edge Functions** (free) | Envio de push e tarefas agendadas sem infraestrutura extra. |
| Agendamento | **pg_cron** (dentro do Supabase) | Nativo do Postgres, gratuito, granularidade de minutos. |
| Push | **Web Push com VAPID** | Padrão aberto do navegador, sem Firebase, sem custo. |
| Endereço | Subdomínio gratuito (`ra-funcional.netlify.app` ou similar) | Zero custo. Trocar por domínio próprio depois é uma mudança de configuração, não de código. |

**Nota sobre a mudança em relação à conversa inicial:** havia sido mencionado Vercel. O plano Hobby da Vercel restringe uso comercial nos termos de serviço, e este app atende um negócio que cobra mensalidade. Netlify e Cloudflare não têm essa restrição no plano gratuito. Netlify foi escolhida entre as duas pela simplicidade do painel, já que a conta acaba nas mãos do Rafael.

### 5.2 Risco conhecido do Supabase free

Projetos gratuitos são pausados após 7 dias sem atividade. O job diário de geração de sessões acessa o banco todo dia, o que mantém o projeto ativo. Mitigação já embutida na arquitetura.

### 5.3 Contas e propriedade (handoff)

O e-mail do Rafael ainda não foi obtido, e isso não bloqueia o desenvolvimento: o Supabase roda **localmente via CLI** durante toda a construção. Contas em nuvem só são necessárias na hora de publicar.

Quando chegar essa hora, a recomendação é criar um **e-mail dedicado ao projeto** (ex.: `rafuncional.app@gmail.com`) e usá-lo para Supabase e Netlify. Motivo: na entrega, basta repassar a senha e o Rafael vira dono de tudo, sem migração. A alternativa — criar no e-mail do desenvolvedor e transferir depois — envolve mover o projeto Supabase entre organizações e pode alterar a URL do site.

Nenhuma conta de registrador de domínio é necessária no v1.

**Versionamento:** `git init` local desde a primeira linha de código. O repositório remoto (GitHub **privado**, na conta do Rafael) é adicionado depois, quando a conta existir — `git remote add` não exige refazer nada do histórico.

### 5.4 Encerramento e limpeza da máquina de desenvolvimento

Requisito do desenvolvedor: após a entrega, nada do projeto deve continuar ocupando espaço na máquina local.

**O que realmente pesa** (e é 100% recriável):

| Item | Ordem de grandeza | Como recriar |
|---|---|---|
| Imagens e volumes Docker do Supabase local | Vários GB | `supabase start` |
| `node_modules` | Centenas de MB | `npm install` |
| Cache de build (`.next`, `dist`) | Dezenas de MB | build |
| Código-fonte | Poucos MB | `git clone` |

**Checklist de segurança — nenhuma exclusão antes de todos os itens passarem:**

1. `git status` limpo — nenhuma alteração não commitada
2. `git log origin/main..HEAD` vazio — nenhum commit local sem push
3. Repositório remoto acessível e com o conteúdo esperado
4. App publicado no ar e funcionando (login, check-in e push testados em produção)
5. Migrações do banco aplicadas no Supabase de produção e versionadas no repositório
6. Variáveis de ambiente e chaves VAPID registradas em local seguro **fora** da máquina

**Script de limpeza** (`scripts/limpar-maquina.ps1`, entregue como parte do projeto): roda as seis verificações acima e **aborta se qualquer uma falhar**. Só executa a exclusão com confirmação explícita do desenvolvedor. Em ordem: para o Supabase local e remove containers e volumes, remove as imagens Docker do Supabase, apaga `node_modules` e caches de build. A pasta do projeto só é removida por escolha explícita, e nunca antes das verificações 1–3.

O script nunca roda sozinho nem agendado — exclusão automática de diretório é risco desnecessário para economizar um comando.

**Custo de voltar atrás:** para corrigir um bug depois da limpeza, são `git clone` + `npm install` + `supabase start` — cerca de 15 minutos, quase todo em download. Nada se perde.

### 5.5 Fuso horário

Todos os horários armazenados em UTC (`timestamptz`). Toda apresentação e todo cálculo de regra de negócio usam **America/Sao_Paulo**. Isso é uma regra única e explícita para evitar bugs de horário de verão ou de aluno viajando.

---

## 6. Modelo de dados

```
perfis
  id            uuid (FK -> auth.users)
  nome          text
  telefone      text            -- opcional, contato
  papel         enum(aluno, treinador)
  ativo         boolean         -- desativar aluno sem apagar histórico
  criado_em     timestamptz

convites
  id            uuid
  codigo        text unique     -- vai na URL do convite
  nome_previsto text            -- opcional, pré-preenche o cadastro
  status        enum(pendente, usado, revogado)
  usado_por     uuid -> perfis  -- nulo até ser usado
  expira_em     timestamptz
  criado_em     timestamptz

turmas                          -- o "molde" recorrente da agenda semanal
  id            uuid
  nome          text            -- ex: "Funcional Manhã"
  dia_semana    smallint (0-6)
  hora_inicio   time            -- horário local (America/Sao_Paulo)
  duracao_min   smallint
  vagas         smallint
  ativa         boolean
  criado_em     timestamptz

sessoes                         -- ocorrência concreta de uma turma numa data
  id            uuid
  turma_id      uuid -> turmas
  inicia_em     timestamptz     -- momento exato de início
  vagas         smallint        -- copiado da turma na geração; editável pontualmente
  cancelada     boolean         -- Rafael pode cancelar uma aula específica
  observacao    text            -- ex: "aula na praça, chuva cancela"
  unique(turma_id, inicia_em)

checkins
  id            uuid
  sessao_id     uuid -> sessoes
  aluno_id      uuid -> perfis
  status        enum(confirmado, espera, cancelado)
  posicao_fila  integer         -- nulo quando confirmado; ordem FIFO na espera
  criado_em     timestamptz
  atualizado_em timestamptz
  unique(sessao_id, aluno_id)   -- um registro por aluno por sessão

treinos
  id            uuid
  data          date            -- treino é do dia, não da sessão específica
  titulo        text
  descricao     text            -- texto livre do treino
  video_url     text            -- opcional: YouTube, Instagram, Drive
  publicado_em  timestamptz     -- nulo = rascunho; regra do spoiler usa isso
  criado_em     timestamptz
  unique(data)

inscricoes_push                 -- endpoints de notificação por dispositivo
  id            uuid
  perfil_id     uuid -> perfis
  endpoint      text unique
  chaves        jsonb           -- p256dh + auth
  criado_em     timestamptz

notificacoes                    -- histórico + fallback in-app (sino)
  id            uuid
  perfil_id     uuid -> perfis
  titulo        text
  corpo         text
  link          text
  lida_em       timestamptz
  criado_em     timestamptz
```

**Decisão:** o treino é vinculado à **data**, não à sessão. Todas as turmas do mesmo dia fazem o mesmo treino — é como o funcional do Rafael funciona, e evita cadastro repetido.

---

## 7. Regras de negócio

### 7.1 Regra de bloqueio (1 hora)

A partir de **60 minutos antes do início da sessão**, o aluno não pode mais fazer check-in **nem cancelar**. A aula fica "travada".

- O limite é calculado sobre `sessoes.inicia_em`. O prazo em minutos fica em uma configuração única no banco, para o Rafael poder ajustar sem alterar código.
- A validação acontece no **servidor** (função Postgres/RPC com `SECURITY DEFINER`), nunca só no front. O front apenas reflete o estado — botão desabilitado com o motivo visível ("Bloqueado — faltam menos de 1h").
- Cancelamento bloqueado significa: quem não avisou a tempo continua contando como presença esperada. É exatamente o efeito de comprometimento que o produto quer criar.
- O Rafael, como treinador, pode remover um aluno de uma sessão a qualquer momento (exceção administrativa registrada no histórico).

### 7.2 Lista de espera

- Sessão lotada oferece "Entrar na lista de espera". A fila é **FIFO** por `posicao_fila`.
- Quando uma vaga abre (cancelamento de aluno, ou remoção pelo treinador), o primeiro da fila é **promovido automaticamente** para `confirmado`, dentro da mesma transação que liberou a vaga — sem corrida entre dois cancelamentos simultâneos.
- Promoção só ocorre enquanto a sessão **não estiver bloqueada**. Passado o limite de 1h, a fila congela e a vaga permanece aberta.
- Aluno promovido recebe push imediato: "Vaga liberada — você está confirmado na aula das 07h".
- Sair da lista de espera é livre e não sofre a regra de 1h (não ocupa vaga).

### 7.3 Spoiler da semana

- Job agendado (`pg_cron`) roda **sábado às 08:00 (America/Sao_Paulo)**, horário configurável.
- O job marca como publicados todos os treinos da semana seguinte (segunda a domingo) que já tenham conteúdo cadastrado, e dispara push para todos os alunos ativos: "Os treinos da semana já estão no ar 🔥".
- Treino sem `publicado_em` aparece para o aluno como "Em breve". O Rafael sempre vê o rascunho.
- Se o Rafael não cadastrou nada até lá, o job não notifica ninguém (nada pior que push prometendo conteúdo vazio).

### 7.4 Geração de sessões

- Job diário gera sessões para uma janela contínua de **4 semanas à frente**, a partir das turmas ativas.
- Alterar uma turma afeta apenas sessões futuras que ainda não têm check-in. Sessões com check-in existente são preservadas e sinalizadas ao Rafael.
- Desativar uma turma para de gerar novas sessões, mas não apaga as existentes.

### 7.5 Acesso

- Cadastro é **fechado**: só entra quem recebeu link de convite válido, não expirado e não usado.
- Login por e-mail e senha (Supabase Auth). Sem SMS/WhatsApp OTP — esses têm custo.
- Aluno desativado (`ativo = false`) perde acesso ao check-in mas mantém o histórico.

---

## 8. Segurança

Row Level Security ativado em todas as tabelas:

- Aluno lê seu próprio perfil, seus próprios check-ins e notificações.
- Aluno lê sessões e treinos publicados; nunca escreve diretamente em `checkins` — toda mutação passa por RPC que valida a regra de 1h, vagas e fila.
- Treinador tem acesso total via política baseada em `papel = 'treinador'`.
- Nenhum segredo (chave VAPID privada, service role key) chega ao cliente. Envio de push mora exclusivamente em Edge Function.
- Convite não usado não expõe dado de aluno nenhum.

---

## 9. Telas

### Aluno

1. **Convite / Cadastro** — abre pelo link, define nome e senha.
2. **Login**.
3. **Semana** (tela inicial) — a agenda dos próximos dias: horário, vagas restantes, e o estado do aluno naquela sessão (confirmado / em espera / disponível / bloqueado). É aqui que 90% do uso acontece.
4. **Detalhe da sessão** — treino do dia (texto + vídeo), botão de check-in ou cancelamento com o motivo quando bloqueado, contagem de vagas.
5. **Meus treinos** — histórico de presença simples, para o aluno ver a própria constância.
6. **Notificações** — sino com não lidas (fallback garantido quando o push não chega).
7. **Perfil** — dados, instalar o app, ativar notificações, sair.

### Treinador

8. **Painel do dia** — o que acontece hoje: cada aula com lista de confirmados e tamanho da fila de espera.
9. **Turmas** — criar e editar horários recorrentes e número de vagas.
10. **Treinos** — calendário semanal, cadastrar texto e link de vídeo por data, ver o que está publicado ou em rascunho.
11. **Alunos** — lista, gerar link de convite, ativar/desativar.
12. **Sessão (visão treinador)** — confirmados, fila, remover aluno, cancelar a aula com observação.

---

## 10. Notificações

**Web Push (VAPID)** como canal principal. Eventos que disparam push:

| Evento | Destinatário |
|---|---|
| Treinos da semana liberados | Todos os alunos ativos |
| Vaga liberada — promovido da lista de espera | O aluno promovido |
| Aula cancelada pelo treinador | Confirmados e fila daquela sessão |
| Lembrete de aula (opcional, fase 2) | Confirmados, ~2h antes |

**Fallback obrigatório:** toda notificação também vira registro em `notificacoes`, visível no sino dentro do app. Isso importa porque no iPhone o push só funciona se o aluno tiver adicionado o PWA à tela de início (iOS 16.4+). O onboarding vai pedir isso explicitamente, mas nem todo aluno vai fazer — e o app não pode depender disso para funcionar.

---

## 11. Identidade visual

Enquanto o Rafael não entrega logo e paleta, o app usa uma identidade **provisória e neutra**: tema escuro, uma única cor de acento, tipografia legível. Todas as cores, tipografia e raios ficam em **design tokens** (variáveis CSS em um único arquivo), para que trocar pela marca definitiva seja alterar um arquivo, não varrer componentes.

O refino visual sério acontece sobre a interface real renderizada, não sobre mockups estáticos.

---

## 12. Testes

- **Regras de negócio (prioridade máxima):** limite de 1h nas bordas (61 min, 60 min, 59 min antes), check-in em sessão lotada, promoção FIFO correta, cancelamentos simultâneos não gerando vaga dupla, promoção não ocorrendo após o bloqueio.
- **Fuso horário:** sessão às 06:00 de São Paulo permanece 06:00 independente do fuso do dispositivo.
- **Autorização:** aluno não consegue ler nem alterar check-in de outro aluno; aluno desativado não faz check-in.
- **Jobs:** geração de sessões idempotente (rodar duas vezes não duplica); publicação semanal não notifica quando não há treino.
- **PWA:** instalação e registro de push em Android e iOS.

Testes das regras críticas rodam contra um Postgres real (a lógica mora no banco), não contra mocks.

---

## 13. Fora de escopo do v1

Registrado para não se perder, e para deixar claro na proposta o que não está incluído agora:

- Pagamento, mensalidade e controle de inadimplência
- Múltiplos locais ou múltiplos treinadores
- App nativo nas lojas (App Store / Play Store)
- Domínio próprio
- Estrutura detalhada de exercícios (séries, repetições, descanso, vídeo por exercício)
- Chat aluno ↔ treinador
- Relatórios e métricas de frequência
- **Página de vendas** — é o bônus da proposta, mas é um projeto separado, com público e objetivo diferentes. Ganha seu próprio ciclo de design depois que o app estiver de pé.

---

## 14. Critérios de aceite do v1

1. Rafael cadastra os horários da semana e as vagas de cada um.
2. Rafael gera um link de convite; o aluno se cadastra por ele e não consegue se cadastrar sem convite.
3. Aluno vê a agenda da semana e faz check-in em uma aula com vaga.
4. Faltando 59 minutos para a aula, o aluno não consegue mais fazer check-in nem cancelar, e vê o motivo na tela.
5. Aluno em aula lotada entra na lista de espera e é promovido automaticamente quando alguém cancela a tempo, recebendo notificação.
6. No sábado, os treinos da semana seguinte são publicados sozinhos e os alunos são notificados.
7. Rafael abre o painel do dia e vê exatamente quem estará em cada aula.
8. O app instala na tela de início do celular e abre em tela cheia.
9. Custo total de operação: R$ 0,00.
10. Concluída a limpeza da máquina de desenvolvimento (seção 5.4), o projeto continua íntegro no repositório e no ar, e é recuperável localmente com `git clone` + `npm install` + `supabase start`.
