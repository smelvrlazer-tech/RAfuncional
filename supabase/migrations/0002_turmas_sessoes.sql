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
