-- Recuperação de senha pelo professor: ele gera uma senha provisória para o aluno, o aluno entra com
-- ela e é obrigado a criar uma senha própria antes de usar o app.
--
-- A senha provisória é sorteada no banco, devolvida uma única vez ao treinador e gravada só como
-- hash (bcrypt), como qualquer senha do Auth. As sessões abertas do aluno são encerradas.

alter table perfis add column trocar_senha boolean not null default false;

create or replace function treinador_redefinir_senha(p_aluno_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_papel papel_usuario;
  v_senha text;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select papel into v_papel from perfis where id = p_aluno_id for update;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  if v_papel <> 'aluno' then
    raise exception 'apenas_alunos' using errcode = 'P0001';
  end if;

  -- 10 caracteres sem letras/números ambíguos (l, I, O, 0, 1) para ditar ou digitar sem erro.
  v_senha := substr(translate(encode(gen_random_bytes(18), 'base64'), '+/=lIO01', ''), 1, 10);

  update auth.users
     set encrypted_password = crypt(v_senha, gen_salt('bf')), updated_at = now()
   where id = p_aluno_id;
  if not found then
    raise exception 'usuario_inexistente' using errcode = 'P0002';
  end if;

  delete from auth.sessions where user_id = p_aluno_id;
  update perfis set trocar_senha = true where id = p_aluno_id;

  return jsonb_build_object('senha_provisoria', v_senha);
end $$;

-- O aluno chama depois de trocar a senha pelo Auth (updateUser): libera o uso normal do app.
create or replace function concluir_troca_senha()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  update perfis set trocar_senha = false where id = auth.uid();
end $$;

revoke all on function treinador_redefinir_senha(uuid) from public, anon;
revoke all on function concluir_troca_senha() from public, anon;
grant execute on function treinador_redefinir_senha(uuid) to authenticated;
grant execute on function concluir_troca_senha() to authenticated;
