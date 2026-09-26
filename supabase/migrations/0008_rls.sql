-- Row Level Security em todas as tabelas do schema public.
--
-- Modelo:
--   * anon (sem login) não tem privilégio nenhum em tabela nem função.
--   * authenticated recebe só os privilégios de tabela/coluna estritamente necessários;
--     as políticas decidem QUAIS linhas.
--   * Mutações de regra de negócio (checkins, notificações, criação de perfil) só
--     acontecem via funções SECURITY DEFINER, cujo dono (postgres) é dono das
--     tabelas e por isso não é filtrado pelo RLS (não usamos FORCE).
--   * service_role e postgres não são tocados.

-- ------------------------------------------------------------------ auxiliares

-- "É membro": tem linha em perfis (aluno ou treinador, ativo ou não).
-- Um usuário do Auth que ainda não aceitou convite não é membro e não lê nada.
-- SECURITY DEFINER pelo mesmo motivo de eh_treinador: consultar perfis dentro de
-- uma política de perfis sem recursão.
create or replace function tem_perfil()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid());
$$;

-- Ativar/desativar aluno. O cliente não tem UPDATE na coluna `ativo` (senão um
-- aluno desativado se reativaria), então o treinador usa esta RPC.
-- Só age sobre alunos: treinador não desativa outro treinador nem a si mesmo.
create or replace function treinador_definir_ativo(p_perfil_id uuid, p_ativo boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_papel papel_usuario;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'ativo_obrigatorio' using errcode = 'P0001';
  end if;

  select papel into v_papel from perfis where id = p_perfil_id for update;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  if v_papel <> 'aluno' then
    raise exception 'apenas_alunos' using errcode = 'P0001';
  end if;

  update perfis set ativo = p_ativo where id = p_perfil_id;

  return jsonb_build_object('id', p_perfil_id, 'ativo', p_ativo);
end $$;

-- ------------------------------------------------------------------ privilégios de tabela

-- O Supabase concede ALL (inclusive TRUNCATE, que ignora RLS) a anon e authenticated
-- por default privileges. Zera e concede só o necessário.
revoke all on all tables in schema public from anon;

revoke all on perfis, configuracoes, turmas, sessoes, checkins, treinos, convites, notificacoes
  from authenticated;

-- perfis: ninguém insere nem apaga pela API (perfil nasce em aceitar_convite).
-- `papel` e `ativo` não são editáveis pela API por ninguém.
grant select on perfis to authenticated;
grant update (nome, telefone) on perfis to authenticated;

-- configuracoes: treinador altera só o valor de chaves existentes.
grant select on configuracoes to authenticated;
grant update (valor) on configuracoes to authenticated;

-- Tabelas administradas pelo treinador (a política restringe ao treinador).
grant select, insert, update, delete on turmas   to authenticated;
grant select, insert, update, delete on sessoes  to authenticated;
grant select, insert, update, delete on treinos  to authenticated;
grant select, insert, update, delete on convites to authenticated;

-- checkins: só leitura. Toda mutação passa pelas RPCs que validam 1h, vagas e fila.
grant select on checkins to authenticated;

-- notificacoes: dono lê e só marca como lida.
grant select on notificacoes to authenticated;
grant update (lida_em) on notificacoes to authenticated;

-- ------------------------------------------------------------------ RLS

alter table perfis        enable row level security;
alter table configuracoes enable row level security;
alter table turmas        enable row level security;
alter table sessoes       enable row level security;
alter table checkins      enable row level security;
alter table treinos       enable row level security;
alter table convites      enable row level security;
alter table notificacoes  enable row level security;

-- `(select f())` faz o Postgres avaliar a função uma vez por consulta, não por linha.

-- perfis
create policy perfis_leitura on perfis
  for select to authenticated
  using (id = (select auth.uid()) or (select eh_treinador()));

create policy perfis_edicao on perfis
  for update to authenticated
  using (id = (select auth.uid()) or (select eh_treinador()))
  with check (id = (select auth.uid()) or (select eh_treinador()));

-- configuracoes: lista de chaves liberadas (allow-list) para quem não é treinador.
-- Chaves novas (ex.: segredos do push) nascem invisíveis ao aluno.
create policy config_leitura on configuracoes
  for select to authenticated
  using (
    (select eh_treinador())
    or ((select tem_perfil())
        and chave in ('limite_bloqueio_min', 'fuso', 'spoiler_dia_semana', 'spoiler_hora'))
  );

create policy config_escrita on configuracoes
  for update to authenticated
  using ((select eh_treinador()))
  with check ((select eh_treinador()));

-- turmas e sessoes: membros leem, só o treinador escreve
create policy turmas_leitura on turmas
  for select to authenticated using ((select tem_perfil()));
create policy turmas_treinador on turmas
  for all to authenticated
  using ((select eh_treinador())) with check ((select eh_treinador()));

create policy sessoes_leitura on sessoes
  for select to authenticated using ((select tem_perfil()));
create policy sessoes_treinador on sessoes
  for all to authenticated
  using ((select eh_treinador())) with check ((select eh_treinador()));

-- checkins: aluno lê só o próprio; treinador lê todos. Sem política de escrita.
create policy checkins_leitura on checkins
  for select to authenticated
  using (aluno_id = (select auth.uid()) or (select eh_treinador()));

-- treinos: membros veem só publicados; treinador vê e escreve tudo
create policy treinos_leitura on treinos
  for select to authenticated
  using (publicado_em is not null and (select tem_perfil()));
create policy treinos_treinador on treinos
  for all to authenticated
  using ((select eh_treinador())) with check ((select eh_treinador()));

-- convites: exclusivo do treinador (aceitar_convite/criar_convite são SECURITY DEFINER)
create policy convites_treinador on convites
  for all to authenticated
  using ((select eh_treinador())) with check ((select eh_treinador()));

-- notificacoes: só o dono lê e marca como lida (coluna lida_em, pelo grant acima)
create policy notificacoes_leitura on notificacoes
  for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy notificacoes_marcar_lida on notificacoes
  for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));

