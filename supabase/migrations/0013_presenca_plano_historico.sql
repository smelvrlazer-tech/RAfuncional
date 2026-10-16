-- Presença marcada pelo treinador, plano (aulas por semana), histórico do aluno e relatório mensal.
--
-- Decisões (Pedro, 16/10/2026):
--   * "Confirmado" continua sendo só a reserva. Depois da aula, o Rafael marca "Compareceu" ou
--     "Faltou". Reserva sem marcação, com a aula já encerrada, conta como falta (no-show) no relatório.
--   * Plano = quantas aulas por semana o aluno pode reservar. Só avisa; o banco NÃO bloqueia.
--   * Regras de check-in/cancelamento (fecha 1 h antes) e promoção automática da fila não mudam.

create type presenca_checkin as enum ('compareceu', 'faltou');

alter table checkins add column presenca presenca_checkin;
alter table perfis add column plano_aulas_semana smallint
  check (plano_aulas_semana is null or plano_aulas_semana between 1 and 14);

-- ------------------------------------------------------------------ treinador

-- Marca (ou limpa, com null) a presença de um aluno confirmado em uma aula que já começou.
create or replace function treinador_marcar_presenca(p_sessao_id uuid, p_aluno_id uuid, p_presenca presenca_checkin)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inicia timestamptz;
  v_status status_checkin;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select inicia_em into v_inicia from sessoes where id = p_sessao_id;
  if not found then
    raise exception 'sessao_inexistente' using errcode = 'P0002';
  end if;
  if v_inicia > now() then
    raise exception 'aula_nao_comecou' using errcode = 'P0001';
  end if;

  select status into v_status from checkins where sessao_id = p_sessao_id and aluno_id = p_aluno_id;
  if v_status is distinct from 'confirmado' then
    raise exception 'checkin_inexistente' using errcode = 'P0002';
  end if;

  update checkins set presenca = p_presenca, atualizado_em = now()
   where sessao_id = p_sessao_id and aluno_id = p_aluno_id;

  return jsonb_build_object('presenca', p_presenca);
end $$;

-- Plano do aluno em aulas por semana (1 a 14); null remove o plano.
create or replace function treinador_definir_plano(p_perfil_id uuid, p_aulas smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_papel papel_usuario;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if p_aulas is not null and p_aulas not between 1 and 14 then
    raise exception 'plano_invalido' using errcode = 'P0001';
  end if;

  select papel into v_papel from perfis where id = p_perfil_id for update;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  if v_papel <> 'aluno' then
    raise exception 'apenas_alunos' using errcode = 'P0001';
  end if;

  update perfis set plano_aulas_semana = p_aulas where id = p_perfil_id;
  return jsonb_build_object('id', p_perfil_id, 'plano_aulas_semana', p_aulas);
end $$;

-- Relatório do mês (fuso do estúdio): uma linha por aluno ativo, mesmo sem aulas.
--   reservas     = aulas confirmadas que já terminaram e não foram canceladas pelo treinador
--   compareceu   = marcadas "compareceu"
--   faltas       = marcadas "faltou"
--   sem_marcacao = reservas encerradas ainda sem marcação (contam como falta)
--   no_show      = faltas + sem_marcacao
create or replace function treinador_relatorio_mensal(p_ano int, p_mes int)
returns table (
  aluno_id uuid, nome text, plano_aulas_semana smallint,
  reservas int, compareceu int, faltas int, sem_marcacao int, no_show int
) language plpgsql stable security definer set search_path = public as $$
declare
  v_fuso   text := config_texto('fuso');
  v_inicio timestamptz;
  v_fim    timestamptz;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if p_mes not between 1 and 12 then
    raise exception 'mes_invalido' using errcode = 'P0001';
  end if;
  v_inicio := make_timestamp(p_ano, p_mes, 1, 0, 0, 0) at time zone v_fuso;
  v_fim    := (make_timestamp(p_ano, p_mes, 1, 0, 0, 0) + interval '1 month') at time zone v_fuso;

  return query
  select p.id, p.nome, p.plano_aulas_semana,
         count(c.id)::int,
         (count(c.id) filter (where c.presenca = 'compareceu'))::int,
         (count(c.id) filter (where c.presenca = 'faltou'))::int,
         (count(c.id) filter (where c.id is not null and c.presenca is null))::int,
         (count(c.id) filter (where c.id is not null and c.presenca is distinct from 'compareceu'))::int
    from perfis p
    left join lateral (
      select ck.id, ck.presenca
        from checkins ck
        join sessoes s on s.id = ck.sessao_id
        join turmas t on t.id = s.turma_id
       where ck.aluno_id = p.id
         and ck.status = 'confirmado'
         and not s.cancelada
         and s.inicia_em >= v_inicio and s.inicia_em < v_fim
         and s.inicia_em + make_interval(mins => t.duracao_min) <= now()
    ) c on true
   where p.papel = 'aluno' and p.ativo
   group by p.id, p.nome, p.plano_aulas_semana
   order by p.nome;
end $$;

-- ------------------------------------------------------------------ aluno

-- Aulas encerradas do próprio aluno, da mais recente para a mais antiga.
-- `marcada` = o treinador já marcou; sem marcação, `presenca` sai 'faltou' (regra do no-show).
create or replace function meu_historico(p_limite int default 60)
returns table (
  sessao_id uuid, turma_nome text, inicia_em timestamptz, duracao_min smallint,
  presenca presenca_checkin, marcada boolean
) language sql stable security definer set search_path = public as $$
  select s.id, t.nome, s.inicia_em, t.duracao_min,
         coalesce(c.presenca, 'faltou'::presenca_checkin),
         c.presenca is not null
    from checkins c
    join sessoes s on s.id = c.sessao_id
    join turmas t on t.id = s.turma_id
   where c.aluno_id = auth.uid()
     and c.status = 'confirmado'
     and not s.cancelada
     and s.inicia_em + make_interval(mins => t.duracao_min) <= now()
   order by s.inicia_em desc
   limit least(greatest(p_limite, 1), 200);
$$;

-- Plano e uso da semana corrente (segunda a domingo, fuso do estúdio).
create or replace function meu_plano()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_fuso   text := config_texto('fuso');
  v_inicio timestamptz := date_trunc('week', now() at time zone v_fuso) at time zone v_fuso;
  v_plano  smallint;
  v_usadas int;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select plano_aulas_semana into v_plano from perfis where id = auth.uid();
  select count(*)::int into v_usadas
    from checkins c join sessoes s on s.id = c.sessao_id
   where c.aluno_id = auth.uid() and c.status = 'confirmado' and not s.cancelada
     and s.inicia_em >= v_inicio and s.inicia_em < v_inicio + interval '7 days';
  return jsonb_build_object('aulas_semana', v_plano, 'usadas_semana', v_usadas);
end $$;

revoke all on function treinador_marcar_presenca(uuid, uuid, presenca_checkin) from public, anon;
revoke all on function treinador_definir_plano(uuid, smallint) from public, anon;
revoke all on function treinador_relatorio_mensal(int, int) from public, anon;
revoke all on function meu_historico(int) from public, anon;
revoke all on function meu_plano() from public, anon;
grant execute on function treinador_marcar_presenca(uuid, uuid, presenca_checkin) to authenticated;
grant execute on function treinador_definir_plano(uuid, smallint) to authenticated;
grant execute on function treinador_relatorio_mensal(int, int) to authenticated;
grant execute on function meu_historico(int) to authenticated;
grant execute on function meu_plano() to authenticated;
