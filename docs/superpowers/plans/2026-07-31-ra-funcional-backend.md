# RA Funcional — Plano de Implementação 1: Fundação e Backend

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Construir e testar todo o backend do RA Funcional — banco Postgres com as regras de negócio, autorização por RLS, jobs agendados e envio de push — rodando 100% local, sem nenhuma conta em nuvem.

**Architecture:** Toda regra de negócio mora no Postgres, em funções `SECURITY DEFINER` chamadas via RPC. O cliente nunca escreve direto em `checkins` — isso torna a regra de 1h e a fila de espera impossíveis de burlar pelo front. Os testes chamam essas RPCs autenticados como usuários reais, contra um Postgres real, sem mocks. Notificações são gravadas em tabela dentro da mesma transação do evento de negócio, e um job drena a fila enviando push — HTTP nunca acontece dentro de transação.

**Tech Stack:** Supabase CLI (Postgres 15 + Auth + Edge Functions em Deno), `pg_cron`, `pg_net`, Web Push VAPID, Vitest + `@supabase/supabase-js` para os testes.

---

## Mudança de stack em relação ao spec — ler antes de começar

O spec (seção 5.1) indica **Next.js**. Este plano usa **Vite + React** no frontend (Plano 2). Motivo: o app não precisa de nenhuma renderização no servidor — autenticação e dados são client-side via Supabase. Com `output: 'export'` no Next.js, rotas dinâmicas como `/sessao/[id]` exigem `generateStaticParams`, que não existe para dados dinâmicos, forçando gambiarra de query string. O `vite-plugin-pwa` também é mais sólido e mantido que as alternativas de PWA no Next.js.

Nada neste Plano 1 depende dessa escolha — o backend é idêntico nos dois casos. A decisão só precisa estar tomada antes do Plano 2.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/config.toml` | Configuração do stack local |
| `supabase/migrations/0001_base.sql` | Enums, `perfis`, `configuracoes`, helpers |
| `supabase/migrations/0002_turmas_sessoes.sql` | `turmas`, `sessoes`, geração idempotente |
| `supabase/migrations/0003_checkins.sql` | `checkins`, `fazer_checkin` |
| `supabase/migrations/0004_cancelamento_fila.sql` | `notificacoes`, `cancelar_checkin`, `promover_da_espera` |
| `supabase/migrations/0005_treinos.sql` | `treinos`, publicação semanal |
| `supabase/migrations/0006_convites.sql` | `convites`, `criar_convite`, `aceitar_convite` |
| `supabase/migrations/0007_treinador.sql` | Ações administrativas do treinador |
| `supabase/migrations/0008_rls.sql` | Políticas RLS de todas as tabelas |
| `supabase/migrations/0009_agenda.sql` | View `v_agenda` consumida pelo front |
| `supabase/migrations/0010_push_cron.sql` | `inscricoes_push`, agendamentos `pg_cron` |
| `supabase/functions/enviar-push/index.ts` | Edge Function que drena a fila e envia push |
| `tests/helpers/db.ts` | Helpers de teste: usuários, sessões, limpeza |
| `tests/*.test.ts` | Um arquivo por regra de negócio |

Cada migration é imutável depois de commitada — correções vêm em uma migration nova. Isso é o que mantém local e produção idênticos.

---

## Task 1: Repositório e stack local

**Files:**
- Create: `.gitignore`, `package.json`, `vitest.config.ts`, `.env.test.example`

- [ ] **Step 1: Inicializar git**

```bash
git init -b main
```

- [ ] **Step 2: Criar `.gitignore`**

```
node_modules/
dist/
.env
.env.test
.env.local
supabase/.temp/
supabase/.branches/
.superpowers/
*.log
```

- [ ] **Step 3: Criar `package.json`**

```json
{
  "name": "ra-funcional",
  "private": true,
  "type": "module",
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:env": "supabase status -o env > .env.test",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.5",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Instalar dependências**

Run: `npm install`
Expected: `added N packages` sem erros.

- [ ] **Step 5: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  test: {
    // As regras moram no Postgres: testes rodam em série contra um banco real.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
```

- [ ] **Step 6: Criar `.env.test.example`**

```
# Gerado por: npm run db:env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json vitest.config.ts .env.test.example
git commit -m "chore: inicializa projeto e ferramenta de testes"
```

---

## Task 2: Subir o Supabase local

**Files:**
- Create: `supabase/config.toml` (gerado pela CLI)

- [ ] **Step 1: Confirmar que o Docker Desktop está rodando**

Run: `docker info --format "{{.ServerVersion}}"`
Expected: um número de versão. Se der erro de pipe, abrir o Docker Desktop e esperar ficar verde antes de seguir.

- [ ] **Step 2: Inicializar o Supabase**

Run: `npx supabase init`
Expected: cria `supabase/config.toml`. Responder "n" se perguntar sobre configs de editor.

- [ ] **Step 3: Subir o stack**

Run: `npx supabase start`
Expected: primeira execução baixa vários GB de imagens (demora). Ao final imprime `API URL`, `anon key`, `service_role key`.

- [ ] **Step 4: Gerar `.env.test`**

Run: `npm run db:env`
Then: `node -e "require('dotenv').config({path:'.env.test'}); console.log(!!process.env.SUPABASE_SERVICE_ROLE_KEY)"`
Expected: `true`

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: configura supabase local"
```

---

## Task 3: Migration base — perfis e configurações

**Files:**
- Create: `supabase/migrations/0001_base.sql`
- Create: `tests/helpers/db.ts`
- Test: `tests/base.test.ts`

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0001_base.sql`:

```sql
create type papel_usuario as enum ('aluno', 'treinador');
create type status_checkin as enum ('confirmado', 'espera', 'cancelado');
create type status_convite as enum ('pendente', 'usado', 'revogado');

create table perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null,
  telefone  text,
  papel     papel_usuario not null default 'aluno',
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table configuracoes (
  chave text primary key,
  valor text not null
);

insert into configuracoes (chave, valor) values
  ('limite_bloqueio_min',     '60'),
  ('janela_geracao_semanas',  '4'),
  ('spoiler_dia_semana',      '6'),   -- 0=domingo ... 6=sábado
  ('spoiler_hora',            '8'),
  ('fuso',                    'America/Sao_Paulo');

create or replace function config_int(p_chave text)
returns int language sql stable as $$
  select valor::int from configuracoes where chave = p_chave;
$$;

create or replace function config_texto(p_chave text)
returns text language sql stable as $$
  select valor from configuracoes where chave = p_chave;
$$;

-- SECURITY DEFINER evita recursão infinita quando usada em política RLS de perfis.
create or replace function eh_treinador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis where id = auth.uid() and papel = 'treinador'
  );
$$;
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db reset`
Expected: `Applying migration 0001_base.sql...` e finaliza sem erro.

- [ ] **Step 3: Escrever os helpers de teste**

`tests/helpers/db.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = process.env.SUPABASE_ANON_KEY!

/** Cliente com service_role: ignora RLS. Só para preparar cenário nos testes. */
export const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

export interface Usuario {
  id: string
  email: string
  cliente: SupabaseClient
}

