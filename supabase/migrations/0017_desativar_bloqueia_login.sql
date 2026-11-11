-- Aluno desativado não consegue mais entrar no app.
--
-- Até aqui, "desativar" só impedia novas reservas (o aluno seguia vendo a agenda). Agora a desativação
-- também bloqueia o login no Auth (`banned_until`) e encerra as sessões abertas dele; reativar libera de volta.
-- As reservas já feitas em aulas futuras continuam como estão (o professor remove na Chamada, se quiser).

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

  update auth.users
     set banned_until = case when p_ativo then null else 'infinity'::timestamptz end
   where id = p_perfil_id;
  if not p_ativo then
    delete from auth.sessions where user_id = p_perfil_id;
  end if;

  return jsonb_build_object('id', p_perfil_id, 'ativo', p_ativo);
end $$;

-- Quem já estava desativado também passa a ser bloqueado no login.
update auth.users u
   set banned_until = 'infinity'::timestamptz
  from perfis p
 where p.id = u.id and p.papel = 'aluno' and not p.ativo;
