-- Editar uma turma (dia, horário, vagas, nome, duração) sem deixar aulas velhas nem duplicadas.
--
-- Problema: gerar_sessoes() só INSERE (on conflict (turma_id, inicia_em) do nothing) e copia
-- `vagas` da turma. Mudar dia/horário direto na tabela deixava as ~4 semanas já geradas no
-- horário antigo e a geração seguinte criava outra aula no horário novo (duplicadas).
--
-- Spec 7.4: "Alterar uma turma afeta apenas sessões futuras que ainda não têm check-in.
-- Sessões com check-in existente são preservadas e sinalizadas ao Rafael."
--
-- Decisões (em relação à proposta docs/superpowers/proposals/2026-09-26-...sql):
--   * As aulas futuras sem check-in ativo são ATUALIZADAS no lugar (inicia_em/vagas), não
--     apagadas e recriadas: o id da aula não muda (links de notificação continuam valendo) e o
--     histórico de check-ins cancelados/remoções do treinador (spec 7.1) não some em cascata.
--     Uma edição só de nome/duração/vagas não mexe em horário nenhum.
--   * Mapeamento: cada aula vai para a próxima ocorrência do novo dia da semana a partir da
--     própria data (0 a 6 dias depois; mesmo dia se só o horário mudou), no novo horário,
--     calculado na hora local de config 'fuso' (America/Sao_Paulo); inicia_em é timestamptz.
--     Nunca vai para uma data anterior. Só apaga uma aula sem check-in ativo quando o destino
--     já passou (mesmo dia, horário mais cedo que agora), já está ocupado por outra aula da
--     turma (preservada, cancelada ou já no horário novo) ou quando duas aulas cairiam no
--     mesmo destino — nunca há violação de unique (turma_id, inicia_em) no meio do caminho.
--     A última aula pode ficar até 6 dias além da janela de geração; é inofensivo.
--   * "Com check-in" = alguém 'confirmado' ou 'espera'. Essas aulas ficam intactas (horário e
--     vagas) e voltam em `preservadas` só quando ficaram diferentes da turma nova.
--   * Canceladas ficam intactas; se o horário mudou, voltam em `canceladas` (a geração pode
--     criar a aula no horário novo naquela semana; o treinador decide se cancela de novo).
--   * Concorrência: um mutex (advisory lock transacional) serializa esta RPC e gerar_sessoes()
--     (que ganha o mesmo lock abaixo), então o job diário nunca insere uma aula no horário
--     antigo no meio da edição. Todas as aulas futuras da turma são travadas (FOR UPDATE) num
--     comando e só DEPOIS, em comandos seguintes (snapshot novo, READ COMMITTED), decidimos o
--     que mover/apagar, sempre restrito aos ids travados. fazer_checkin, cancelar_checkin e
--     treinador_remover_aluno travam a sessão antes de mexer em checkins, então: ou o check-in
--     terminou antes (e é visto: a aula é preservada) ou ele espera e roda depois, já sobre a
--     aula movida/atualizada (ou recebe sessao_inexistente se ela foi apagada). Um check-in
--     nunca é apagado nem movido junto com a aula.
--   * Validação no servidor com códigos próprios (turma_*), além dos CHECKs da tabela.
--   * Direto na tabela, o treinador deixa de poder mudar dia_semana/hora_inicio (privilégio
--     de coluna): mudar horário só pela RPC. nome, duração, vagas e ativa seguem editáveis.

-- ------------------------------------------------------------------ gerar_sessoes com mutex
-- Mesmo corpo de 0002, mais o lock. Como a função é VOLATILE, o INSERT abaixo tira um
-- snapshot novo depois de obter o lock e enxerga a turma já editada.
-- CREATE OR REPLACE mantém dono e privilégios (só service_role e o dono executam).
create or replace function gerar_sessoes()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_fuso    text := config_texto('fuso');
  v_semanas int  := config_int('janela_geracao_semanas');
  v_hoje    date := (now() at time zone v_fuso)::date;
  v_fim     date := v_hoje + (v_semanas * 7);
  v_criadas int  := 0;
begin
  perform pg_advisory_xact_lock(hashtext('public.gerar_sessoes'));

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

