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

  -- Mesma trava de fazer_checkin/cancelar_checkin: serializa mexidas na sessão.
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

  -- Só quem estava confirmado libera vaga. promover_da_espera é revogada de
  -- authenticated, mas aqui roda como dono (SECURITY DEFINER).
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
  -- Evita avisar todo mundo duas vezes (duplo clique, reenvio).
  if v_sessao.cancelada then
    raise exception 'sessao_cancelada' using errcode = 'P0001';
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

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function treinador_remover_aluno(uuid, uuid) from public, anon;
revoke all on function treinador_cancelar_sessao(uuid, text) from public, anon;
grant execute on function treinador_remover_aluno(uuid, uuid) to authenticated;
grant execute on function treinador_cancelar_sessao(uuid, text) to authenticated;
