create table convites (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nome_previsto text,
  status        status_convite not null default 'pendente',
  usado_por     uuid references perfis(id) on delete set null,
  expira_em     timestamptz not null default now() + interval '30 days',
  criado_em     timestamptz not null default now()
);

create or replace function criar_convite(p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
begin
  if not eh_treinador() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- 12 caracteres hexadecimais maiúsculos (48 bits aleatórios).
  -- gen_random_uuid() é nativo do Postgres (13+) e usa o gerador criptográfico;
  -- os 12 primeiros dígitos de um UUID v4 são todos aleatórios (a versão fica no 13º).
  -- Não usa gen_random_bytes: no Supabase o pgcrypto mora no schema `extensions`,
  -- fora do search_path fixado acima.
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into convites (codigo, nome_previsto) values (v_codigo, p_nome);

  return jsonb_build_object('codigo', v_codigo);
end $$;

-- Chamada por um usuário do Auth que ainda não tem perfil.
-- O papel é sempre 'aluno': o cliente não escolhe.
create or replace function aceitar_convite(p_codigo text, p_nome text, p_telefone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid := auth.uid();
  v_convite convites%rowtype;
begin
  if v_usuario is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;
  if exists (select 1 from perfis where id = v_usuario) then
    raise exception 'perfil_ja_existe' using errcode = 'P0001';
  end if;

  -- FOR UPDATE serializa dois aceites do mesmo código: o segundo espera o primeiro
  -- terminar e, ao reavaliar o WHERE, já encontra status = 'usado'.
  select * into v_convite from convites
   where codigo = p_codigo and status = 'pendente' and expira_em > now()
   for update;
  if not found then
    raise exception 'convite_invalido' using errcode = 'P0002';
  end if;

  insert into perfis (id, nome, telefone, papel, ativo)
  values (v_usuario, btrim(p_nome), p_telefone, 'aluno', true);

  update convites set status = 'usado', usado_por = v_usuario where id = v_convite.id;

  return jsonb_build_object('ok', true);
end $$;

-- O Supabase concede EXECUTE em funções novas a anon, authenticated e service_role
-- por default privileges; revogar só de public não bloqueia anon.
revoke all on function criar_convite(text) from public, anon;
revoke all on function aceitar_convite(text, text, text) from public, anon;
grant execute on function criar_convite(text) to authenticated;
grant execute on function aceitar_convite(text, text, text) to authenticated;