-- ------------------------------------------------------------------ RPC do treinador
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
  v_fuso          text;
  v_turma         turmas%rowtype;
  v_mudou_horario boolean;
  v_ids           uuid[];
  v_apagar        uuid[];
  v_mover_ids     uuid[];
  v_mover_alvos   timestamptz[];
  v_movidas       int;
  v_removidas     int;
  v_atualizadas   int;
  v_criadas       int;
  v_preservadas   jsonb;
  v_canceladas    jsonb;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'turma_nome_obrigatorio' using errcode = 'P0001';
  end if;
  if p_dia_semana is null or p_dia_semana not between 0 and 6 then
    raise exception 'turma_dia_invalido' using errcode = 'P0001';
  end if;
  if p_hora_inicio is null then
    raise exception 'turma_hora_obrigatoria' using errcode = 'P0001';
  end if;
  if p_duracao_min is null or p_duracao_min <= 0 then
    raise exception 'turma_duracao_invalida' using errcode = 'P0001';
  end if;
  if p_vagas is null or p_vagas <= 0 then
    raise exception 'turma_vagas_invalidas' using errcode = 'P0001';
  end if;

  -- Mutex com gerar_sessoes() (job diário) e com outra edição simultânea.
  perform pg_advisory_xact_lock(hashtext('public.gerar_sessoes'));

  select * into v_turma from turmas where id = p_turma_id for update;
  if not found then
    raise exception 'turma_inexistente' using errcode = 'P0002';
  end if;

  v_fuso := config_texto('fuso');
  v_mudou_horario := v_turma.dia_semana <> p_dia_semana or v_turma.hora_inicio <> p_hora_inicio;

  -- 1) Trava todas as aulas futuras da turma. Quem estiver no meio de um check-in termina
  --    antes (e o comando seguinte enxerga o check-in) ou espera este commit.
  select coalesce(array_agg(id), '{}') into v_ids
    from (select id from sessoes
           where turma_id = p_turma_id and inicia_em > now()
           order by id
             for update) travadas;

  -- 2) Plano, com snapshot novo, só sobre as aulas travadas.
  with base as (
    select s.id, s.inicia_em, s.vagas, s.cancelada,
           (select count(*) from checkins c
             where c.sessao_id = s.id and c.status = 'confirmado')::int as confirmados,
           (select count(*) from checkins c
             where c.sessao_id = s.id and c.status = 'espera')::int     as na_espera,
           -- Próxima ocorrência do novo dia (0 a 6 dias depois da data local atual da aula),
           -- no novo horário local, convertida de volta para timestamptz.
           case when v_mudou_horario then
             ((((s.inicia_em at time zone v_fuso)::date
                + ((p_dia_semana - extract(dow from (s.inicia_em at time zone v_fuso))::int + 7) % 7))
               + p_hora_inicio) at time zone v_fuso)
           else s.inicia_em end as novo
      from sessoes s
     where s.id = any(v_ids)
  ),
  movel as (
    select * from base where not cancelada and confirmados + na_espera = 0
  ),
  plano as (
    select m.id, m.inicia_em, m.novo,
           (m.novo <= now()
            -- duas aulas no mesmo alvo: fica a que já está lá, senão a mais antiga
            or row_number() over (partition by m.novo
                                  order by (m.inicia_em = m.novo) desc, m.inicia_em, m.id) > 1
            -- alvo ocupado por aula que não se move (com check-in, cancelada, fora da trava)
            or exists (select 1 from sessoes o
                        where o.turma_id = p_turma_id and o.inicia_em = m.novo
                          and o.id not in (select id from movel))) as apagar
      from movel m
  )
  select
    (select coalesce(array_agg(id order by id), '{}') from plano where apagar),
    (select coalesce(array_agg(id order by id), '{}') from plano where not apagar),
    (select coalesce(array_agg(novo order by id), '{}') from plano where not apagar),
    (select count(*) from plano where not apagar and novo <> inicia_em),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', id, 'inicia_em', inicia_em, 'vagas', vagas,
              'confirmados', confirmados, 'na_espera', na_espera) order by inicia_em), '[]'::jsonb)
       from base
      where not cancelada and confirmados + na_espera > 0
        and (novo <> inicia_em or vagas <> p_vagas)),
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'inicia_em', inicia_em)
              order by inicia_em), '[]'::jsonb)
       from base where cancelada and novo <> inicia_em)
  into v_apagar, v_mover_ids, v_mover_alvos, v_movidas, v_preservadas, v_canceladas;

  -- 3) Sem check-in ativo e sem destino possível. Os ids estão travados por nós: nenhum
  --    check-in novo pode ter entrado nelas desde o plano.
  delete from sessoes where id = any(v_apagar);
  get diagnostics v_removidas = row_count;

  -- 4) Move para o novo dia/horário e aplica as vagas novas, preservando o id.
  update sessoes s
     set inicia_em = u.novo, vagas = p_vagas
    from unnest(v_mover_ids, v_mover_alvos) as u(id, novo)
   where s.id = u.id
     and (s.inicia_em <> u.novo or s.vagas <> p_vagas);
  get diagnostics v_atualizadas = row_count;

  update turmas
     set nome = btrim(p_nome), dia_semana = p_dia_semana, hora_inicio = p_hora_inicio,
         duracao_min = p_duracao_min, vagas = p_vagas
   where id = p_turma_id
  returning * into v_turma;

  -- 5) Completa a janela no horário novo (roda como dono; idempotente).
  perform gerar_sessoes();
  -- criado_em default now() = início desta transação: só as aulas criadas agora.
  select count(*) into v_criadas
    from sessoes where turma_id = p_turma_id and criado_em = now();

  return jsonb_build_object(
    'turma',       to_jsonb(v_turma),
    'movidas',     v_movidas,
    'atualizadas', v_atualizadas,
    'removidas',   v_removidas,
    'criadas',     v_criadas,
    'preservadas', v_preservadas,
    'canceladas',  v_canceladas
  );
end $$;

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function treinador_atualizar_turma(uuid, text, smallint, time, smallint, smallint) from public, anon;
grant execute on function treinador_atualizar_turma(uuid, text, smallint, time, smallint, smallint) to authenticated;

-- ------------------------------------------------------------------ turmas: horário só pela RPC
-- UPDATE direto em dia_semana/hora_inicio recriaria o bug das aulas duplicadas.
-- O RLS (turmas_treinador) continua decidindo QUEM escreve; aqui só O QUÊ.
revoke update on turmas from authenticated;
grant update (nome, duracao_min, vagas, ativa) on turmas to authenticated;
