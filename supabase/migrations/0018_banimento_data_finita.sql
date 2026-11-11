-- Correção da 0017: o Auth (GoTrue) não entende `banned_until = 'infinity'` e respondia erro 500 ao aluno
-- desativado (o bloqueio funcionava, mas a mensagem era genérica). Com uma data bem distante ele responde
-- "user_banned", e o app mostra "Sua conta está desativada. Fale com o seu treinador."

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
     set banned_until = case when p_ativo then null else now() + interval '100 years' end
   where id = p_perfil_id;
  if not p_ativo then
    delete from auth.sessions where user_id = p_perfil_id;
  end if;

  return jsonb_build_object('id', p_perfil_id, 'ativo', p_ativo);
end $$;

-- Quem já estava bloqueado com 'infinity' passa para a data distante.
update auth.users u
   set banned_until = now() + interval '100 years'
  from perfis p
 where p.id = u.id and p.papel = 'aluno' and not p.ativo;
