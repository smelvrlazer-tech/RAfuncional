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
