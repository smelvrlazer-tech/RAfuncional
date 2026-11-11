-- Foto de capa do estúdio: o professor envia uma imagem (arquivo capa.jpg no bucket público `avatares`)
-- que aparece ao fundo dos destaques do app dos alunos. Só o treinador grava, troca ou remove.
-- A leitura já é pública (bucket público) e a consulta pela API já tem política (0015).

create policy capa_insercao on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and name = 'capa.jpg' and (select eh_treinador()));
create policy capa_troca on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and name = 'capa.jpg' and (select eh_treinador()))
  with check (bucket_id = 'avatares' and name = 'capa.jpg' and (select eh_treinador()));
create policy capa_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and name = 'capa.jpg' and (select eh_treinador()));
