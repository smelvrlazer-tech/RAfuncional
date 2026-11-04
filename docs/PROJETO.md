# RA Funcional — o que foi feito, o que falta (atualizado em 04/11/2026)

## O produto
PWA para o treinador Rafael Alvarenga: alunos reservam vaga ("check-in") e cancelam em aulas presenciais, com **bloqueio 1h antes**, **lista de espera FIFO**, treinos da semana liberados no sábado, **cadastro só por convite** e painel do treinador. Custo zero. Especificação original: `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md`. Plano do backend: `docs/superpowers/plans/`. Manual de uso (aluno e professor): `docs/manual/` (HTML + PDF).

## Stack
- `web/`: Vite + React + TypeScript, react-router, CSS puro com tokens, vite-plugin-pwa, Vitest + Testing Library.
- Backend: Supabase na nuvem (projeto DEV): Postgres, RLS, RPCs `SECURITY DEFINER`, pg_cron, Storage (bucket `avatares`). **Migrations 0001–0016 aplicadas no DEV.**
- Regras de negócio nas RPCs: `fazer_checkin`, `cancelar_checkin`, `promover_da_espera`, `aceitar_convite`, `criar_convite`, `treinador_*` (remover aluno, cancelar aula, turmas, presença, plano, aviso, senha provisória, relatório mensal), `meu_historico`, `meu_plano`, `meu_painel`, `quem_vai`, `info_estudio`, `ultimo_aviso`, `concluir_troca_senha`; view `v_agenda`.

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
1. **Publicar online** (Netlify, plano grátis) e criar o Supabase de **produção**; aplicar as migrations 0001–0016 lá (a 0014 cria o bucket de fotos; precisa de permissão no schema `storage`).
2. **Push em produção** com chaves VAPID e `PUSH_SEGREDO` novos (`docs/PUSH.md`), `VAPID_SUBJECT` com e-mail real, teste em celular real (Android e iPhone com o app instalado) e clique na notificação com o app fechado.
3. **Contas no e-mail do Rafael** e transferência de GitHub / Supabase / Netlify (confirmar o e-mail antes de criar qualquer conta).
4. **Segurança:** revogar a chave de API do Stitch e trocar a senha do GitHub, que foram coladas em conversa.
5. Testar de ponta a ponta pela tela (só a regra foi testada no banco): envio de foto pelo celular e troca obrigatória de senha; conferir o Início do professor no celular.
6. Não existe "esqueci minha senha" automático por e-mail: hoje só o professor gera senha provisória (exigiria configurar e-mail transacional).
7. `scripts/limpar-maquina.ps1` (limpeza com checklist) **não existe ainda**; só roda com confirmação explícita.
8. Página de vendas (bônus): projeto separado, não iniciado. Fora de escopo no v1: pagamentos.

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
