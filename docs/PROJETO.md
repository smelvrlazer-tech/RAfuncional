# RA Funcional — o que foi feito, o que falta (atualizado em 07/10/2026)

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

## Falta fazer
1. **Notificações push** (PWA): Edge Function + chaves VAPID + tabela `inscricoes_push`. Hoje o app só tem o "sino" interno.
2. **Publicar online** (Netlify, plano grátis) e criar o Supabase de **produção**; aplicar as migrations lá.
3. **Contas no e-mail do Rafael** e transferência de GitHub / Supabase / Netlify.
4. `scripts/limpar-maquina.ps1`: limpeza de Docker/`node_modules` com checklist que aborta se algo falhar. **Não existe ainda.** Só roda por confirmação explícita.
5. Refino visual que sobrou: texto "App na tela de início" no Perfil; conferir telas do treinador no celular depois das últimas mudanças; Sessão do treinador só foi vista em tela larga.
6. Itens opcionais da v3: barra de tempo "Check-in encerrado" e "próxima aula com vaga".
7. Seed (`web/scripts/seed-dev.mjs`) ainda não é idempotente para turmas.
8. Página de vendas (bônus): projeto separado, não iniciado.
9. Fora de escopo no v1: pagamentos.

## Lições e armadilhas
- Não confiar em relato de verificação: o Pedro cobrou prova visual. Detalhes em `CLAUDE.md`.
- A queixa "amador" era "sem cor, sem vida", não o layout quebrado; o caminho foi o Claude Design, não mais CSS solto.
- Testes de banco acumulam usuários `@teste.local`; rodar `scripts/limpar-usuarios-teste.mjs` quando ficarem lentos.
- O `vitest.config.ts` da raiz só inclui `tests/**/*.test.ts` (senão pega os testes de `web/` e quebra em jsdom).
- Cor coral `#E86A3A` só em texto grande; botão pequeno usa `--cor-acento-forte` (`#C94F1C`) por contraste.
- Comandos longos em segundo plano morrem no limite de tempo (o dev server já parou sozinho); reinicie se precisar.

## Notas de memória
Copiadas em `docs/memoria/` (contas do cliente, fonte do design, limpeza da máquina, repositório). Se quiser restaurá-las como memória do Claude Code na máquina nova, copie os arquivos `ra-funcional-*.md` e o `MEMORY.md` para a pasta de memória do projeto (`~/.claude/projects/<pasta-do-projeto>/memory/`).
