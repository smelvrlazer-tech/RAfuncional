-- PROPOSTA de migration (NÃO aplicada; não está em supabase/migrations/).
-- Sugestão de nome ao adotar: supabase/migrations/0011_treinador_atualizar_turma.sql
--
-- Problema encontrado ao construir a tela Turmas do painel do treinador:
--   * gerar_sessoes() só INSERE (on conflict (turma_id, inicia_em) do nothing) e é service_role.
--   * sessoes.vagas é copiado da turma na geração.
--   Logo, se o treinador mudar dia/horário de uma turma pela API, as ~4 semanas de aulas já
--   geradas continuam no horário antigo E a próxima geração cria outra aula no horário novo
--   (aulas duplicadas). Mudar `vagas` também não chega às aulas já geradas.
--   A spec (7.4) pede: "Alterar uma turma afeta apenas sessões futuras que ainda não têm
--   check-in. Sessões com check-in existente são preservadas e sinalizadas ao Rafael."
--
-- Enquanto isso não existir, o front (FormTurma) TRAVA dia e horário na edição e explica
-- que, para mudar o horário, o treinador desativa a turma e cria outra (as aulas já
-- geradas ficam até ele cancelá-las). Nome e duração já valem na hora (v_agenda faz join
-- com turmas); vagas valem para as próximas gerações.
--
-- Com esta RPC, o front pode liberar a edição de dia/horário/vagas chamando
--   supabase.rpc('treinador_atualizar_turma', {...})
-- e mostrar ao treinador as aulas preservadas (com check-in) que precisam de atenção.

create or replace function treinador_atualizar_turma(
  p_turma_id    uuid,
  p_nome        text,
  p_dia_semana  smallint,
  p_hora_inicio time,
  p_duracao_min smallint,
  p_vagas       smallint
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_removidas   int;
  v_criadas     int;
  v_preservadas jsonb;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;

  perform 1 from turmas where id = p_turma_id for update;
  if not found then
    raise exception 'turma_inexistente' using errcode = 'P0002';
  end if;

  -- Trava TODAS as aulas futuras da turma antes de decidir quais apagar: fazer_checkin
  -- também faz SELECT ... FOR UPDATE na sessão, então um check-in concorrente ou termina
  -- antes (e o DELETE abaixo, em outro comando/snapshot, enxerga o check-in) ou espera.
  -- Sem isso, o DELETE poderia apagar (em cascata) um check-in feito no meio do caminho.
  perform 1 from sessoes
   where turma_id = p_turma_id and inicia_em > now()
   for update;

  update turmas
     set nome = btrim(p_nome), dia_semana = p_dia_semana, hora_inicio = p_hora_inicio,
         duracao_min = p_duracao_min, vagas = p_vagas
   where id = p_turma_id;

  -- Aulas futuras, não canceladas, sem ninguém confirmado ou na fila: são recriadas.
  with apagadas as (
    delete from sessoes s
     where s.turma_id = p_turma_id
       and s.inicia_em > now()
       and not s.cancelada
       and not exists (
         select 1 from checkins c
          where c.sessao_id = s.id and c.status in ('confirmado', 'espera'))
    returning 1
  )
  select count(*) into v_removidas from apagadas;

  -- Aulas futuras que ficaram (têm check-in ativo): preservadas e devolvidas ao treinador.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'inicia_em', s.inicia_em,
           'ativos', (select count(*) from checkins c
                       where c.sessao_id = s.id and c.status in ('confirmado', 'espera')))
           order by s.inicia_em), '[]'::jsonb)
    into v_preservadas
    from sessoes s
   where s.turma_id = p_turma_id and s.inicia_em > now() and not s.cancelada;

  -- Regera a janela no novo dia/horário (roda como dono; gerar_sessoes é idempotente).
  -- Obs.: uma aula preservada no horário ANTIGO convive com a nova no horário novo daquela
  -- semana; é exatamente o caso "sinalizado ao Rafael" pela lista `preservadas`.
  v_criadas := gerar_sessoes();

  return jsonb_build_object(
    'removidas', v_removidas,
    'criadas', v_criadas,
    'preservadas', v_preservadas
  );
end $$;

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function treinador_atualizar_turma(uuid, text, smallint, time, smallint, smallint) from public, anon;
grant execute on function treinador_atualizar_turma(uuid, text, smallint, time, smallint, smallint) to authenticated;

-- Testes sugeridos (tests/ na raiz, contra o Postgres real):
--   1. aluno chama -> acesso_negado.
--   2. turma com 4 aulas futuras sem check-in, muda 06:00 -> 07:00: removidas=4, as novas
--      aulas saem às 07:00 (hora local SP), nenhuma às 06:00.
--   3. uma das aulas tem check-in confirmado: ela é preservada (preservadas[0].ativos = 1)
--      e o check-in continua existindo.
--   4. aula cancelada no futuro não é apagada (histórico do cancelamento/avisos).
--   5. mudar só vagas: aulas sem check-in são recriadas com as vagas novas.