/** Cria um usuário autenticado de verdade e devolve um cliente logado como ele. */
export async function criarUsuario(
  papel: 'aluno' | 'treinador' = 'aluno',
  opcoes: { ativo?: boolean } = {},
): Promise<Usuario> {
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.local`
  const password = 'senha-de-teste-123'

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error

  const { error: erroPerfil } = await admin.from('perfis').insert({
    id: data.user!.id, nome: 'Aluno Teste', papel, ativo: opcoes.ativo ?? true,
  })
  if (erroPerfil) throw erroPerfil

  const cliente = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password })
  if (erroLogin) throw erroLogin

  return { id: data.user!.id, email, cliente }
}

/** Apaga dados transacionais entre testes. Configurações e perfis permanecem. */
export async function limparDados(): Promise<void> {
  const tabelas = ['checkins', 'notificacoes', 'inscricoes_push', 'sessoes', 'turmas', 'treinos', 'convites']
  for (const tabela of tabelas) {
    const { error } = await admin.from(tabela).delete().gte('criado_em', '1970-01-01')
    if (error && !error.message.includes('does not exist')) throw error
  }
}

export async function definirConfig(chave: string, valor: string): Promise<void> {
  const { error } = await admin.from('configuracoes').update({ valor }).eq('chave', chave)
  if (error) throw error
}
```

- [ ] **Step 4: Escrever o teste**

`tests/base.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { admin, criarUsuario } from './helpers/db'

describe('fundação', () => {
  it('traz o limite de bloqueio padrão de 60 minutos', async () => {
    const { data, error } = await admin.from('configuracoes')
      .select('valor').eq('chave', 'limite_bloqueio_min').single()
    expect(error).toBeNull()
    expect(data!.valor).toBe('60')
  })

  it('cria usuário autenticado com perfil de aluno', async () => {
    const aluno = await criarUsuario('aluno')
    const { data } = await admin.from('perfis').select('papel, ativo').eq('id', aluno.id).single()
    expect(data!.papel).toBe('aluno')
    expect(data!.ativo).toBe(true)
  })

  it('eh_treinador distingue os papéis', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    const r1 = await treinador.cliente.rpc('eh_treinador')
    const r2 = await aluno.cliente.rpc('eh_treinador')
    expect(r1.data).toBe(true)
    expect(r2.data).toBe(false)
  })
})
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test -- tests/base.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_base.sql tests/helpers/db.ts tests/base.test.ts
git commit -m "feat(db): perfis, configuracoes e helpers de papel"
```

---

## Task 4: Turmas, sessões e geração idempotente

**Files:**
- Create: `supabase/migrations/0002_turmas_sessoes.sql`
- Test: `tests/geracao-sessoes.test.ts`

- [ ] **Step 1: Escrever o teste primeiro**

`tests/geracao-sessoes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, limparDados, definirConfig } from './helpers/db'

describe('geração de sessões', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('janela_geracao_semanas', '4')
  })

  it('gera uma sessão por semana dentro da janela', async () => {
    await admin.from('turmas').insert({
      nome: 'Funcional Manhã', dia_semana: 1, hora_inicio: '06:00',
      duracao_min: 60, vagas: 10, ativa: true,
    })
    await admin.rpc('gerar_sessoes')

    const { data } = await admin.from('sessoes').select('inicia_em')
    expect(data!.length).toBeGreaterThanOrEqual(4)
    expect(data!.length).toBeLessThanOrEqual(5)
  })

  it('é idempotente: rodar duas vezes não duplica', async () => {
    await admin.from('turmas').insert({
      nome: 'Funcional Tarde', dia_semana: 3, hora_inicio: '18:00',
      duracao_min: 60, vagas: 8, ativa: true,
    })
    await admin.rpc('gerar_sessoes')
    const { count: primeira } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    await admin.rpc('gerar_sessoes')
    const { count: segunda } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    expect(segunda).toBe(primeira)
  })

  it('ignora turmas inativas', async () => {
    await admin.from('turmas').insert({
      nome: 'Turma Desativada', dia_semana: 5, hora_inicio: '07:00',
      duracao_min: 60, vagas: 5, ativa: false,
    })
    await admin.rpc('gerar_sessoes')
    const { count } = await admin.from('sessoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('grava o horário no fuso de São Paulo', async () => {
    await admin.from('turmas').insert({
      nome: 'Seis da Manhã', dia_semana: 2, hora_inicio: '06:00',
      duracao_min: 60, vagas: 10, ativa: true,
    })
    await admin.rpc('gerar_sessoes')
    const { data } = await admin.rpc('debug_hora_local')
    expect(data).toContain('06:00')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/geracao-sessoes.test.ts`
Expected: FAIL — `relation "turmas" does not exist`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0002_turmas_sessoes.sql`:

```sql
create table turmas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  dia_semana  smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  duracao_min smallint not null default 60,
  vagas       smallint not null check (vagas > 0),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table sessoes (
  id         uuid primary key default gen_random_uuid(),
  turma_id   uuid not null references turmas(id) on delete cascade,
  inicia_em  timestamptz not null,
  vagas      smallint not null check (vagas > 0),
  cancelada  boolean not null default false,
  observacao text,
  criado_em  timestamptz not null default now(),
  unique (turma_id, inicia_em)
);

create index sessoes_inicia_em_idx on sessoes (inicia_em);

-- Gera sessões futuras a partir das turmas ativas.
-- ON CONFLICT DO NOTHING é o que torna a função idempotente.
create or replace function gerar_sessoes()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_fuso    text := config_texto('fuso');
  v_semanas int  := config_int('janela_geracao_semanas');
  v_hoje    date := (now() at time zone v_fuso)::date;
  v_fim     date := v_hoje + (v_semanas * 7);
  v_criadas int  := 0;
begin
  with datas as (
    select t.id as turma_id, t.vagas, d::date as dia, t.hora_inicio
      from turmas t
      cross join generate_series(v_hoje, v_fim, interval '1 day') d
     where t.ativa
       and extract(dow from d) = t.dia_semana
  ),
  novas as (
    insert into sessoes (turma_id, inicia_em, vagas)
    select turma_id,
           ((dia + hora_inicio) at time zone v_fuso),
           vagas
      from datas
     where ((dia + hora_inicio) at time zone v_fuso) > now()
    on conflict (turma_id, inicia_em) do nothing
    returning 1
  )
  select count(*) into v_criadas from novas;

  return v_criadas;
end $$;

-- Auxiliar de teste: confirma que a hora local gravada bate com a da turma.
create or replace function debug_hora_local()
returns text language sql stable security definer set search_path = public as $$
  select to_char(min(inicia_em) at time zone config_texto('fuso'), 'HH24:MI')
    from sessoes;
$$;
```

- [ ] **Step 4: Aplicar e rodar os testes**

Run: `npx supabase db reset && npm test -- tests/geracao-sessoes.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_turmas_sessoes.sql tests/geracao-sessoes.test.ts
git commit -m "feat(db): turmas, sessoes e geracao idempotente"
```

---

## Task 5: Check-in — vagas e regra de bloqueio de 1h

Esta é a tarefa mais importante do plano. Os testes de borda (61, 60 e 59 minutos) são o coração do produto.

**Files:**
- Create: `supabase/migrations/0003_checkins.sql`
- Test: `tests/checkin.test.ts`

- [ ] **Step 1: Adicionar helper de sessão em `tests/helpers/db.ts`**

Acrescentar ao final do arquivo:

```ts
/** Cria uma turma+sessão que começa daqui a N minutos. */
export async function criarSessao(minutosAteInicio: number, vagas = 2) {
  const { data: turma, error: erroTurma } = await admin.from('turmas')
    .insert({ nome: 'Turma Teste', dia_semana: 1, hora_inicio: '06:00', duracao_min: 60, vagas })
    .select().single()
  if (erroTurma) throw erroTurma

  const inicia = new Date(Date.now() + minutosAteInicio * 60_000).toISOString()
  const { data: sessao, error } = await admin.from('sessoes')
    .insert({ turma_id: turma!.id, inicia_em: inicia, vagas })
    .select().single()
  if (error) throw error
  return sessao as { id: string; inicia_em: string; vagas: number }
}
```

- [ ] **Step 2: Escrever o teste**

`tests/checkin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

describe('check-in', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('confirma quando há vaga', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 2)
    const { data, error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data.status).toBe('confirmado')
  })

  it('coloca na espera quando lotada, em ordem FIFO', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const a3 = await criarUsuario('aluno')

    const r1 = await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const r2 = await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const r3 = await a3.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    expect(r1.data.status).toBe('confirmado')
    expect(r2.data.status).toBe('espera')
    expect(r2.data.posicao_fila).toBe(1)
    expect(r3.data.posicao_fila).toBe(2)
  })

  it('permite check-in faltando 61 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(61, 5)
    const { data, error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
    expect(data.status).toBe('confirmado')
  })

  it('bloqueia check-in faltando 59 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(59, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('bloqueia check-in faltando exatamente 60 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(60, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('recusa aluno desativado', async () => {
    const aluno = await criarUsuario('aluno', { ativo: false })
    const sessao = await criarSessao(120, 5)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('aluno_inativo')
  })

  it('recusa check-in duplicado', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('checkin_ja_existe')
  })

  it('recusa sessão cancelada', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await admin.from('sessoes').update({ cancelada: true }).eq('id', sessao.id)
    const { error } = await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('sessao_cancelada')
  })

  it('nunca ultrapassa o número de vagas com pedidos simultâneos', async () => {
    const sessao = await criarSessao(120, 2)
    const alunos = await Promise.all([
      criarUsuario('aluno'), criarUsuario('aluno'),
      criarUsuario('aluno'), criarUsuario('aluno'),
    ])
    await Promise.all(alunos.map(a => a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })))

    const { count } = await admin.from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(count).toBe(2)
  })
})
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `npm test -- tests/checkin.test.ts`
Expected: FAIL — `Could not find the function public.fazer_checkin`.

