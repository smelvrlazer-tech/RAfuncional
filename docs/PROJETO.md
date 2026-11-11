# RA Funcional — o que foi feito, o que falta (atualizado em 11/11/2026)

## O produto
PWA para o treinador Rafael Alvarenga: alunos reservam vaga ("check-in") e cancelam em aulas presenciais, com **bloqueio 1h antes**, **lista de espera FIFO**, treinos da semana liberados no sábado, **cadastro só por convite** e painel do treinador. Custo zero. Especificação original: `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md`. Plano do backend: `docs/superpowers/plans/`. Manual de uso (aluno e professor): `docs/manual/` (HTML + PDF).

## Stack
- `web/`: Vite + React + TypeScript, react-router, CSS puro com tokens, vite-plugin-pwa, Vitest + Testing Library.
- Backend: Supabase na nuvem (projeto DEV): Postgres, RLS, RPCs `SECURITY DEFINER`, pg_cron, Storage (bucket `avatares`). **Migrations 0001–0016 aplicadas no DEV.**
- Regras de negócio nas RPCs: `fazer_checkin`, `cancelar_checkin`, `promover_da_espera`, `aceitar_convite`, `criar_convite`, `treinador_*` (remover aluno, cancelar aula, turmas, presença, plano, aviso, senha provisória, relatório mensal), `meu_historico`, `meu_plano`, `meu_painel`, `quem_vai`, `info_estudio`, `ultimo_aviso`, `concluir_troca_senha`; view `v_agenda`.

## No ar (11/11/2026)
- **Endereço:** https://rafuncional.netlify.app (Netlify, plano grátis, deploy automático a cada push na `main` do GitHub; build pelo `netlify.toml`; variáveis `VITE_*` configuradas no painel do Netlify). Conta Netlify: login Google `smelvrlazer@gmail.com` (e-mail só de infraestrutura), time "RA"; GitHub `smelvrlazer-tech` conectado.
- **Banco de produção = projeto Supabase `ra-funcional-dev`** (o plano grátis só permite 2 projetos ativos e já havia 2). **Por isso os testes de banco e o `seed:dev` estão desativados:** o `.env.test` virou `.env.producao` (fora do Git) e os scripts `limpar-*` e os testes de banco recusam rodar sem ele. Quando houver vaga, criar um projeto de desenvolvimento novo, aplicar as migrations e voltar a ter um `.env.test` apontando para ele.
- **Contas no ar:** professor Rafael por **código de acesso** `rafael` (login sem e-mail real; o e-mail interno é `rafael@acesso.ra-funcional.local`; criado por `scripts/criar-treinador.mjs`), mais as contas de demonstração Ana e Bruno (apagar antes do uso real: `scripts/limpar-producao.mjs` mantém só as contas listadas nele). As turmas que existem são de teste: o Rafael deve ajustá-las em Turmas.
- **Identidade:** ciano é o padrão (escolha do Rafael); o lima continua disponível com `?tema=lima` (e `?tema=ciano` volta). Ícone do app e favicon são do ciano.
- **Auth:** Site URL do Supabase = o endereço do Netlify. "Confirm email" precisa ficar **desligado** (o plano grátis não entrega e-mail a qualquer pessoa) para o cadastro por convite concluir sem e-mail.
- Push em produção: a Edge Function e o cron já estão no mesmo projeto; `VAPID_SUBJECT` = `mailto:smelvrlazer@gmail.com`. Falta testar em celular real (agora possível, o site é HTTPS).

## Já feito
- Backend completo com testes (pasta `tests/`, rodam contra o DEV).
- **Visual atual (16/10/2026):** design do Google Stitch com a identidade oficial do Rafael: tema escuro, verde-lima `#A3FF29`, Bebas Neue + Inter, logo oficial e ícones do PWA gerados por `web/scripts/processar-logo.mjs`. Ver regra no `CLAUDE.md`.
- **Aluno** (abas Início / Agenda / Aulas / Avisos / Perfil):
  - Início: próxima aula com coach e prazo de cancelamento, números do mês (aulas, semanas seguidas, meta do trimestre com nível Bronze/Prata/Ouro), treino e horários de hoje, recado do coach.
  - Agenda de 14 dias, detalhe da aula (treino, vídeo como link discreto, **Quem vai**), reserva/cancelamento com fila.
  - Aulas: abas Próximas / Lista de espera / Histórico, plano da semana, constância do mês (anel) e frequência.
  - Perfil: foto, dados, avisos push, instalar app, trocar senha.
  - Troca obrigatória de senha quando entra com senha provisória.
