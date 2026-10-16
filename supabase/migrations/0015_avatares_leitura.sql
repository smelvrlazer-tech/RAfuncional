-- O upload com upsert (e a remoção) do Storage precisa também de política de SELECT no bucket.
-- Sem ela, "avatares_insercao" é barrada pelo RLS mesmo no arquivo da própria pessoa.
-- O bucket já é público para leitura pelo endereço da foto; aqui só liberamos a consulta da API.
create policy avatares_leitura on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares');