- [ ] **Step 4: Escrever a migration**

`supabase/migrations/0003_checkins.sql`:

```sql
create table checkins (
  id            uuid primary key default gen_random_uuid(),
  sessao_id     uuid not null references sessoes(id) on delete cascade,
  aluno_id      uuid not null references perfis(id) on delete cascade,
  status        status_checkin not null,
  posicao_fila  integer,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (sessao_id, aluno_id)
);

create index checkins_sessao_status_idx on checkins (sessao_id, status);
create index checkins_aluno_idx on checkins (aluno_id);

-- Uma sessão está bloqueada a partir de `limite_bloqueio_min` antes do início.
create or replace function sessao_bloqueada(p_inicia_em timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select p_inicia_em - make_interval(mins => config_int('limite_bloqueio_min')) <= now();
$$;

create or replace function fazer_checkin(p_sessao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aluno       uuid := auth.uid();
  v_sessao      sessoes%rowtype;
  v_confirmados int;
  v_status      status_checkin;
  v_posicao     int;
begin
  if v_aluno is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  if not exists (select 1 from perfis where id = v_aluno and ativo) then
    raise exception 'aluno_inativo' using errcode = 'P0001';
  end if;

  -- FOR UPDATE serializa pedidos concorrentes na mesma sessão.
  select * into v_sessao from sessoes where id = p_sessao_id for update;
  if not found then
    raise exception 'sessao_inexistente' using errcode = 'P0002';
  end if;
  if v_sessao.cancelada then
    raise exception 'sessao_cancelada' using errcode = 'P0001';
  end if;
  if sessao_bloqueada(v_sessao.inicia_em) then
    raise exception 'sessao_bloqueada' using errcode = 'P0001';
  end if;

  select count(*) into v_confirmados
    from checkins where sessao_id = p_sessao_id and status = 'confirmado';

  if v_confirmados < v_sessao.vagas then
    v_status  := 'confirmado';
    v_posicao := null;
  else
    v_status := 'espera';
    select coalesce(max(posicao_fila), 0) + 1 into v_posicao
      from checkins where sessao_id = p_sessao_id and status = 'espera';
  end if;

  -- Só reaproveita o registro se o aluno havia cancelado antes.
  insert into checkins (sessao_id, aluno_id, status, posicao_fila)
  values (p_sessao_id, v_aluno, v_status, v_posicao)
  on conflict (sessao_id, aluno_id) do update
     set status = excluded.status,
         posicao_fila = excluded.posicao_fila,
         atualizado_em = now()
   where checkins.status = 'cancelado';

  if not found then
    raise exception 'checkin_ja_existe' using errcode = 'P0001';
  end if;

  return jsonb_build_object('status', v_status, 'posicao_fila', v_posicao);
end $$;

revoke all on function fazer_checkin(uuid) from public;
grant execute on function fazer_checkin(uuid) to authenticated;
```

- [ ] **Step 5: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/checkin.test.ts`
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_checkins.sql tests/checkin.test.ts tests/helpers/db.ts
git commit -m "feat(db): check-in com controle de vagas e bloqueio de 1h"
```

---

## Task 6: Cancelamento e promoção automática da fila

**Files:**
- Create: `supabase/migrations/0004_cancelamento_fila.sql`
- Test: `tests/cancelamento.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/cancelamento.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

describe('cancelamento e fila de espera', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('promove o primeiro da fila quando alguém cancela', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await admin.from('checkins')
      .select('status, posicao_fila').eq('sessao_id', sessao.id).eq('aluno_id', a2.id).single()
    expect(data!.status).toBe('confirmado')
    expect(data!.posicao_fila).toBeNull()
  })

  it('respeita a ordem FIFO da fila', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const a3 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a3.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await admin.from('checkins')
      .select('aluno_id, status').eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(data!.map(c => c.aluno_id)).toEqual([a2.id])
  })

  it('registra notificação para o aluno promovido', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })

    const { data } = await admin.from('notificacoes').select('titulo').eq('perfil_id', a2.id)
    expect(data!.length).toBe(1)
    expect(data![0].titulo).toContain('Vaga liberada')
  })

  it('bloqueia cancelamento de confirmado faltando 59 minutos', async () => {
    const aluno = await criarUsuario('aluno')
    const sessao = await criarSessao(120, 5)
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: new Date(Date.now() + 59 * 60_000).toISOString() })
      .eq('id', sessao.id)

    const { error } = await aluno.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    expect(error!.message).toContain('sessao_bloqueada')
  })

  it('permite sair da fila de espera mesmo após o bloqueio', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: new Date(Date.now() + 30 * 60_000).toISOString() })
      .eq('id', sessao.id)

    const { error } = await a2.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id })
    expect(error).toBeNull()
  })

  it('não promove ninguém depois do bloqueio', async () => {
    const sessao = await criarSessao(120, 1)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: new Date(Date.now() + 30 * 60_000).toISOString() })
      .eq('id', sessao.id)

    // Treinador remove o confirmado: vaga abre, mas a fila está congelada.
    await admin.from('checkins').update({ status: 'cancelado' })
      .eq('sessao_id', sessao.id).eq('aluno_id', a1.id)
    await admin.rpc('promover_da_espera', { p_sessao_id: sessao.id })

    const { data } = await admin.from('checkins')
      .select('status').eq('sessao_id', sessao.id).eq('aluno_id', a2.id).single()
    expect(data!.status).toBe('espera')
  })

  it('dois cancelamentos simultâneos não promovem duas pessoas para uma vaga', async () => {
    const sessao = await criarSessao(120, 2)
    const c1 = await criarUsuario('aluno')
    const c2 = await criarUsuario('aluno')
    const e1 = await criarUsuario('aluno')
    for (const a of [c1, c2, e1]) {
      await a.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    }

    await Promise.all([
      c1.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
      c2.cliente.rpc('cancelar_checkin', { p_sessao_id: sessao.id }),
    ])

    const { count } = await admin.from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sessao_id', sessao.id).eq('status', 'confirmado')
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/cancelamento.test.ts`
Expected: FAIL — `Could not find the function public.cancelar_checkin`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0004_cancelamento_fila.sql`:

```sql
create table notificacoes (
  id              uuid primary key default gen_random_uuid(),
  perfil_id       uuid not null references perfis(id) on delete cascade,
  titulo          text not null,
  corpo           text not null,
  link            text,
  lida_em         timestamptz,
  enviado_push_em timestamptz,
  criado_em       timestamptz not null default now()
);

