# RA Funcional — guia para o Claude Code

App PWA de check-in em aulas para o treinador **Rafael Alvarenga**. Desenvolvedor: Pedro. Este arquivo é lido automaticamente ao abrir o projeto; o contexto completo está em `docs/`.

**Comece por aqui:** `docs/OUTRA-MAQUINA.md` (se está numa máquina nova), `docs/PROJETO.md` (o que já foi feito, o que falta, decisões e lições) e `docs/ACESSOS-E-STATUS.md` (contas, links, como rodar). As notas de memória do projeto estão copiadas em `docs/memoria/` — leia antes de mexer em contas, visual ou limpeza da máquina.

## Regras do projeto
- **Custo zero** para o cliente: criação, hospedagem e operação (Supabase free, Netlify free; Vercel descartada).
- Contas de serviço (GitHub, Supabase, Netlify) devem acabar no **e-mail do Rafael**. Hoje estão na conta do Pedro (ver `docs/memoria/ra-funcional-contas-cliente.md`). Confirmar o e-mail antes de criar qualquer conta.
- **Regras de negócio vivem no Postgres** (RPCs `SECURITY DEFINER` + RLS), não no front. Mudou regra? Mexa em `supabase/migrations/`, não no React.
- **Migrations remotas:** o Pedro roda `npx supabase db push`. Não aplique migrations no banco remoto sem ele pedir.
- **Push:** `docs/PUSH.md` (como funciona e como ativar). Chave VAPID privada e `PUSH_SEGREDO` ficam em `supabase/functions/.env` (fora do Git) e nunca no app nem em tabela; a URL/segredo que o cron usa ficam no Vault. Secrets do Supabase são só de escrita: guarde o `.env` no `segredos.7z`.
- **Visual:** desde 15/10/2026 a fonte da verdade é a auditoria aprovada em `docs/auditoria-ui/` (direção A "Quadro de treino": branco, preto e azul de ação; títulos e números em Barlow Condensed, texto em Public Sans). A paleta é provisória até chegar a identidade do Rafael: troca-se só os valores em `web/src/styles/tokens.css`. O visual v3 do Claude Design (verde/coral sobre creme) foi rejeitado por parecer gerado. Princípios: "sinalize a exceção, não o padrão"; uma ação principal (azul) por tela/form; ações secundárias e destrutivas quietas; sem enfeites (círculos, picotes, rótulos em maiúsculas sobre títulos); superfícies com filete, não sombra; escala de 6 tamanhos (`--t-*`).
- **Limpeza da máquina** só no fim e só com checklist de segurança, nunca automática (`docs/memoria/ra-funcional-limpeza-maquina.md`).
- Commits em português, com o rodapé `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Como rodar
```bash
# app (a partir de web/)
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npx tsc --noEmit && npx vitest run   # 27 arquivos / 248 testes (em 09/10/2026)
npm run build
```
- Testes de banco (raiz, `npm test`) rodam contra o projeto Supabase DEV na nuvem e precisam de `.env.test`. Acumulam usuários `@teste.local`: limpe com `node scripts/limpar-usuarios-teste.mjs`.
- Segredos: estão em `segredos.7z` (criptografado com senha, que só o Pedro tem). Restaure com `powershell -ExecutionPolicy Bypass -File scripts/restaurar-segredos.ps1` (precisa do 7-Zip). Em texto puro **nunca** vão para o git: `.env.test`, `web/.env.local`, `web/.dev-credenciais.txt`. Ao mudar uma chave, refaça o `.7z`.
- Supabase: `npx supabase login` e `npx supabase link` na máquina nova. Docker não é necessário (usamos o projeto DEV na nuvem).

## Como verificar telas (aprendido no caminho)
- O Pedro quer **prova visual real**, não relato. Use um navegador de verdade.
- `resize_window` da extensão do Chrome **não funciona**; para largura de celular use o painel embutido (`mcp__Claude_Browser__*`, confira `innerWidth`) ou o seletor "Ver como Celular" do próprio app (iframe de 390px).
- Faça também uma auditoria de overflow por JS (`scrollWidth` vs `innerWidth`).
- Capturas de tela da extensão às vezes saem cortadas/ladrilhadas: confie no DOM e nas medidas, não só no print.
- Em grids, itens precisam de `min-width: 0` (já aplicado em `.tela > *` e `.tela-treinador > *`).
