# RA Funcional — o que foi feito, o que falta (atualizado em 09/10/2026)

## O produto
PWA para o treinador Rafael Alvarenga: alunos fazem check-in/cancelam em aulas, com **bloqueio 1h antes**, **lista de espera FIFO**, treinos da semana liberados no sábado, **cadastro só por convite** e painel do treinador. Custo zero. Especificação completa: `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md`. Plano do backend: `docs/superpowers/plans/`.

## Stack
- `web/`: Vite + React + TypeScript, react-router, CSS puro com tokens, vite-plugin-pwa, Vitest + Testing Library.
- Backend: Supabase na nuvem (projeto DEV): Postgres, RLS, RPCs `SECURITY DEFINER`, pg_cron. Migrations 0001–0011 aplicadas.
- Regras de negócio nas RPCs: `fazer_checkin`, `cancelar_checkin`, `promover_da_espera`, `aceitar_convite`, `criar_convite`, `treinador_*`, `treinador_atualizar_turma`; view `v_agenda`.

## Já feito
- Backend completo com testes (pasta `tests/`).
- Área do aluno: agenda semanal, detalhe da aula, check-in/cancelamento com lista de espera, abas **Agenda / Minhas aulas / Perfil** (barra inferior), treino da semana.
- Cadastro por convite (`/convite/:codigo`) e login.
- Painel do treinador: Painel do dia, Sessão (confirmados, fila, remover aluno, cancelar aula), Turmas (criar/editar/desativar), Treinos (rascunho/publicar), Alunos (convidar, ativar/desativar).
- Visual **v3** (verde-petróleo + coral, Bricolage Grotesque + Archivo) aplicado; responsivo mobile/tablet/desktop.
- Seletor **"Ver como Celular / Computador"** em telas largas (`web/src/components/VisaoDispositivo.tsx`).
- Duas rodadas de refinamento de hierarquia: sinalizar só a exceção (ex.: só "Inativa"/"Rascunho" viram chip), uma ação principal por tela, formulários com nota curta, Sessão com cancelamento discreto.
- Repositório privado no GitHub (`smelvrlazer-tech/RAfuncional`).
- **Refino visual concluído (09/10/2026)**, já na máquina nova:
  - Telas do treinador conferidas em 375 px (Painel, Turmas, Treinos, Alunos, Sessão populada, diálogos e formulários): sem overflow horizontal.
  - Corrigido o cabeçalho do Painel que deslizava ao clicar em Ontem/Amanhã (`overflow: clip` nos cartões com círculos decorativos).
  - Perfil: o cartão de instalar o app só aparece quando o app ainda não está instalado; título "Instalar o app".
  - Página da aula: relógio do prazo ("Check-in fecha em 1h20" + barra) nas 3 h finais, e atalho "Próxima aula com vaga" quando a aula está lotada (`tempoParaFechar` e `proximaComVaga` em `web/src/lib/estadoSessao.ts`).
- Máquina nova configurada em 09/10/2026: repositório clonado, chaves restauradas, dependências instaladas, `tsc` limpo e 195 testes passando.

## Falta fazer
1. **Notificações push** (PWA): Edge Function + chaves VAPID + tabela `inscricoes_push`. Hoje o app só tem o "sino" interno.
2. **Publicar online** (Netlify, plano grátis) e criar o Supabase de **produção**; aplicar as migrations lá.
3. **Contas no e-mail do Rafael** e transferência de GitHub / Supabase / Netlify.
4. `scripts/limpar-maquina.ps1`: limpeza de Docker/`node_modules` com checklist que aborta se algo falhar. **Não existe ainda.** Só roda por confirmação explícita.
5. Seed (`web/scripts/seed-dev.mjs`) ainda não é idempotente para turmas.
6. Página de vendas (bônus): projeto separado, não iniciado.
7. Fora de escopo no v1: pagamentos.

## Lições e armadilhas
- Não confiar em relato de verificação: o Pedro cobrou prova visual. Detalhes em `CLAUDE.md`.
- A queixa "amador" era "sem cor, sem vida", não o layout quebrado; o caminho foi o Claude Design, não mais CSS solto.
- Testes de banco acumulam usuários `@teste.local`; rodar `scripts/limpar-usuarios-teste.mjs` quando ficarem lentos.
- O `vitest.config.ts` da raiz só inclui `tests/**/*.test.ts` (senão pega os testes de `web/` e quebra em jsdom).
- Cor coral `#E86A3A` só em texto grande; botão pequeno usa `--cor-acento-forte` (`#C94F1C`) por contraste.
- Comandos longos em segundo plano morrem no limite de tempo (o dev server já parou sozinho); reinicie se precisar.
- Cartões com círculos decorativos (`.controle`, `.cabecalho`, `.acesso__topo`) usam `overflow: clip`, não `hidden`: com `hidden` o navegador rola o cartão por dentro ao focar um botão perto da borda e o texto desliza.
- Na máquina de 09/10/2026 o PowerShell bloqueia `npm.ps1` (política de execução): use `npm.cmd` / `npx.cmd`. Sem admin não dá para instalar o 7-Zip: o `7zr.exe` portátil (https://www.7-zip.org/a/7zr.exe) abre o `segredos.7z` (`7zr x segredos.7z -o<pasta> -p<senha>`), e os três arquivos vão para os destinos listados em `scripts/restaurar-segredos.ps1`.
- A primeira rodada do Vitest numa máquina fria pode dar 1 erro e menos testes; rodar de novo costuma passar.

## Notas de memória
Copiadas em `docs/memoria/` (contas do cliente, fonte do design, limpeza da máquina, repositório). Se quiser restaurá-las como memória do Claude Code na máquina nova, copie os arquivos `ra-funcional-*.md` e o `MEMORY.md` para a pasta de memória do projeto (`~/.claude/projects/<pasta-do-projeto>/memory/`).