create index notificacoes_perfil_idx on notificacoes (perfil_id, criado_em desc);
create index notificacoes_pendentes_idx on notificacoes (criado_em) where enviado_push_em is null;

-- Promove o primeiro da fila se houver vaga e a sessão não estiver bloqueada.
-- Sempre chamada dentro da transação que liberou a vaga.
create or replace function promover_da_espera(p_sessao_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sessao      sessoes%rowtype;
  v_confirmados int;
  v_prox        checkins%rowtype;
begin
  select * into v_sessao from sessoes where id = p_sessao_id;
  if not found or v_sessao.cancelada then return null; end if;
  if sessao_bloqueada(v_sessao.inicia_em) then return null; end if;

  select count(*) into v_confirmados
    from checkins where sessao_id = p_sessao_id and status = 'confirmado';
  if v_confirmados >= v_sessao.vagas then return null; end if;

  select * into v_prox from checkins
   where sessao_id = p_sessao_id and status = 'espera'
   order by posicao_fila asc
   limit 1;
  if not found then return null; end if;

  update checkins
     set status = 'confirmado', posicao_fila = null, atualizado_em = now()
   where id = v_prox.id;

  insert into notificacoes (perfil_id, titulo, corpo, link)
  values (
    v_prox.aluno_id,
    'Vaga liberada!',
    'Você foi confirmado na aula de ' ||
      to_char(v_sessao.inicia_em at time zone config_texto('fuso'), 'DD/MM "às" HH24:MI') || '.',
    '/sessao/' || p_sessao_id
  );

  return v_prox.aluno_id;
end $$;

create or replace function cancelar_checkin(p_sessao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aluno  uuid := auth.uid();
  v_sessao sessoes%rowtype;
  v_meu    status_checkin;
begin
  if v_aluno is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select * into v_sessao from sessoes where id = p_sessao_id for update;
  if not found then
    raise exception 'sessao_inexistente' using errcode = 'P0002';
  end if;

  select status into v_meu
    from checkins where sessao_id = p_sessao_id and aluno_id = v_aluno;
  if v_meu is null or v_meu = 'cancelado' then
    raise exception 'checkin_inexistente' using errcode = 'P0002';
  end if;

  -- Sair da fila de espera não ocupa vaga, então não sofre a regra de 1h.
  if v_meu = 'confirmado' and sessao_bloqueada(v_sessao.inicia_em) then
    raise exception 'sessao_bloqueada' using errcode = 'P0001';
  end if;

  update checkins
     set status = 'cancelado', posicao_fila = null, atualizado_em = now()
   where sessao_id = p_sessao_id and aluno_id = v_aluno;

  if v_meu = 'confirmado' then
    perform promover_da_espera(p_sessao_id);
  end if;

  return jsonb_build_object('cancelado', true, 'status_anterior', v_meu);
end $$;

revoke all on function cancelar_checkin(uuid) from public;
grant execute on function cancelar_checkin(uuid) to authenticated;
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/cancelamento.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os arquivos passam.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_cancelamento_fila.sql tests/cancelamento.test.ts
git commit -m "feat(db): cancelamento com promocao automatica da fila"
```

---

## Task 7: Treinos e publicação automática da semana

**Files:**
- Create: `supabase/migrations/0005_treinos.sql`
- Test: `tests/treinos.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/treinos.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, limparDados, definirConfig } from './helpers/db'

/** Data ISO de um dia da semana que vem, no fuso local. */
function diaSemanaQueVem(offsetDias: number): string {
  const d = new Date()
  const diasAteSegunda = (8 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + diasAteSegunda + offsetDias)
  return d.toISOString().slice(0, 10)
}

describe('treinos e spoiler da semana', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('spoiler_dia_semana', String(new Date().getDay()))
    await definirConfig('spoiler_hora', String(new Date().getHours()))
  })

  it('publica os treinos da semana seguinte', async () => {
    await admin.from('treinos').insert({
      data: diaSemanaQueVem(0), titulo: 'Full body', descricao: 'Circuito de 5 estações',
    })
    const { data } = await admin.rpc('publicar_treinos_semana')
    expect(data).toBe(1)

    const { data: treino } = await admin.from('treinos')
      .select('publicado_em').eq('data', diaSemanaQueVem(0)).single()
    expect(treino!.publicado_em).not.toBeNull()
  })

  it('notifica todos os alunos ativos quando publica', async () => {
    const aluno = await criarUsuario('aluno')
    await criarUsuario('aluno', { ativo: false })
    await admin.from('treinos').insert({
      data: diaSemanaQueVem(0), titulo: 'Core', descricao: 'Prancha e variações',
    })
    await admin.rpc('publicar_treinos_semana')

    const { data } = await admin.from('notificacoes').select('perfil_id, titulo')
    expect(data!.length).toBe(1)
    expect(data![0].perfil_id).toBe(aluno.id)
  })

  it('não notifica quando não há treino cadastrado', async () => {
    await criarUsuario('aluno')
    const { data } = await admin.rpc('publicar_treinos_semana')
    expect(data).toBe(0)

    const { count } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('é idempotente: rodar de novo não republica nem notifica', async () => {
    await criarUsuario('aluno')
    await admin.from('treinos').insert({
      data: diaSemanaQueVem(0), titulo: 'Pernas', descricao: 'Agachamento e afundo',
    })
    await admin.rpc('publicar_treinos_semana')
    const segunda = await admin.rpc('publicar_treinos_semana')
    expect(segunda.data).toBe(0)

    const { count } = await admin.from('notificacoes').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  it('não faz nada fora do dia e hora configurados', async () => {
    await definirConfig('spoiler_hora', String((new Date().getHours() + 3) % 24))
    await admin.from('treinos').insert({
      data: diaSemanaQueVem(0), titulo: 'Ombros', descricao: 'Desenvolvimento',
    })
    const { data } = await admin.rpc('publicar_treinos_semana')
    expect(data).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/treinos.test.ts`
Expected: FAIL — `relation "treinos" does not exist`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0005_treinos.sql`:

```sql
create table treinos (
  id           uuid primary key default gen_random_uuid(),
  data         date not null unique,
  titulo       text not null,
  descricao    text not null,
  video_url    text,
  publicado_em timestamptz,
  criado_em    timestamptz not null default now()
);

create index treinos_data_idx on treinos (data);

-- Publica os treinos da próxima semana (segunda a domingo) e avisa os alunos.
-- Chamada de hora em hora pelo cron; só age no dia e hora configurados.
create or replace function publicar_treinos_semana()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_fuso       text := config_texto('fuso');
  v_agora      timestamp := now() at time zone v_fuso;
  v_dia_alvo   int := config_int('spoiler_dia_semana');
  v_hora_alvo  int := config_int('spoiler_hora');
  v_inicio     date;
  v_fim        date;
  v_publicados int;
begin
  if extract(dow from v_agora)::int <> v_dia_alvo
     or extract(hour from v_agora)::int <> v_hora_alvo then
    return 0;
  end if;

  -- Próxima segunda-feira até o domingo seguinte.
  v_inicio := (v_agora::date + ((8 - extract(dow from v_agora)::int) % 7 || ' days')::interval)::date;
  if v_inicio = v_agora::date then
    v_inicio := v_inicio + 7;
  end if;
  v_fim := v_inicio + 6;

  with publicados as (
    update treinos
       set publicado_em = now()
     where data between v_inicio and v_fim
       and publicado_em is null
    returning 1
  )
  select count(*) into v_publicados from publicados;

  if v_publicados = 0 then
    return 0;
  end if;

  insert into notificacoes (perfil_id, titulo, corpo, link)
  select p.id,
         'Treinos da semana no ar',
         'Os treinos da próxima semana já estão disponíveis. Garanta sua vaga!',
         '/'
    from perfis p
   where p.ativo and p.papel = 'aluno';

  return v_publicados;
end $$;
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/treinos.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_treinos.sql tests/treinos.test.ts
git commit -m "feat(db): treinos e publicacao automatica da semana"
```

---

## Task 8: Convites e cadastro fechado

**Files:**
- Create: `supabase/migrations/0006_convites.sql`
- Test: `tests/convites.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/convites.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, criarUsuario, limparDados } from './helpers/db'

async function criarAuthSemPerfil() {
  const email = `n${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.local`
  const password = 'senha-de-teste-123'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  await cliente.auth.signInWithPassword({ email, password })
  return { id: data.user!.id, cliente }
}

describe('convites', () => {
  beforeEach(limparDados)

  it('treinador gera convite com código', async () => {
    const treinador = await criarUsuario('treinador')
    const { data, error } = await treinador.cliente.rpc('criar_convite', { p_nome: 'João' })
    expect(error).toBeNull()
    expect(data.codigo).toHaveLength(12)
  })

  it('aluno não pode gerar convite', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.rpc('criar_convite', { p_nome: 'Maria' })
    expect(error!.message).toContain('acesso_negado')
  })

  it('aceitar convite cria o perfil e marca como usado', async () => {
    const treinador = await criarUsuario('treinador')
    const { data: convite } = await treinador.cliente.rpc('criar_convite', { p_nome: 'Ana' })
    const novo = await criarAuthSemPerfil()

    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: convite.codigo, p_nome: 'Ana Silva', p_telefone: '11999999999',
    })
    expect(error).toBeNull()

    const { data: perfil } = await admin.from('perfis').select('nome, papel').eq('id', novo.id).single()
    expect(perfil!.nome).toBe('Ana Silva')
    expect(perfil!.papel).toBe('aluno')

    const { data: usado } = await admin.from('convites')
      .select('status, usado_por').eq('codigo', convite.codigo).single()
    expect(usado!.status).toBe('usado')
    expect(usado!.usado_por).toBe(novo.id)
  })

  it('recusa código inexistente', async () => {
    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: 'INEXISTENTE', p_nome: 'X', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
  })

  it('recusa convite já usado', async () => {
    const treinador = await criarUsuario('treinador')
    const { data: convite } = await treinador.cliente.rpc('criar_convite', { p_nome: 'Bia' })
    const primeiro = await criarAuthSemPerfil()
    await primeiro.cliente.rpc('aceitar_convite', { p_codigo: convite.codigo, p_nome: 'Bia', p_telefone: null })

    const segundo = await criarAuthSemPerfil()
    const { error } = await segundo.cliente.rpc('aceitar_convite', {
      p_codigo: convite.codigo, p_nome: 'Intruso', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
  })

  it('recusa convite expirado', async () => {
    const treinador = await criarUsuario('treinador')
    const { data: convite } = await treinador.cliente.rpc('criar_convite', { p_nome: 'Caio' })
    await admin.from('convites')
      .update({ expira_em: new Date(Date.now() - 86_400_000).toISOString() })
      .eq('codigo', convite.codigo)

    const novo = await criarAuthSemPerfil()
    const { error } = await novo.cliente.rpc('aceitar_convite', {
      p_codigo: convite.codigo, p_nome: 'Caio', p_telefone: null,
    })
    expect(error!.message).toContain('convite_invalido')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/convites.test.ts`
Expected: FAIL — `Could not find the function public.criar_convite`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0006_convites.sql`:

```sql
create table convites (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nome_previsto text,
  status        status_convite not null default 'pendente',
  usado_por     uuid references perfis(id) on delete set null,
  expira_em     timestamptz not null default now() + interval '30 days',
  criado_em     timestamptz not null default now()
);

create or replace function criar_convite(p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- 12 caracteres alfanuméricos maiúsculos, sem ambiguidade visual.
  v_codigo := upper(translate(encode(gen_random_bytes(9), 'base64'), '+/=OIl01', 'ABCDEFGH'));
  v_codigo := left(v_codigo, 12);

  insert into convites (codigo, nome_previsto) values (v_codigo, p_nome);

  return jsonb_build_object('codigo', v_codigo);
end $$;

create or replace function aceitar_convite(p_codigo text, p_nome text, p_telefone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid := auth.uid();
  v_convite convites%rowtype;
begin
  if v_usuario is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from perfis where id = v_usuario) then
    raise exception 'perfil_ja_existe' using errcode = 'P0001';
  end if;

  select * into v_convite from convites
   where codigo = p_codigo and status = 'pendente' and expira_em > now()
   for update;
  if not found then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;

  insert into perfis (id, nome, telefone, papel, ativo)
  values (v_usuario, p_nome, p_telefone, 'aluno', true);

  update convites set status = 'usado', usado_por = v_usuario where id = v_convite.id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function criar_convite(text) from public;
revoke all on function aceitar_convite(text, text, text) from public;
grant execute on function criar_convite(text) to authenticated;
grant execute on function aceitar_convite(text, text, text) to authenticated;
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/convites.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_convites.sql tests/convites.test.ts
git commit -m "feat(db): convites e cadastro fechado"
```

---

## Task 9: Ações administrativas do treinador

**Files:**
- Create: `supabase/migrations/0007_treinador.sql`
- Test: `tests/treinador.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/treinador.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

describe('ações do treinador', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('remove aluno mesmo após o bloqueio e libera a vaga', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await admin.from('sessoes')
      .update({ inicia_em: new Date(Date.now() + 30 * 60_000).toISOString() })
      .eq('id', sessao.id)

    const { error } = await treinador.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: aluno.id,
    })
    expect(error).toBeNull()

    const { data } = await admin.from('checkins')
      .select('status').eq('sessao_id', sessao.id).eq('aluno_id', aluno.id).single()
    expect(data!.status).toBe('cancelado')
  })

  it('aluno não consegue remover outro aluno', async () => {
    const sessao = await criarSessao(120, 2)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { error } = await a1.cliente.rpc('treinador_remover_aluno', {
      p_sessao_id: sessao.id, p_aluno_id: a2.id,
    })
    expect(error!.message).toContain('acesso_negado')
  })

  it('cancela a sessão e notifica confirmados e fila', async () => {
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    const confirmado = await criarUsuario('aluno')
    const naFila = await criarUsuario('aluno')
    await confirmado.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await naFila.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { error } = await treinador.cliente.rpc('treinador_cancelar_sessao', {
      p_sessao_id: sessao.id, p_observacao: 'Chuva forte',
    })
    expect(error).toBeNull()

    const { data } = await admin.from('notificacoes').select('perfil_id, corpo')
    expect(data!.length).toBe(2)
    expect(data![0].corpo).toContain('Chuva forte')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/treinador.test.ts`
Expected: FAIL — `Could not find the function public.treinador_remover_aluno`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0007_treinador.sql`:

```sql
-- Exceção administrativa: o treinador remove alguém a qualquer momento,
-- inclusive depois do bloqueio de 1h.
create or replace function treinador_remover_aluno(p_sessao_id uuid, p_aluno_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_anterior status_checkin;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  perform 1 from sessoes where id = p_sessao_id for update;

  select status into v_anterior
    from checkins where sessao_id = p_sessao_id and aluno_id = p_aluno_id;
  if v_anterior is null or v_anterior = 'cancelado' then
    raise exception 'checkin_inexistente' using errcode = 'P0002';
  end if;

  update checkins
     set status = 'cancelado', posicao_fila = null, atualizado_em = now()
   where sessao_id = p_sessao_id and aluno_id = p_aluno_id;

  insert into notificacoes (perfil_id, titulo, corpo, link)
  values (p_aluno_id, 'Presença removida',
          'O treinador removeu sua presença nesta aula.', '/sessao/' || p_sessao_id);

  if v_anterior = 'confirmado' then
    perform promover_da_espera(p_sessao_id);
  end if;

  return jsonb_build_object('removido', true);
end $$;

create or replace function treinador_cancelar_sessao(p_sessao_id uuid, p_observacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sessao   sessoes%rowtype;
  v_avisados int;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select * into v_sessao from sessoes where id = p_sessao_id for update;
  if not found then
    raise exception 'sessao_inexistente' using errcode = 'P0002';
  end if;

  update sessoes set cancelada = true, observacao = p_observacao where id = p_sessao_id;

  with avisados as (
    insert into notificacoes (perfil_id, titulo, corpo, link)
    select c.aluno_id,
           'Aula cancelada',
           'A aula de ' ||
             to_char(v_sessao.inicia_em at time zone config_texto('fuso'), 'DD/MM "às" HH24:MI') ||
             ' foi cancelada. Motivo: ' || coalesce(p_observacao, 'não informado'),
           '/'
      from checkins c
     where c.sessao_id = p_sessao_id and c.status in ('confirmado', 'espera')
    returning 1
  )
  select count(*) into v_avisados from avisados;

  return jsonb_build_object('cancelada', true, 'avisados', v_avisados);
end $$;

revoke all on function treinador_remover_aluno(uuid, uuid) from public;
revoke all on function treinador_cancelar_sessao(uuid, text) from public;
grant execute on function treinador_remover_aluno(uuid, uuid) to authenticated;
grant execute on function treinador_cancelar_sessao(uuid, text) to authenticated;
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/treinador.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_treinador.sql tests/treinador.test.ts
git commit -m "feat(db): acoes administrativas do treinador"
```

---

## Task 10: Row Level Security

Até aqui as tabelas estão sem RLS — qualquer usuário autenticado lê tudo. Esta tarefa fecha o acesso.

**Files:**
- Create: `supabase/migrations/0008_rls.sql`
- Test: `tests/autorizacao.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/autorizacao.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { criarUsuario, criarSessao, limparDados } from './helpers/db'

describe('autorização (RLS)', () => {
  beforeEach(limparDados)

  it('aluno não enxerga check-in de outro aluno', async () => {
    const sessao = await criarSessao(120, 5)
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    await a2.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data } = await a1.cliente.from('checkins').select('*')
    expect(data).toEqual([])
  })

  it('treinador enxerga todos os check-ins', async () => {
    const sessao = await criarSessao(120, 5)
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data } = await treinador.cliente.from('checkins').select('*')
    expect(data!.length).toBe(1)
  })

  it('aluno não escreve direto em checkins', async () => {
    const sessao = await criarSessao(120, 5)
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('checkins')
      .insert({ sessao_id: sessao.id, aluno_id: aluno.id, status: 'confirmado' })
    expect(error).not.toBeNull()
  })

  it('aluno não cria nem edita turmas', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('turmas').insert({
      nome: 'Pirata', dia_semana: 1, hora_inicio: '06:00', duracao_min: 60, vagas: 99,
    })
    expect(error).not.toBeNull()
  })

  it('aluno só vê treinos publicados', async () => {
    const treinador = await criarUsuario('treinador')
    const aluno = await criarUsuario('aluno')
    await treinador.cliente.from('treinos').insert([
      { data: '2030-01-01', titulo: 'Rascunho', descricao: 'oculto' },
      { data: '2030-01-02', titulo: 'Publicado', descricao: 'visível', publicado_em: new Date().toISOString() },
    ])

    const { data } = await aluno.cliente.from('treinos').select('titulo')
    expect(data!.map(t => t.titulo)).toEqual(['Publicado'])
  })

  it('aluno não lê notificação de outro aluno', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const treinador = await criarUsuario('treinador')
    const sessao = await criarSessao(120, 1)
    await a1.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    await treinador.cliente.rpc('treinador_remover_aluno', { p_sessao_id: sessao.id, p_aluno_id: a1.id })

    const { data } = await a2.cliente.from('notificacoes').select('*')
    expect(data).toEqual([])
  })

  it('aluno não lê a lista de convites', async () => {
    const treinador = await criarUsuario('treinador')
    await treinador.cliente.rpc('criar_convite', { p_nome: 'Alguém' })
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('convites').select('*')
    expect(data).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/autorizacao.test.ts`
Expected: FAIL — vários testes falham porque sem RLS todo mundo lê tudo.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0008_rls.sql`:

```sql
alter table perfis          enable row level security;
alter table configuracoes   enable row level security;
alter table turmas          enable row level security;
alter table sessoes         enable row level security;
alter table checkins        enable row level security;
alter table treinos         enable row level security;
alter table convites        enable row level security;
alter table notificacoes    enable row level security;

-- perfis
create policy perfis_leitura_propria on perfis
  for select to authenticated using (id = auth.uid() or eh_treinador());
create policy perfis_edicao_propria on perfis
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and papel = 'aluno');
create policy perfis_treinador_total on perfis
  for all to authenticated using (eh_treinador()) with check (eh_treinador());

-- configuracoes: leitura livre (o front precisa do limite de bloqueio), escrita só do treinador
create policy config_leitura on configuracoes
  for select to authenticated using (true);
create policy config_escrita on configuracoes
  for update to authenticated using (eh_treinador()) with check (eh_treinador());

-- turmas e sessoes: todo aluno lê, só treinador escreve
create policy turmas_leitura on turmas for select to authenticated using (true);
create policy turmas_escrita on turmas for all to authenticated
  using (eh_treinador()) with check (eh_treinador());

create policy sessoes_leitura on sessoes for select to authenticated using (true);
create policy sessoes_escrita on sessoes for all to authenticated
  using (eh_treinador()) with check (eh_treinador());

-- checkins: aluno lê só o próprio; ninguém escreve direto (apenas as RPCs SECURITY DEFINER)
create policy checkins_leitura_propria on checkins
  for select to authenticated using (aluno_id = auth.uid() or eh_treinador());

-- treinos: aluno vê só publicados
create policy treinos_leitura on treinos
  for select to authenticated using (publicado_em is not null or eh_treinador());
create policy treinos_escrita on treinos for all to authenticated
  using (eh_treinador()) with check (eh_treinador());

-- convites: exclusivo do treinador (aceitar_convite é SECURITY DEFINER)
create policy convites_treinador on convites for all to authenticated
  using (eh_treinador()) with check (eh_treinador());

-- notificacoes: aluno lê e marca como lida só as próprias
create policy notificacoes_leitura_propria on notificacoes
  for select to authenticated using (perfil_id = auth.uid());
create policy notificacoes_marcar_lida on notificacoes
  for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/autorizacao.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Rodar a suíte inteira — o RLS pode ter quebrado testes anteriores**

Run: `npm test`
Expected: todos passam. Se algum teste anterior falhar por leitura negada, o correto é ajustar o teste para usar o cliente `admin` na preparação do cenário, nunca afrouxar a política.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0008_rls.sql tests/autorizacao.test.ts
git commit -m "feat(db): row level security em todas as tabelas"
```

---

## Task 11: View de agenda para o front

**Files:**
- Create: `supabase/migrations/0009_agenda.sql`
- Test: `tests/agenda.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/agenda.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { criarUsuario, criarSessao, limparDados, definirConfig } from './helpers/db'

describe('view de agenda', () => {
  beforeEach(async () => {
    await limparDados()
    await definirConfig('limite_bloqueio_min', '60')
  })

  it('mostra vagas restantes e o status do próprio aluno', async () => {
    const sessao = await criarSessao(120, 3)
    const aluno = await criarUsuario('aluno')
    await aluno.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })

    const { data } = await aluno.cliente.from('v_agenda').select('*').eq('id', sessao.id).single()
    expect(data!.confirmados).toBe(1)
    expect(data!.vagas_restantes).toBe(2)
    expect(data!.meu_status).toBe('confirmado')
    expect(data!.bloqueada).toBe(false)
  })

  it('marca como bloqueada quando falta menos de 1h', async () => {
    const sessao = await criarSessao(30, 3)
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('v_agenda').select('bloqueada').eq('id', sessao.id).single()
    expect(data!.bloqueada).toBe(true)
  })

  it('meu_status é nulo para quem não fez check-in', async () => {
    const sessao = await criarSessao(120, 3)
    const outro = await criarUsuario('aluno')
    await outro.cliente.rpc('fazer_checkin', { p_sessao_id: sessao.id })
    const aluno = await criarUsuario('aluno')

    const { data } = await aluno.cliente.from('v_agenda').select('meu_status, confirmados')
      .eq('id', sessao.id).single()
    expect(data!.meu_status).toBeNull()
    expect(data!.confirmados).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/agenda.test.ts`
Expected: FAIL — `relation "public.v_agenda" does not exist`.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/0009_agenda.sql`:

```sql
-- security_invoker garante que a view respeite o RLS de quem consulta.
create view v_agenda with (security_invoker = true) as
select
  s.id,
  s.turma_id,
  t.nome                as turma_nome,
  s.inicia_em,
  t.duracao_min,
  s.vagas,
  s.cancelada,
  s.observacao,
  coalesce(conf.total, 0)                                  as confirmados,
  greatest(s.vagas - coalesce(conf.total, 0), 0)           as vagas_restantes,
  coalesce(esp.total, 0)                                   as na_espera,
  sessao_bloqueada(s.inicia_em)                            as bloqueada,
  meu.status                                               as meu_status,
  meu.posicao_fila                                         as minha_posicao,
  tr.titulo                                                as treino_titulo,
  tr.descricao                                             as treino_descricao,
  tr.video_url                                             as treino_video_url
from sessoes s
join turmas t on t.id = s.turma_id
left join lateral (
  select count(*) as total from checkins c
   where c.sessao_id = s.id and c.status = 'confirmado'
) conf on true
left join lateral (
  select count(*) as total from checkins c
   where c.sessao_id = s.id and c.status = 'espera'
) esp on true
left join lateral (
  select c.status, c.posicao_fila from checkins c
   where c.sessao_id = s.id and c.aluno_id = auth.uid() and c.status <> 'cancelado'
) meu on true
left join treinos tr
  on tr.data = (s.inicia_em at time zone config_texto('fuso'))::date
 and (tr.publicado_em is not null or eh_treinador());

grant select on v_agenda to authenticated;
```

- [ ] **Step 4: Aplicar e rodar**

Run: `npx supabase db reset && npm test -- tests/agenda.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_agenda.sql tests/agenda.test.ts
git commit -m "feat(db): view de agenda com status do aluno"
```

---

## Task 12: Edge Function de envio de push

**Files:**
- Create: `supabase/migrations/0010_push_cron.sql`
- Create: `supabase/functions/enviar-push/index.ts`
- Test: `tests/push.test.ts`

- [ ] **Step 1: Gerar as chaves VAPID**

Run: `npx web-push generate-vapid-keys --json`
Expected: um JSON com `publicKey` e `privateKey`. Guardar as duas — a privada **nunca** vai para o repositório.

- [ ] **Step 2: Registrar os segredos locais**

Criar `supabase/functions/.env` (já coberto pelo `.gitignore` via `.env`):

```
VAPID_PUBLIC_KEY=<publicKey gerada>
VAPID_PRIVATE_KEY=<privateKey gerada>
VAPID_SUBJECT=mailto:contato@rafuncional.app
```

- [ ] **Step 3: Escrever o teste**

`tests/push.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { admin, criarUsuario, limparDados } from './helpers/db'

describe('inscrições de push', () => {
  beforeEach(limparDados)

  it('aluno registra o próprio dispositivo', async () => {
    const aluno = await criarUsuario('aluno')
    const { error } = await aluno.cliente.from('inscricoes_push').insert({
      perfil_id: aluno.id,
      endpoint: `https://push.exemplo/${aluno.id}`,
      chaves: { p256dh: 'chave-publica', auth: 'segredo' },
    })
    expect(error).toBeNull()
  })

  it('aluno não registra dispositivo em nome de outro', async () => {
    const a1 = await criarUsuario('aluno')
    const a2 = await criarUsuario('aluno')
    const { error } = await a1.cliente.from('inscricoes_push').insert({
      perfil_id: a2.id,
      endpoint: 'https://push.exemplo/roubado',
      chaves: { p256dh: 'x', auth: 'y' },
    })
    expect(error).not.toBeNull()
  })

  it('notificação nasce com envio de push pendente', async () => {
    const aluno = await criarUsuario('aluno')
    await admin.from('notificacoes').insert({
      perfil_id: aluno.id, titulo: 'Teste', corpo: 'Corpo',
    })
    const { data } = await admin.from('notificacoes')
      .select('enviado_push_em').eq('perfil_id', aluno.id).single()
    expect(data!.enviado_push_em).toBeNull()
  })

  it('marcar_push_enviado tira a notificação da fila', async () => {
    const aluno = await criarUsuario('aluno')
    const { data: nova } = await admin.from('notificacoes')
      .insert({ perfil_id: aluno.id, titulo: 'T', corpo: 'C' }).select().single()

    await admin.rpc('marcar_push_enviado', { p_ids: [nova!.id] })

    const { data } = await admin.from('notificacoes')
      .select('enviado_push_em').eq('id', nova!.id).single()
    expect(data!.enviado_push_em).not.toBeNull()
  })
})
```

- [ ] **Step 4: Rodar para ver falhar**

Run: `npm test -- tests/push.test.ts`
Expected: FAIL — `relation "inscricoes_push" does not exist`.

- [ ] **Step 5: Escrever a migration**

`supabase/migrations/0010_push_cron.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table inscricoes_push (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis(id) on delete cascade,
  endpoint  text not null unique,
  chaves    jsonb not null,
  criado_em timestamptz not null default now()
);

create index inscricoes_push_perfil_idx on inscricoes_push (perfil_id);

alter table inscricoes_push enable row level security;

create policy inscricoes_push_proprias on inscricoes_push
  for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

create or replace function marcar_push_enviado(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_total int;
begin
  update notificacoes set enviado_push_em = now()
   where id = any(p_ids) and enviado_push_em is null;
  get diagnostics v_total = row_count;
  return v_total;
end $$;

-- Job 1: gera sessões futuras todo dia às 03:00 (mantém o projeto Supabase ativo).
select cron.schedule('gerar-sessoes', '0 6 * * *', $$ select gerar_sessoes(); $$);

-- Job 2: de hora em hora; a própria função decide se é o momento do spoiler.
select cron.schedule('publicar-treinos', '0 * * * *', $$ select publicar_treinos_semana(); $$);

-- Job 3: drena a fila de push a cada minuto.
-- HTTP fora de transação de negócio: se o envio falhar, a notificação continua na fila.
select cron.schedule(
  'enviar-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := config_texto('url_edge_functions') || '/enviar-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || config_texto('service_role_key')
               ),
    body    := '{}'::jsonb
  )
  where exists (select 1 from notificacoes where enviado_push_em is null);
  $$
);

insert into configuracoes (chave, valor) values
  ('url_edge_functions', 'http://host.docker.internal:54321/functions/v1'),
  ('service_role_key',   'definir-no-deploy')
on conflict (chave) do nothing;

-- service_role_key é segredo: remove a leitura pública liberada em 0008.
drop policy if exists config_leitura on configuracoes;
create policy config_leitura on configuracoes
  for select to authenticated
  using (eh_treinador() or chave in ('limite_bloqueio_min', 'fuso'));
```

- [ ] **Step 6: Escrever a Edge Function**

`supabase/functions/enviar-push/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

interface Notificacao {
  id: string
  perfil_id: string
  titulo: string
  corpo: string
  link: string | null
}

interface Inscricao {
  id: string
  perfil_id: string
  endpoint: string
  chaves: { p256dh: string; auth: string }
}

Deno.serve(async () => {
  const { data: pendentes, error } = await supabase
    .from('notificacoes')
    .select('id, perfil_id, titulo, corpo, link')
    .is('enviado_push_em', null)
    .order('criado_em', { ascending: true })
    .limit(100)

  if (error) return Response.json({ erro: error.message }, { status: 500 })
  if (!pendentes?.length) return Response.json({ enviadas: 0 })

  const perfis = [...new Set(pendentes.map((n: Notificacao) => n.perfil_id))]
  const { data: inscricoes } = await supabase
    .from('inscricoes_push')
    .select('id, perfil_id, endpoint, chaves')
    .in('perfil_id', perfis)

  const porPerfil = new Map<string, Inscricao[]>()
  for (const i of (inscricoes ?? []) as Inscricao[]) {
    porPerfil.set(i.perfil_id, [...(porPerfil.get(i.perfil_id) ?? []), i])
  }

  const mortas: string[] = []

  for (const n of pendentes as Notificacao[]) {
    for (const inscricao of porPerfil.get(n.perfil_id) ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: inscricao.endpoint, keys: inscricao.chaves },
          JSON.stringify({ titulo: n.titulo, corpo: n.corpo, link: n.link ?? '/' }),
        )
      } catch (e) {
        // 404/410 = inscrição expirada; o dispositivo desinstalou ou revogou.
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) mortas.push(inscricao.id)
        else console.error('falha ao enviar push', inscricao.endpoint, e)
      }
    }
  }

  if (mortas.length) {
    await supabase.from('inscricoes_push').delete().in('id', mortas)
  }

  // Marcadas como enviadas mesmo sem inscrição ativa: o sino no app é o fallback.
  await supabase.rpc('marcar_push_enviado', {
    p_ids: (pendentes as Notificacao[]).map(n => n.id),
  })

  return Response.json({ enviadas: pendentes.length, inscricoes_removidas: mortas.length })
})
```

- [ ] **Step 7: Aplicar, servir a função e rodar os testes**

Run: `npx supabase db reset && npm test -- tests/push.test.ts`
Expected: 4 passed.

- [ ] **Step 8: Verificar a Edge Function manualmente**

Run em um terminal: `npx supabase functions serve enviar-push --env-file supabase/functions/.env`
Run em outro terminal: `curl -X POST http://127.0.0.1:54321/functions/v1/enviar-push -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`
Expected: `{"enviadas":0}` quando não há notificação pendente.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0010_push_cron.sql supabase/functions/enviar-push/index.ts tests/push.test.ts
git commit -m "feat(push): edge function de envio e agendamentos pg_cron"
```

---

## Task 13: Verificação final do backend

**Files:**
- Create: `README.md`

- [ ] **Step 1: Rodar a suíte completa do zero**

Run: `npx supabase db reset && npm test`
Expected: todos os arquivos de teste passam. Anotar o total de testes.

- [ ] **Step 2: Escrever o `README.md`**

```markdown
# RA Funcional

