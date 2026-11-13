-- Fase B (dashboards visuais): séries semanais para as barras de 8 semanas e a lista "precisa de atenção".
-- Só leitura. Regras de presença iguais às de 0013/0014: conta só aula confirmada, não cancelada e já encerrada;
-- reserva encerrada sem marcação conta como falta (no-show). Semana começa na segunda, no fuso do estúdio.

-- Aluno: as últimas N semanas (incluindo a atual), da mais antiga para a mais recente.
create or replace function meu_historico_semanal(p_semanas int default 8)
returns table (semana_inicio date, reservas int, compareceu int, faltas int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_fuso text := config_texto('fuso');
  v_sem0 date := date_trunc('week', now() at time zone v_fuso)::date;
  v_n    int  := least(greatest(coalesce(p_semanas, 8), 1), 26);
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  return query
  select g.semana::date,
         (count(c.id))::int,
         (count(c.id) filter (where c.presenca = 'compareceu'))::int,
         (count(c.id) filter (where c.id is not null and c.presenca is distinct from 'compareceu'))::int
    from (select (v_sem0 - (v_n - 1 - i) * 7) as semana from generate_series(0, v_n - 1) as i) g
    left join lateral (
      select ck.id, ck.presenca
        from checkins ck
        join sessoes s on s.id = ck.sessao_id
        join turmas t on t.id = s.turma_id
       where ck.aluno_id = auth.uid() and ck.status = 'confirmado' and not s.cancelada
         and date_trunc('week', s.inicia_em at time zone v_fuso)::date = g.semana::date
         and s.inicia_em + make_interval(mins => t.duracao_min) <= now()
    ) c on true
   group by g.semana
   order by g.semana;
end $$;

-- Professor: ocupação do estúdio nas últimas N semanas.
--   vagas = soma das vagas das aulas encerradas e não canceladas; confirmados = reservas nelas.
create or replace function treinador_estudio_semanal(p_semanas int default 8)
returns table (semana_inicio date, aulas int, vagas int, confirmados int, compareceu int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_fuso text := config_texto('fuso');
  v_sem0 date := date_trunc('week', now() at time zone v_fuso)::date;
  v_n    int  := least(greatest(coalesce(p_semanas, 8), 1), 26);
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  return query
  select g.semana::date,
         (count(x.id))::int,
         coalesce(sum(x.vagas), 0)::int,
         coalesce(sum(x.conf), 0)::int,
         coalesce(sum(x.comp), 0)::int
    from (select (v_sem0 - (v_n - 1 - i) * 7) as semana from generate_series(0, v_n - 1) as i) g
    left join lateral (
      select s.id, s.vagas::int as vagas,
             (select count(*) from checkins ck where ck.sessao_id = s.id and ck.status = 'confirmado') as conf,
             (select count(*) from checkins ck where ck.sessao_id = s.id and ck.status = 'confirmado' and ck.presenca = 'compareceu') as comp
        from sessoes s
        join turmas t on t.id = s.turma_id
       where not s.cancelada
         and date_trunc('week', s.inicia_em at time zone v_fuso)::date = g.semana::date
         and s.inicia_em + make_interval(mins => t.duracao_min) <= now()
    ) x on true
   group by g.semana
   order by g.semana;
end $$;

-- Professor: alunos ativos que merecem um contato. Motivos (podem somar):
--   faltas_30d >= 2 (inclui reservas encerradas sem marcação)  |  sem aula há mais de 14 dias (e já teve aula).
create or replace function treinador_alunos_atencao()
returns table (aluno_id uuid, nome text, faltas_30d int, dias_sem_aula int, motivo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  return query
  with base as (
    select p.id, p.nome,
           (count(ck.id) filter (where s.inicia_em >= now() - interval '30 days' and ck.presenca is distinct from 'compareceu'))::int as faltas,
           max(s.inicia_em) filter (where ck.presenca = 'compareceu') as ultima
      from perfis p
      left join checkins ck on ck.aluno_id = p.id and ck.status = 'confirmado'
      left join sessoes s on s.id = ck.sessao_id and not s.cancelada
        and s.inicia_em + interval '1 hour' <= now()
     where p.papel = 'aluno' and p.ativo
     group by p.id, p.nome
  )
  select b.id, b.nome, b.faltas,
         case when b.ultima is null then null else floor(extract(epoch from (now() - b.ultima)) / 86400)::int end,
         case
           when b.faltas >= 2 and b.ultima is not null and now() - b.ultima > interval '14 days' then 'faltas_e_afastado'
           when b.faltas >= 2 then 'faltas'
           else 'afastado'
         end
    from base b
   where b.faltas >= 2 or (b.ultima is not null and now() - b.ultima > interval '14 days')
   order by b.faltas desc, b.nome
   limit 10;
end $$;

revoke all on function meu_historico_semanal(int) from public, anon;
revoke all on function treinador_estudio_semanal(int) from public, anon;
revoke all on function treinador_alunos_atencao() from public, anon;
grant execute on function meu_historico_semanal(int) to authenticated;
grant execute on function treinador_estudio_semanal(int) to authenticated;
grant execute on function treinador_alunos_atencao() to authenticated;
