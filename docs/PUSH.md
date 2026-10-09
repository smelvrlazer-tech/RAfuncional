# Notificações push (Web Push)

O app avisa o aluno no celular quando abre uma vaga na lista de espera, quando uma aula é cancelada e quando os treinos da semana saem. O **sino dentro do app continua sendo o canal garantido**: o push é um reforço (no iPhone só funciona com o app instalado na tela de início, iOS 16.4+).

## Como funciona

```
evento de negócio (promoção da fila, aula cancelada, treinos publicados)
   └─ insere em `notificacoes` (enviado_push_em = null), na mesma transação
pg_cron, todo minuto ── disparar_envio_push()
   └─ se há pendência e o Vault tem push_url + push_segredo: pg_net → Edge Function
Edge Function `enviar-push`
   ├─ lê as pendentes, acha os aparelhos em `inscricoes_push`, envia (Web Push + VAPID)
   ├─ inscrição expirada (404/410): apaga
   ├─ falha passageira em todos os aparelhos: deixa na fila e tenta de novo no minuto seguinte
   ├─ mais de 6 h de atraso: não envia (fica só no sino)
   └─ marca como enviada (`marcar_push_enviado`)
service worker (web/src/sw.ts) ── mostra a notificação; o clique abre/foca o app no link
```

Regras de decisão do envio: `supabase/functions/enviar-push/logica.ts` (testada em `tests/enviar-push.test.ts`, sem rede).

## O que está no repositório

| Peça | Onde |
|---|---|
| Tabela, RPCs, job do cron | `supabase/migrations/0012_push.sql` |
| Edge Function | `supabase/functions/enviar-push/` (`index.ts` liga o mundo; `logica.ts` decide) |
| Service worker (precache + push + clique) | `web/src/sw.ts` |
| Inscrição no aparelho | `web/src/avisos.ts`, `web/src/lib/push.ts` |
| Cartão "Avisos no celular" | `web/src/features/perfil/CartaoAvisos.tsx` |
| Testes | `tests/push.test.ts` (banco), `tests/enviar-push.test.ts`, `web/src/{sw,avisos}.test.ts`, `web/src/lib/push.test.ts`, `web/src/features/perfil/CartaoAvisos.test.tsx` |

Segurança: o cliente só **lê** as próprias inscrições; escrever é por `registrar_push` / `remover_push`. A chave VAPID privada e o segredo da função **nunca** vão para o app nem para o banco: ficam como *secrets* da Edge Function. A URL e o segredo que o cron usa ficam no **Vault** do Supabase, não em tabela comum.

## Ativar num projeto Supabase (uma vez por projeto; hoje só o DEV)

Pré-requisito: `npx supabase login` e `npx supabase link --project-ref mixrbjskhftungppggow`. Rode na raiz do projeto.

1. **Aplicar a migration:** `npx supabase db push` (aplica a `0012_push.sql`).
2. **Segredos da função** (a partir do `supabase/functions/.env`, que não vai para o Git):
   `npx supabase secrets set --env-file supabase/functions/.env`
3. **Publicar a função:** `npx supabase functions deploy enviar-push`
4. **Vault** (Dashboard → SQL Editor). O `PUSH_SEGREDO` é o mesmo valor do `supabase/functions/.env`:
   ```sql
   select vault.create_secret('https://mixrbjskhftungppggow.supabase.co/functions/v1/enviar-push', 'push_url');
   select vault.create_secret('<valor do PUSH_SEGREDO>', 'push_segredo');
   ```
   Enquanto o Vault não tiver os dois, o job não faz nada (o app segue normal, sem push).
5. **App:** o build precisa de `VITE_VAPID_PUBLIC_KEY` (já está em `web/.env.local`; na hospedagem, configure como variável de ambiente). Sem ela o cartão de avisos nem aparece.
6. **Testar:** abra o app (build de produção ou instalado; em `npm run dev` não há service worker), entre como aluno, Perfil → **Ativar avisos** → permitir. Depois, no SQL Editor:
   ```sql
   insert into notificacoes (perfil_id, titulo, corpo, link)
   select id, 'Teste de push', 'Funcionou!', '/' from perfis where nome like 'Ana%';
   ```
   Em até 1 minuto a notificação chega. Se não chegar:
   - `select * from net._http_response order by created desc limit 5;` (resposta da função);
   - Dashboard → Edge Functions → `enviar-push` → Logs;
   - `select * from inscricoes_push;` (o aparelho foi registrado?).
7. **Testes de banco:** `npm test` na raiz (`tests/push.test.ts` e a lista de autorização já incluem as peças novas).

### Se a rede bloquear as portas do banco (5432 e 6543)

Aconteceu em 09/10/2026: `supabase link` e `secrets set` / `functions deploy --use-api` funcionam (só usam HTTPS), mas `db push` falha com `Connection timed out`. Alternativa: aplicar a migration no **SQL Editor** do painel (também HTTPS). Cole o conteúdo de `supabase/migrations/0012_push.sql` seguido de
```sql
insert into supabase_migrations.schema_migrations (version, name, statements) values ('0012', 'push', '{}') on conflict (version) do nothing;
```
(o `db push` seguinte, numa rede liberada, não reaplica). Os dois `vault.create_secret` do passo 4 entram no mesmo colar. Depois **apague a consulta salva** no SQL Editor (ela guarda o segredo). Os testes de banco (`npm test`) usam HTTPS e funcionam mesmo com as portas bloqueadas.

## Cuidados

- **Backup das chaves:** os *secrets* do Supabase são só de escrita (não dá para ler de volta). Desde 09/10/2026 o `segredos.7z` já inclui `supabase/functions/.env` (como `env.funcoes.txt`) e o `scripts/restaurar-segredos.ps1` o restaura. Se uma chave mudar, refaça o pacote: junte `env.test.txt`, `env.local.txt`, `dev-credenciais.txt` e `env.funcoes.txt` e compacte com `7z a -mhe=on segredos.7z -p` (a senha é a mesma de sempre, só do Pedro).
- **Trocar a chave VAPID invalida todas as inscrições existentes** (cada aluno precisa tocar em "Ativar avisos" de novo). Só faça se a privada vazar.
- **`VAPID_SUBJECT`** hoje é `mailto:contato@rafuncional.app` (de exemplo). Troque pelo e-mail do Rafael ou pela URL do app quando existirem, e rode o passo 2 de novo.
- **Produção:** repita os passos 1 a 5 no projeto de produção, com **novas** chaves VAPID e um novo `PUSH_SEGREDO` (e a URL do passo 4 apontando para o projeto de produção).
- A função roda sem JWT (`verify_jwt = false` em `supabase/config.toml`) e só aceita quem manda o `x-push-segredo` certo.
