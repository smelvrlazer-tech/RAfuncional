create table treinos (
  id           uuid primary key default gen_random_uuid(),
  data         date not null unique,   -- o unique já cria o índice por data
  titulo       text not null,
  descricao    text not null,
  video_url    text,
  publicado_em timestamptz,            -- nulo = rascunho
  criado_em    timestamptz not null default now()
);

-- Publica os treinos da próxima semana (segunda a domingo) e avisa os alunos ativos.
-- Chamada de hora em hora pelo cron; só age no dia e hora configurados (fuso da config).
-- p_agora existe para testar qualquer dia da semana de forma determinística;
-- o cron chama sem argumento e vale o relógio do banco.
create or replace function publicar_treinos_semana(p_agora timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  v_local      timestamp := p_agora at time zone config_texto('fuso');
  v_dow        int := extract(dow from v_local)::int;
  v_inicio     date;
  v_fim        date;
  v_publicados int;
begin
  if v_dow <> config_int('spoiler_dia_semana')
     or extract(hour from v_local)::int <> config_int('spoiler_hora') then
    return 0;
  end if;

  -- Primeira segunda-feira estritamente depois de hoje:
  -- domingo +1, segunda +7, terça +6, ..., sábado +2.
  v_inicio := v_local::date + (7 - (v_dow + 6) % 7);
  v_fim    := v_inicio + 6;

  with publicados as (
    update treinos
       set publicado_em = now()
     where data between v_inicio and v_fim
       and publicado_em is null
    returning 1
  )
  select count(*) into v_publicados from publicados;

  -- Nada cadastrado: não promete conteúdo vazio.
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

-- Job interno: só o cron (dono) e o service_role. O Supabase concede EXECUTE
-- a anon/authenticated por default privileges, então é preciso revogar deles também.
revoke all on function publicar_treinos_semana(timestamptz) from public, anon, authenticated;
grant execute on function publicar_treinos_semana(timestamptz) to service_role;
