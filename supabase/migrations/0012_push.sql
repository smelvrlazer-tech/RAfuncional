-- Push (Web Push com VAPID): inscrições dos aparelhos e o job que aciona o envio.
--
-- Fluxo: toda notificação já nasce na tabela `notificacoes` dentro da transação do
-- evento de negócio (vaga liberada, aula cancelada, treinos publicados). A cada minuto o
-- job `enviar-push` chama a Edge Function `enviar-push`, que lê as pendentes
-- (enviado_push_em is null), envia pelo Web Push e as marca como enviadas. HTTP nunca
-- acontece dentro da transação de negócio: se o envio falhar, a notificação continua na
-- fila e o sino do app segue funcionando (fallback exigido pelo spec, seção 10).
--
-- Segredos NÃO ficam em tabelas comuns nem neste arquivo. A URL da função e o segredo
-- compartilhado ficam no Vault do Supabase (vault.secrets), criados uma vez à mão:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/enviar-push', 'push_url');
--   select vault.create_secret('<segredo-aleatorio>', 'push_segredo');
-- Enquanto não existirem, o job não faz nada (o app continua funcionando, só sem push).

-- ------------------------------------------------------------------ extensões
create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------------ inscrições
-- Um aparelho/navegador = um endpoint. Chaves p256dh/auth vêm do PushSubscription.
create table inscricoes_push (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis(id) on delete cascade,
  endpoint  text not null unique,
  chaves    jsonb not null,
  criado_em timestamptz not null default now()
);

create index inscricoes_push_perfil_idx on inscricoes_push (perfil_id);

alter table inscricoes_push enable row level security;

-- Escrita só pelas RPCs abaixo (como em checkins/notificacoes): o cliente só lê as próprias.
revoke all on inscricoes_push from anon, authenticated;
grant select on inscricoes_push to authenticated;

create policy inscricoes_push_proprias on inscricoes_push
  for select to authenticated
  using (perfil_id = (select auth.uid()));

-- ------------------------------------------------------------------ RPCs do aluno
-- Registra (ou reassume) este aparelho para o usuário logado. Se o mesmo aparelho já estava
-- ligado a outra conta (celular compartilhado), passa a ser da conta atual: era o que o
-- usuário acabou de pedir. Mantém no máximo 10 aparelhos por pessoa (os mais recentes).
create or replace function registrar_push(p_endpoint text, p_chaves jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_perfil uuid := auth.uid();
begin
  if v_perfil is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not tem_perfil() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2048
     or p_chaves is null or jsonb_typeof(p_chaves) <> 'object'
     or coalesce(p_chaves->>'p256dh', '') = '' or coalesce(p_chaves->>'auth', '') = '' then
    raise exception 'push_invalido' using errcode = 'P0001';
  end if;

  insert into inscricoes_push (perfil_id, endpoint, chaves)
  values (v_perfil, p_endpoint, jsonb_build_object('p256dh', p_chaves->>'p256dh', 'auth', p_chaves->>'auth'))
  on conflict (endpoint) do update
    set perfil_id = excluded.perfil_id, chaves = excluded.chaves, criado_em = now();

  delete from inscricoes_push
   where perfil_id = v_perfil
     and id not in (
       select id from inscricoes_push where perfil_id = v_perfil order by criado_em desc limit 10
     );
end $$;

-- Remove só um aparelho do próprio usuário. Devolve quantos removeu (0 ou 1).
create or replace function remover_push(p_endpoint text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_removidas int;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  delete from inscricoes_push where endpoint = p_endpoint and perfil_id = auth.uid();
  get diagnostics v_removidas = row_count;
  return v_removidas;
end $$;

revoke all on function registrar_push(text, jsonb) from public, anon;
revoke all on function remover_push(text) from public, anon;
grant execute on function registrar_push(text, jsonb) to authenticated;
grant execute on function remover_push(text) to authenticated;

-- ------------------------------------------------------------------ lado do servidor
-- Usada pela Edge Function (service_role) para tirar notificações da fila.
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

revoke all on function marcar_push_enviado(uuid[]) from public, anon, authenticated;
grant execute on function marcar_push_enviado(uuid[]) to service_role;

-- Chamada pelo pg_cron a cada minuto. Só acorda a Edge Function se há o que enviar e se o
-- Vault já tem a URL e o segredo; senão não faz nada (sem erro no log do cron).
-- search_path vazio + nomes qualificados: roda como dono e lê o Vault.
create or replace function disparar_envio_push()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url     text;
  v_segredo text;
begin
  if not exists (select 1 from public.notificacoes where enviado_push_em is null) then
    return null;
  end if;

  select decrypted_secret into v_url     from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'push_segredo';
  if v_url is null or v_segredo is null then
    return null;
  end if;

  return net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-segredo', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end $$;

revoke all on function disparar_envio_push() from public, anon, authenticated;
grant execute on function disparar_envio_push() to service_role;

-- ------------------------------------------------------------------ job
-- Idempotente, como em 0010: remove o job homônimo do próprio papel antes de reagendar.
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'enviar-push' and username = current_user
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

select cron.schedule('enviar-push', '* * * * *', 'select public.disparar_envio_push();');
