-- Contagens de uma sessão, visíveis a qualquer membro.
-- Existe porque o RLS de checkins só deixa o aluno ver as PRÓPRIAS linhas: um
-- count(*) direto numa view security_invoker contaria só o próprio aluno.
-- SECURITY DEFINER lê todas as linhas, mas devolve só números agregados — nunca
-- ids ou nomes de outros alunos. Quem não é membro recebe zeros.
create or replace function contagem_checkins(p_sessao_id uuid)
returns table (total_confirmados int, total_espera int)
language sql stable security definer set search_path = public as $$
  select (count(*) filter (where c.status = 'confirmado'))::int,
         (count(*) filter (where c.status = 'espera'))::int
    from checkins c
   where c.sessao_id = p_sessao_id
     and tem_perfil();
$$;

revoke all on function contagem_checkins(uuid) from public, anon;
grant execute on function contagem_checkins(uuid) to authenticated, service_role;

-- security_invoker: a view respeita o RLS de quem consulta
-- (sessões/turmas só para membros, treino só publicado para aluno, meu_status só do próprio).
create view v_agenda with (security_invoker = true) as
select
  s.id,
  s.turma_id,
  t.nome                                                  as turma_nome,
  s.inicia_em,
  t.duracao_min,
  s.vagas,
  s.cancelada,
  s.observacao,
  cnt.total_confirmados                                   as confirmados,
  greatest(s.vagas - cnt.total_confirmados, 0)            as vagas_restantes,
  cnt.total_espera                                        as na_espera,
  sessao_bloqueada(s.inicia_em)                           as bloqueada,
  meu.status                                              as meu_status,
  meu.posicao_fila                                        as minha_posicao,
  tr.titulo                                               as treino_titulo,
  tr.descricao                                            as treino_descricao,
  tr.video_url                                            as treino_video_url
from sessoes s
join turmas t on t.id = s.turma_id
cross join lateral contagem_checkins(s.id) cnt
-- unique (sessao_id, aluno_id): no máximo uma linha
left join checkins meu
  on meu.sessao_id = s.id
 and meu.aluno_id = auth.uid()
 and meu.status <> 'cancelado'
-- unique (data): no máximo um treino por dia. O RLS de treinos já esconde
-- rascunhos do aluno; o filtro explícito é defesa em profundidade.
left join treinos tr
  on tr.data = (s.inicia_em at time zone config_texto('fuso'))::date
 and (tr.publicado_em is not null or eh_treinador());

revoke all on v_agenda from anon, authenticated;
grant select on v_agenda to authenticated;
