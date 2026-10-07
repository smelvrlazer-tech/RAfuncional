---
name: ra-funcional-contas-cliente
description: "Contas do projeto RA Funcional (GitHub, Supabase, Netlify) devem ficar no e-mail do cliente Rafael, não no do desenvolvedor"
metadata: 
  node_type: memory
  type: project
  originSessionId: e1b641a9-7f29-4da6-b88c-a579385b7966
  modified: 2026-07-31T21:14:31.087Z
---

No projeto RA Funcional, todas as contas de serviço (GitHub privado, Supabase, Netlify) devem ser criadas **com o e-mail do cliente Rafael Alvarenga**, não com o e-mail do desenvolvedor. Em 31/07/2026 esse e-mail ainda não havia sido obtido, e o desenvolvimento seguiu 100% local (Supabase via CLI/Docker, `git init` sem remoto).

Restrição central do projeto: **custo zero** para o cliente — criação, implantação e operação. Nenhum serviço pago, nenhum domínio pago no v1 (subdomínio gratuito da Netlify).

**Why:** evita a migração dolorosa de transferir projeto Supabase entre organizações e repositório entre contas depois. Vercel foi descartada porque o plano Hobby proíbe uso comercial nos termos de serviço, e o app atende um negócio que cobra mensalidade.

**How to apply:** ao chegar a hora de publicar, confirmar o e-mail antes de criar qualquer conta. Alternativa recomendada ao desenvolvedor: criar um e-mail dedicado ao projeto e repassar a senha na entrega. Ver também [[ra-funcional-limpeza-maquina]].
