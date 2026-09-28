-- Agendamentos pg_cron: o app roda sozinho.
--   gerar-sessoes    todo dia 06:00 UTC (03:00 America/Sao_Paulo). Mantém a janela de
--                    sessões e, de quebra, acessa o banco todo dia, o que impede o
--                    Supabase free de pausar o projeto por inatividade (spec 5.2).
--   publicar-treinos de hora em hora; a própria função só age no dia/hora configurados
--                    (spoiler_dia_semana / spoiler_hora, no fuso da config) (spec 7.3).
--
-- O pg_cron do Supabase roda em UTC (cron.timezone = GMT). São Paulo não tem horário de
-- verão desde 2019, então 06:00 UTC = 03:00 local o ano todo.
--
-- Push (Edge Function, pg_net, inscricoes_push) fica para uma migration futura.

-- ------------------------------------------------------------------ extensão
-- No Supabase o pg_cron é registrado em pg_catalog (é o schema do control file dele e o
-- que a documentação do Supabase usa); os objetos em si sempre ficam no schema `cron`.
-- O papel postgres (usado pelo `db push`) pode criá-la: o supautils do Supabase a trata
-- como extensão privilegiada e roda o CREATE como superusuário.
create extension if not exists pg_cron with schema pg_catalog;

-- Falha explícita em vez de agendar nada em silêncio.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron não está habilitado. Habilite em Dashboard > Database > Extensions > pg_cron e rode a migration de novo.';
  end if;
end $$;

-- ------------------------------------------------------------------ permissões
-- O schema cron não é exposto pelo PostgREST (config: só public e graphql_public), e o
-- pg_cron não concede USAGE a public. Revogar explicitamente é defesa em profundidade:
-- sem USAGE no schema, anon/authenticated não alcançam cron.job nem cron.schedule
-- por nenhum caminho. É no-op se nunca houve concessão.
revoke all on schema cron from public, anon, authenticated;

-- ------------------------------------------------------------------ jobs
-- Idempotente: remove qualquer job homônimo do próprio papel antes de reagendar.
-- (unschedule por jobid; cron.unschedule(nome) falharia se o job não existisse.)
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
     where jobname in ('gerar-sessoes', 'publicar-treinos')
       and username = current_user
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

-- Os jobs rodam como o papel que os agendou (postgres, dono das funções). As funções
-- tiveram EXECUTE revogado de public/anon/authenticated, mas o dono continua podendo
-- executá-las. Nomes qualificados: o job não depende de search_path.
select cron.schedule('gerar-sessoes',    '0 6 * * *', 'select public.gerar_sessoes();');
select cron.schedule('publicar-treinos', '0 * * * *', 'select public.publicar_treinos_semana();');

-- ------------------------------------------------------------------ auxiliar de teste
-- cron.job não é acessível pela API; os testes inspecionam por aqui.
-- Só service_role. Pode ser removida junto com debug_hora_local quando os testes
-- de agendamento deixarem de rodar contra o projeto:
--   drop function public.debug_cron_jobs();
create or replace function debug_cron_jobs()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'jobname',  j.jobname,
               'schedule', j.schedule,
               'command',  j.command,
               'active',   j.active,
               'username', j.username
             ) order by j.jobname)
        from cron.job j
    ), '[]'::jsonb),
    'privilegios', jsonb_build_object(
      'anon_usa_cron',          has_schema_privilege('anon', 'cron', 'USAGE'),
      'authenticated_usa_cron', has_schema_privilege('authenticated', 'cron', 'USAGE'),
      'dono_jobs_executa_gerar_sessoes',
        has_function_privilege(current_user, 'public.gerar_sessoes()', 'EXECUTE'),
      'dono_jobs_executa_publicar_treinos',
        has_function_privilege(current_user, 'public.publicar_treinos_semana(timestamptz)', 'EXECUTE')
    )
  );
$$;

revoke all on function debug_cron_jobs() from public, anon, authenticated;
grant execute on function debug_cron_jobs() to service_role;

-- ------------------------------------------------------------------ primeira carga
-- Sessões existem já, sem esperar as 03:00. Só gera para turmas ativas; inofensivo se não houver.
select public.gerar_sessoes();
