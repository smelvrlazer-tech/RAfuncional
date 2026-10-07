---
name: ra-funcional-repositorio-github
description: "Onde o código do RA Funcional está no GitHub e o que não viaja no clone (segredos, memória)"
metadata:
  node_type: memory
  type: reference
  originSessionId: e1b641a9-7f29-4da6-b88c-a579385b7966
  modified: 2026-10-07T17:33:54.307Z
---

Repositório privado: https://github.com/smelvrlazer-tech/RAfuncional (conta GitHub do Pedro; remoto `origin`, branch `main`). Criado em 07/10/2026 para continuar em outra máquina.

Em texto puro ficam fora do git: `.env.test`, `web/.env.local`, `web/.dev-credenciais.txt`, `.claude/settings.local.json`. Os três primeiros vão no repositório criptografados em `segredos.7z` (senha só com o Pedro); restaurar com `scripts/restaurar-segredos.ps1`. Esta pasta de memória também não sincroniza entre máquinas (cópia em `docs/memoria/`).

Ao transferir para o e-mail do Rafael, ver [[ra-funcional-contas-cliente]].