-- ------------------------------------------------------------------ privilégios de função
-- O Supabase concede EXECUTE a anon, authenticated e service_role em toda função nova.
-- Aqui fica o inventário completo do schema public, revogado de public/anon.

-- Jobs e auxiliares de teste: só service_role (e o dono, via cron).
revoke all on function gerar_sessoes()     from public, anon, authenticated;
revoke all on function debug_hora_local()  from public, anon, authenticated;
grant execute on function gerar_sessoes()    to service_role;
grant execute on function debug_hora_local() to service_role;

-- Auxiliares usadas em políticas e na view (executam com o papel de quem consulta).
-- config_int/config_texto são SECURITY INVOKER de propósito: respeitam o RLS de
-- configuracoes, então um aluno só obtém chaves da allow-list.
revoke all on function eh_treinador()                    from public, anon;
revoke all on function tem_perfil()                      from public, anon;
revoke all on function config_int(text)                  from public, anon;
revoke all on function config_texto(text)                from public, anon;
revoke all on function sessao_bloqueada(timestamptz)     from public, anon;
grant execute on function eh_treinador()                 to authenticated, service_role;
grant execute on function tem_perfil()                   to authenticated, service_role;
grant execute on function config_int(text)               to authenticated, service_role;
grant execute on function config_texto(text)             to authenticated, service_role;
grant execute on function sessao_bloqueada(timestamptz)  to authenticated, service_role;

-- Nova RPC do treinador (valida o papel por dentro).
revoke all on function treinador_definir_ativo(uuid, boolean) from public, anon;
grant execute on function treinador_definir_ativo(uuid, boolean) to authenticated;

-- Reafirma as revogações das migrations anteriores (idempotente).
revoke all on function fazer_checkin(uuid)                      from public, anon;
revoke all on function cancelar_checkin(uuid)                   from public, anon;
revoke all on function criar_convite(text)                      from public, anon;
revoke all on function aceitar_convite(text, text, text)        from public, anon;
revoke all on function treinador_remover_aluno(uuid, uuid)      from public, anon;
revoke all on function treinador_cancelar_sessao(uuid, text)    from public, anon;
revoke all on function promover_da_espera(uuid)                 from public, anon, authenticated;
revoke all on function publicar_treinos_semana(timestamptz)     from public, anon, authenticated;