App de gestão de turmas de treinamento funcional: check-in com regra de bloqueio,
lista de espera automática e liberação semanal dos treinos.

## Rodando localmente

Requisitos: Node 20+, Docker Desktop aberto.

```bash
npm install
npx supabase start
npm run db:env      # gera .env.test com as chaves locais
npm test
```

## Estrutura

- `supabase/migrations/` — schema e regras de negócio (Postgres)
- `supabase/functions/` — Edge Functions (Deno)
- `tests/` — testes das regras contra o Postgres local

## Decisões de arquitetura

Toda regra de negócio mora no banco, em funções `SECURITY DEFINER`. O cliente nunca
escreve direto em `checkins` — a regra de 1h e a fila de espera não são burláveis
pelo front. Ver `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md`.
```

- [ ] **Step 3: Verificar que os jobs estão agendados**

Run: `npx supabase db reset` e depois, no SQL do Studio (`http://127.0.0.1:54323`): `select jobname, schedule from cron.job;`
Expected: três linhas — `gerar-sessoes`, `publicar-treinos`, `enviar-push`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: readme com instrucoes de execucao local"
```

---

## Cobertura do spec neste plano

| Requisito do spec | Onde é implementado |
|---|---|
| 5.5 Fuso horário | Task 4 (geração), Task 11 (view) |
| 6 Modelo de dados | Tasks 3–12 |
| 7.1 Regra de bloqueio 1h | Task 5 (`sessao_bloqueada`, testes de borda 59/60/61) |
| 7.2 Lista de espera FIFO | Task 6 (`promover_da_espera`) |
| 7.3 Spoiler da semana | Task 7 (`publicar_treinos_semana`) |
| 7.4 Geração de sessões | Task 4 (`gerar_sessoes`, idempotente) |
| 7.5 Acesso por convite | Task 8 |
| 8 Segurança / RLS | Task 10 |
| 10 Notificações | Tasks 6, 7, 9 (gravação) e 12 (envio) |
| 12 Testes | Todas as tarefas, TDD |

**Fica para os planos seguintes:** telas (spec seção 9), identidade visual e design tokens (seção 11), PWA e inscrição de push no navegador (seção 10), publicação e limpeza da máquina (seção 5.4).

---

## Próximos planos

**Plano 2 — Frontend (aluno):** design tokens, shell do app, login e cadastro por convite, agenda semanal, detalhe da sessão com check-in, sino de notificações, PWA instalável e registro de push.

**Plano 3 — Frontend (treinador):** painel do dia, CRUD de turmas, CRUD de treinos, gestão de alunos e convites.

**Plano 4 — Publicação e entrega:** criação das contas com o e-mail do cliente, deploy Netlify + Supabase, configuração das chaves VAPID em produção, teste em celular real, e o script `scripts/limpar-maquina.ps1` com o checklist de segurança da seção 5.4 do spec.
