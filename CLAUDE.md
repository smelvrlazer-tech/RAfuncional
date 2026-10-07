# RA Funcional — guia para o Claude Code

App PWA de check-in em aulas para o treinador **Rafael Alvarenga**. Desenvolvedor: Pedro. Este arquivo é lido automaticamente ao abrir o projeto; o contexto completo está em `docs/`.

**Comece por aqui:** `docs/PROJETO.md` (o que já foi feito, o que falta, decisões e lições) e `docs/ACESSOS-E-STATUS.md` (contas, links, como rodar). As notas de memória do projeto estão copiadas em `docs/memoria/` — leia antes de mexer em contas, visual ou limpeza da máquina.

## Regras do projeto
- **Custo zero** para o cliente: criação, hospedagem e operação (Supabase free, Netlify free; Vercel descartada).
- Contas de serviço (GitHub, Supabase, Netlify) devem acabar no **e-mail do Rafael**. Hoje estão na conta do Pedro (ver `docs/memoria/ra-funcional-contas-cliente.md`). Confirmar o e-mail antes de criar qualquer conta.
- **Regras de negócio vivem no Postgres** (RPCs `SECURITY DEFINER` + RLS), não no front. Mudou regra? Mexa em `supabase/migrations/`, não no React.
- **Migrations remotas:** o Pedro roda `npx supabase db push`. Não aplique migrations no banco remoto sem ele pedir.
- **Visual:** a fonte da verdade é o projeto no Claude Design (ver `docs/memoria/ra-funcional-fonte-do-design.md`). Cores e fontes só em `web/src/styles/tokens.css`. Princípio: "sinalize a exceção, não o padrão"; uma ação principal (coral) por tela/form; ações secundárias e destrutivas ficam quietas.
- **Limpeza da máquina** só no fim e só com checklist de segurança, nunca automática (`docs/memoria/ra-funcional-limpeza-maquina.md`).
- Commits em português, com o rodapé `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Como rodar
```bash
# app (a partir de web/)
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npx tsc --noEmit && npx vitest run   # 22 arquivos / 180 testes (em 07/10/2026)
npm run build
```
- Testes de banco (raiz, `npm test`) rodam contra o projeto Supabase DEV na nuvem e precisam de `.env.test`. Acumulam usuários `@teste.local`: limpe com `node scripts/limpar-usuarios-teste.mjs`.
- Segredos **não estão no git**: `.env.test`, `web/.env.local`, `web/.dev-credenciais.txt`. Peça ao Pedro, ou recrie a partir de `.env.test.example` / `web/.env.example` com as chaves do painel do Supabase.
- Supabase: `npx supabase login` e `npx supabase link` na máquina nova. Docker não é necessário (usamos o projeto DEV na nuvem).

## Como verificar telas (aprendido no caminho)
- O Pedro quer **prova visual real**, não relato. Use um navegador de verdade.
- `resize_window` da extensão do Chrome **não funciona**; para largura de celular use o painel embutido (`mcp__Claude_Browser__*`, confira `innerWidth`) ou o seletor "Ver como Celular" do próprio app (iframe de 390px).
- Faça também uma auditoria de overflow por JS (`scrollWidth` vs `innerWidth`).
- Capturas de tela da extensão às vezes saem cortadas/ladrilhadas: confie no DOM e nas medidas, não só no print.
- Em grids, itens precisam de `min-width: 0` (já aplicado em `.tela > *` e `.tela-treinador > *`).
