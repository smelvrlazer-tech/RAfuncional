---
name: ra-funcional-fonte-do-design
description: "A fonte da verdade visual do RA Funcional é o projeto no Claude Design (claude.ai/design/p/35b063ba-...), que evolui sem passar pela sessão de código; conferir a versão mais recente antes de mexer em cores/fontes"
metadata:
  node_type: memory
  type: reference
  originSessionId: e1b641a9-7f29-4da6-b88c-a579385b7966
  modified: 2026-10-03T13:27:29.758Z
---

O visual do app é definido no projeto **Claude Design** `https://claude.ai/design/p/35b063ba-a193-4088-9098-fc88ae5b6054` (arquivos `RA Funcional.dc.html` = v1, `RA Funcional v2.dc.html` = clicável, `RA Funcional v3 - Apresentação.dc.html` = proposta de 03/10/2026). O usuário itera lá direto; a sessão de código não é avisada.

ATUALIZAÇÃO 03/10/2026: o usuário aprovou a v3 e ela foi APLICADA no app (commits `89fd829`..`e93657f`, inclui aba "Minhas aulas" e barra inferior). A v1 descrita abaixo é história; o app agora usa a v3 em `web/src/styles/tokens.css`. Conferir o projeto de design antes de novas mudanças visuais.

Antes disso o app implementava a **v1** (papel/grafite/terracota, League Gothic + Newsreader), com tokens aproximados. A **v3** propõe verde-petróleo `#1F4E46` (marca), coral `#E86A3A` (ação), verde `#2F8F5B` (confirmado), amarelo `#F2C14E` (fila/aviso), cinza `#7C8783` (bloqueado), creme `#F8F5EC` (fundo), fontes Bricolage Grotesque (títulos) e Archivo (texto/números). Hex lidos da tela em tamanho pequeno: confirmar antes de aplicar. A v3 ainda aguardava aprovação do usuário.

**Why:** o usuário achou o visual v1 "sem cor, sem vida, não profissional" e delegou a nova direção ao Claude Design; o app ficou para trás.

**How to apply:** antes de qualquer trabalho visual, abrir o projeto (extensão do Chrome; PageDown rola o preview; o iframe não expõe texto) e ver qual versão o usuário aprovou. Todas as cores ficam em `web/src/styles/tokens.css`, então trocar a marca é editar esse arquivo mais as fontes.
