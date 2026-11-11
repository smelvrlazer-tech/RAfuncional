# RA Funcional — guia para o Claude Code

App PWA de check-in em aulas para o treinador **Rafael Alvarenga**. Desenvolvedor: Pedro. Este arquivo é lido automaticamente ao abrir o projeto; o contexto completo está em `docs/`.

**Comece por aqui:** `docs/OUTRA-MAQUINA.md` (se está numa máquina nova), `docs/PROJETO.md` (o que já foi feito, o que falta, decisões e lições) e `docs/ACESSOS-E-STATUS.md` (contas, links, como rodar). As notas de memória do projeto estão copiadas em `docs/memoria/` — leia antes de mexer em contas, visual ou limpeza da máquina.

## Regras do projeto
- **Custo zero** para o cliente: criação, hospedagem e operação (Supabase free, Netlify free; Vercel descartada).
- Contas de serviço (GitHub, Supabase, Netlify) devem acabar no **e-mail do Rafael**. Hoje estão na conta do Pedro (ver `docs/memoria/ra-funcional-contas-cliente.md`). Confirmar o e-mail antes de criar qualquer conta.
- **Regras de negócio vivem no Postgres** (RPCs `SECURITY DEFINER` + RLS), não no front. Mudou regra? Mexa em `supabase/migrations/`, não no React.
- **Migrations remotas:** nesta rede o `db push` não funciona; o Pedro cola o SQL no SQL Editor do Supabase. Não aplique migrations no banco remoto sem ele pedir. Estado: 0001–0016 aplicadas no DEV (ver `docs/PROJETO.md`).
- **Push:** `docs/PUSH.md` (como funciona e como ativar). Chave VAPID privada e `PUSH_SEGREDO` ficam em `supabase/functions/.env` (fora do Git) e nunca no app nem em tabela; a URL/segredo que o cron usa ficam no Vault. Secrets do Supabase são só de escrita: guarde o `.env` no `segredos.7z`.
- **Visual:** desde 16/10/2026 a fonte da verdade é o design do Google Stitch (`docs/stitch/`, "Atlético técnico") com a **identidade oficial do Rafael**: tema escuro, grafite #0F1113, chumbo #2B2F33, branco e verde-lima #A3FF29 como única cor de ação (`web/src/styles/tokens.css`). Títulos e números em Bebas Neue, texto em Inter (fontes locais @fontsource). Raios 4/8px, filetes de 1px no lugar de sombra, sem enfeites; status por texto + ícone. Logo oficial em `web/public/` (gerada por `web/scripts/processar-logo.mjs` a partir da arte do Rafael). Direção A (azul) e v3 (creme/coral) estão superadas.
- **Limpeza da máquina** só no fim e só com checklist de segurança, nunca automática (`docs/memoria/ra-funcional-limpeza-maquina.md`).
- Commits em português, com o rodapé `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Como rodar
```bash
# app (a partir de web/)
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npx tsc --noEmit && npx vitest run   # 33 arquivos / 299 testes (em 04/11/2026)
npm run build
```
- **ATENÇÃO (11/11/2026): o projeto Supabase `ra-funcional-dev` agora é o banco de PRODUÇÃO** (site em https://rafuncional.netlify.app). Os testes de banco e o `seed:dev` estão desativados de propósito (`.env.test` foi renomeado para `.env.producao`) porque apagam dados. **Nunca** recrie o `.env.test` apontando para esse projeto; crie um projeto de desenvolvimento novo primeiro. Histórico: os testes de banco (raiz, `npm test`) rodavam contra o DEV e precisavam de `.env.test`. **Apagam os dados do DEV** (turmas, sessões, check-ins): depois rode `npm run seed:dev` em `web/`. Acumulam usuários `@teste.local`: limpe com `node scripts/limpar-usuarios-teste.mjs` (ou `scripts/limpar-dev-manter-tres.mjs` para deixar só Rafael, Ana e Bruno).
- Segredos: estão em `segredos.7z` (criptografado com senha, que só o Pedro tem). Restaure com `powershell -ExecutionPolicy Bypass -File scripts/restaurar-segredos.ps1` (precisa do 7-Zip). Em texto puro **nunca** vão para o git: `.env.test`, `web/.env.local`, `web/.dev-credenciais.txt`. Ao mudar uma chave, refaça o `.7z`.
- Supabase: `npx supabase login` e `npx supabase link` na máquina nova. Docker não é necessário (usamos o projeto DEV na nuvem).

## Como verificar telas (aprendido no caminho)
- O Pedro quer **prova visual real**, não relato. Use um navegador de verdade.
- `resize_window` da extensão do Chrome **não funciona**; para largura de celular use o painel embutido (`mcp__Claude_Browser__*`, confira `innerWidth`) ou o seletor "Ver como Celular" do próprio app (iframe de 390px).
- Faça também uma auditoria de overflow por JS (`scrollWidth` vs `innerWidth`).
- Capturas de tela da extensão às vezes saem cortadas/ladrilhadas: confie no DOM e nas medidas, não só no print.
- Em grids, itens precisam de `min-width: 0` (já aplicado em `.tela > *` e `.tela-treinador > *`).
