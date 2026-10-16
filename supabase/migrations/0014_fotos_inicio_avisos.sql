-- Fotos de perfil, "quem vai", aviso do treinador e métricas do início do aluno.
--
-- Decisões (Pedro, 16/10/2026): o design do Stitch passa a valer inteiro. Isso inclui nome e foto
-- do treinador nos cartões, lista de colegas confirmados na aula, meta do trimestre com nível
-- (Bronze/Prata/Ouro), constância do mês e a "nota do treinador" (aviso para todos os alunos).

-- ------------------------------------------------------------------ foto de perfil

alter table perfis add column foto_url text;
grant update (foto_url) on perfis to authenticated;

-- Bucket público (as fotos aparecem para colegas e treinador). Cada pessoa grava só o próprio
-- arquivo, que se chama <id do usuário>.jpg; o app reduz a imagem antes de enviar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

create policy avatares_insercao on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and name = (select auth.uid())::text || '.jpg');
create policy avatares_troca on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and name = (select auth.uid())::text || '.jpg')
  with check (bucket_id = 'avatares' and name = (select auth.uid())::text || '.jpg');
create policy avatares_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and name = (select auth.uid())::text || '.jpg');

-- ------------------------------------------------------------------ avisos do treinador

create table avisos (
  id        uuid primary key default gen_random_uuid(),
  texto     text not null check (char_length(texto) between 1 and 300),
  criado_em timestamptz not null default now()
);
alter table avisos enable row level security;
revoke all on avisos from anon, authenticated;
grant select on avisos to authenticated;
create policy avisos_leitura on avisos for select to authenticated using ((select tem_perfil()));

-- Envia o aviso a todos os alunos ativos (notificação + push, pelo fluxo normal de notificacoes).
create or replace function treinador_enviar_aviso(p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_texto text := btrim(coalesce(p_texto, ''));
  v_n     int;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if char_length(v_texto) not between 1 and 300 then
    raise exception 'aviso_invalido' using errcode = 'P0001';
  end if;

  insert into avisos (texto) values (v_texto);
  with novas as (
    insert into notificacoes (perfil_id, titulo, corpo, link)
    select id, 'Aviso do treinador', v_texto, '/'
      from perfis where papel = 'aluno' and ativo
    returning 1
  )
  select count(*) into v_n from novas;

  return jsonb_build_object('enviados', v_n);
end $$;

-- Último aviso dos últimos 7 dias (ou null), com nome e foto do treinador.
create or replace function ultimo_aviso()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_aviso avisos%rowtype;
begin
  if not tem_perfil() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  select * into v_aviso from avisos where criado_em > now() - interval '7 days'
   order by criado_em desc limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object('texto', v_aviso.texto, 'criado_em', v_aviso.criado_em);
end $$;

-- ------------------------------------------------------------------ estúdio e "quem vai"

-- Nome e foto do treinador (o aluno não lê a tabela de perfis).
create or replace function info_estudio()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_t perfis%rowtype;
begin
  if not tem_perfil() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  select * into v_t from perfis where papel = 'treinador' and ativo order by criado_em limit 1;
  return jsonb_build_object('treinador_nome', v_t.nome, 'treinador_foto_url', v_t.foto_url);
end $$;

-- Colegas confirmados em uma aula (nome e foto), em ordem alfabética.
create or replace function quem_vai(p_sessao_id uuid)
returns table (aluno_id uuid, nome text, foto_url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not tem_perfil() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  return query
  select p.id, p.nome, p.foto_url
    from checkins c join perfis p on p.id = c.aluno_id
   where c.sessao_id = p_sessao_id and c.status = 'confirmado'
   order by p.nome;
end $$;

-- ------------------------------------------------------------------ métricas do aluno

-- Mês corrente, trimestre e sequência de semanas. Só conta presença marcada pelo treinador
-- como "compareceu"; semana com falta marcada quebra a sequência; semana sem marcação é neutra.
create or replace function meu_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_fuso     text := config_texto('fuso');
  v_agora    timestamp := now() at time zone v_fuso;
  v_mes_ini  timestamptz := date_trunc('month', v_agora) at time zone v_fuso;
  v_tri_ini  timestamptz := date_trunc('quarter', v_agora) at time zone v_fuso;
  v_plano    smallint;
  v_reservas int; v_compareceu int; v_tri int;
  v_semana   date := date_trunc('week', v_agora)::date;
  v_streak   int := 0;
  v_ok       boolean;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select plano_aulas_semana into v_plano from perfis where id = auth.uid();

  with minhas as (
    select s.inicia_em, c.presenca
      from checkins c
      join sessoes s on s.id = c.sessao_id
      join turmas t on t.id = s.turma_id
     where c.aluno_id = auth.uid() and c.status = 'confirmado' and not s.cancelada
       and s.inicia_em + make_interval(mins => t.duracao_min) <= now()
  )
  select count(*) filter (where inicia_em >= v_mes_ini),
         count(*) filter (where inicia_em >= v_mes_ini and presenca = 'compareceu'),
         count(*) filter (where inicia_em >= v_tri_ini and presenca = 'compareceu')
    into v_reservas, v_compareceu, v_tri
    from minhas;

  -- Sequência: semanas seguidas (a semana atual ainda em andamento não quebra a conta).
  for i in 0..104 loop
    select exists (
             select 1 from checkins c join sessoes s on s.id = c.sessao_id
              where c.aluno_id = auth.uid() and c.status = 'confirmado' and c.presenca = 'compareceu'
                and date_trunc('week', s.inicia_em at time zone v_fuso)::date = v_semana)
           and not exists (
             select 1 from checkins c join sessoes s on s.id = c.sessao_id
              where c.aluno_id = auth.uid() and c.status = 'confirmado' and c.presenca = 'faltou'
                and date_trunc('week', s.inicia_em at time zone v_fuso)::date = v_semana)
      into v_ok;
    if v_ok then
      v_streak := v_streak + 1;
    elsif i > 0 then
      exit;
    end if;
    v_semana := v_semana - 7;
  end loop;

  return jsonb_build_object(
    'reservas_mes', v_reservas,
    'compareceu_mes', v_compareceu,
    'compareceu_trimestre', v_tri,
    'meta_trimestre', coalesce(v_plano, 3) * 13,
    'plano_aulas_semana', v_plano,
    'semanas_seguidas', v_streak
  );
end $$;

revoke all on function treinador_enviar_aviso(text) from public, anon;
revoke all on function ultimo_aviso() from public, anon;
revoke all on function info_estudio() from public, anon;
revoke all on function quem_vai(uuid) from public, anon;
revoke all on function meu_painel() from public, anon;
grant execute on function treinador_enviar_aviso(text) to authenticated;
grant execute on function ultimo_aviso() to authenticated;
grant execute on function info_estudio() to authenticated;
grant execute on function quem_vai(uuid) to authenticated;
grant execute on function meu_painel() to authenticated;
