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
-- O FOR UPDATE é reentrante para quem já trava a sessão (cancelar_checkin,
-- treinador_remover_aluno) e protege chamadas diretas (service_role) de
-- correr contra um fazer_checkin simultâneo.
create or replace function promover_da_espera(p_sessao_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sessao      sessoes%rowtype;
  v_confirmados int;
  v_prox        checkins%rowtype;
begin
  select * into v_sessao from sessoes where id = p_sessao_id for update;
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

  -- FOR UPDATE serializa cancelamentos e check-ins concorrentes na mesma sessão.
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

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function cancelar_checkin(uuid) from public, anon;
grant execute on function cancelar_checkin(uuid) to authenticated;

-- Auxiliar interna: só outras funções SECURITY DEFINER (executando como dono)
-- e o service_role (jobs/testes) podem chamá-la.
revoke all on function promover_da_espera(uuid) from public, anon, authenticated;
grant execute on function promover_da_espera(uuid) to service_role;
