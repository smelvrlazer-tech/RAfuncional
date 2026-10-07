---
name: ra-funcional-limpeza-maquina
description: "Ao encerrar o projeto RA Funcional, limpar Docker/node_modules da máquina local — só após verificar que tudo está no GitHub e no ar"
metadata: 
  node_type: memory
  type: project
  originSessionId: e1b641a9-7f29-4da6-b88c-a579385b7966
  modified: 2026-07-31T21:14:20.306Z
---

No projeto RA Funcional (app de check-in para o treinador Rafael Alvarenga), o desenvolvedor quer que **nada do projeto continue ocupando espaço na máquina local após a entrega**. O peso real está nas imagens/volumes Docker do Supabase local (vários GB) e em `node_modules` — o código-fonte é irrelevante em tamanho.

Entregável previsto: `scripts/limpar-maquina.ps1`, que roda um checklist de segurança e **aborta se qualquer item falhar** — git limpo, nenhum commit sem push, remoto acessível, app publicado e testado em produção, migrações aplicadas no Supabase de produção, chaves VAPID e variáveis de ambiente guardadas fora da máquina.

**Why:** o desenvolvedor pediu automação para isso, mas exclusão automática de diretório é risco desnecessário — perder trabalho não commitado para economizar um comando é péssimo negócio.

**How to apply:** lembrar dessa etapa quando o projeto for publicado. Nunca rodar a limpeza de forma agendada ou sem confirmação explícita. Detalhes completos na seção 5.4 do spec em `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md`. Ver também [[ra-funcional-contas-cliente]].