- **Professor** (menu Início / Chamada / Turmas / Treinos / Alunos / Perfil):
  - Início com números do dia, turmas de hoje, treino, gráfico de ocupação da semana e **aviso a todos os alunos**.
  - Chamada (painel do dia e aula): confirmados, fila, **Compareceu/Faltou**, remover aluno, cancelar aula.
  - Turmas, Treinos, Alunos (convite, plano por semana, ativar/desativar, **Nova senha**, **relatório mensal com no-show**), Perfil (foto).
- **Regras decididas em 16/10/2026:** "confirmado" é só a reserva; o professor marca a presença depois da aula; reserva encerrada sem marcação conta como falta (no-show). Plano = aulas por semana, só avisa (não bloqueia). Meta do trimestre = 13 × plano (39 sem plano); Bronze 50%, Prata 75%, Ouro 100%. Regras de 1h antes e promoção automática da fila não mudaram.
- **Push** implementado e testado no DEV (`docs/PUSH.md`); o aviso do professor usa o mesmo caminho (tabela `notificacoes`).
- Manual completo com capturas do visual novo em `docs/manual/` (gerado a partir das telas reais; imagens em `docs/manual/img/`).
- Repositório privado no GitHub (`smelvrlazer-tech/RAfuncional`). Suíte: front 33 arquivos / 299 testes; backend em `tests/`.
- DEV deixado só com Rafael, Ana e Bruno (`scripts/limpar-dev-manter-tres.mjs`).

## Falta fazer
1. **Desligar "Confirm email"** no Supabase (Authentication → Sign In / Providers) se ainda estiver ligado, e testar um convite de ponta a ponta no site no ar.
2. **Testar no celular real** (Android e iPhone): instalar o app, foto, troca de senha, e **push** (ativar avisos no Perfil e mandar um aviso do professor).
3. **Apagar as contas de demonstração** (Ana e Bruno) e as turmas de teste antes do uso real; o Rafael cadastra as turmas dele.
4. **Contas no e-mail do Rafael**: hoje tudo (GitHub, Supabase, Netlify) está na conta de infraestrutura do Pedro; transferir quando o Rafael tiver um e-mail dele.
5. **Segurança:** revogar a chave de API do Stitch e trocar a senha do GitHub (coladas em conversa); trocar a senha provisória do Rafael no primeiro acesso.
6. Criar um **projeto Supabase de desenvolvimento** separado quando houver vaga no plano grátis (ver acima).
7. Refazer as capturas do manual no ciano (hoje estão no lima).
8. "Esqueci minha senha" automático por e-mail (exige e-mail transacional); hoje só o professor gera senha provisória (alunos) e o Pedro redefine a do professor com `scripts/criar-treinador.mjs`.
9. Página de vendas (bônus): **próxima sessão**, projeto separado. Fora de escopo no v1: pagamentos.

## Lições e armadilhas
- Não confiar em relato de verificação: o Pedro cobra prova visual (ver `CLAUDE.md`).
- **Os testes de banco apagam os dados do DEV** (turmas, sessões, check-ins). Depois de rodar, refaça com `npm run seed:dev` (em `web/`). Usuários `@teste.local` acumulam: `node scripts/limpar-usuarios-teste.mjs`; para voltar a só Rafael/Ana/Bruno: `node scripts/limpar-dev-manter-tres.mjs`.
- Migrations remotas aplicadas pelo SQL Editor do Supabase (a rede bloqueia `db push`). Tentar aplicar de novo uma migration já aplicada dá erro "already exists": significa que ela já estava no banco.
- O `vitest.config.ts` da raiz só inclui `tests/**/*.test.ts` (senão pega os testes de `web/` e quebra em jsdom).
- Comandos longos em segundo plano morrem no limite de tempo; reinicie o dev server se precisar (`npm run dev -- --host 127.0.0.1 --port 5173` em `web/`).
- No PowerShell desta máquina, `npm.ps1` pode ser bloqueado: use `npm.cmd` / `npx.cmd`. O `7zr.exe` portátil abre o `segredos.7z` sem admin.
- A primeira rodada do Vitest numa máquina fria pode dar 1 erro por timeout; rodar de novo costuma passar.
- Para scripts que editam arquivos com CRLF, normalize as quebras de linha antes de procurar trechos.
- Capturas para o manual: `puppeteer-core` com o Chrome instalado (não precisa baixar navegador); ocultar `.visao` ("Ver como") e tornar a barra inferior estática nas capturas de página inteira.

## Notas de memória
Copiadas em `docs/memoria/` (contas do cliente, fonte do design, limpeza da máquina, repositório). Se quiser restaurá-las como memória do Claude Code na máquina nova, copie os arquivos `ra-funcional-*.md` e o `MEMORY.md` para a pasta de memória do projeto (`~/.claude/projects/<pasta-do-projeto>/memory/`).
