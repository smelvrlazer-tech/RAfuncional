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
-- `<=`: faltando exatamente o limite, já está bloqueada.
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

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function fazer_checkin(uuid) from public, anon;
grant execute on function fazer_checkin(uuid) to authenticated;

-- Usada depois pela view de agenda (usuários autenticados).
revoke all on function sessao_bloqueada(timestamptz) from public, anon;
grant execute on function sessao_bloqueada(timestamptz) to authenticated;
