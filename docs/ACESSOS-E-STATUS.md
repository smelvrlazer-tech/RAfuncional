# RA Funcional — Acessos, links e status (atualizado em 25/09/2026)

## Resposta curta

**Situação (atualizada em 07/10/2026):** o banco roda num projeto Supabase DEV na nuvem (conta do Pedro) e o código está num repositório privado no GitHub (conta do Pedro). Ainda não há hospedagem (Netlify), e nada foi transferido para o e-mail do Rafael. Esta seção da página abaixo descreve o estado de 25/09 e está desatualizada onde disser "sem GitHub" ou "git local". Senhas e chaves não ficam neste arquivo.

**Em outra máquina:** `git clone` do repositório, `npm install` em `web/`, e copiar por meio seguro `.env.test`, `web/.env.local` e `web/.dev-credenciais.txt` (ficam fora do git).

## O que EXISTE

| Item | Onde | Login / acesso |
|---|---|---|
| Código do projeto | `C:\Users\daly_\Claude Code\RA Funcional` (git local, 4 commits, sem GitHub) | Nenhum |
| Especificação do app | `docs/superpowers/specs/2026-07-31-ra-funcional-app-design.md` | Nenhum |
| Plano de implementação (backend) | `docs/superpowers/plans/2026-07-31-ra-funcional-backend.md` | Nenhum |
| Protótipo de design (Claude Design) | https://claude.ai/design/p/35b063ba-a193-4088-9098-fc88ae5b6054?file=RA+Funcional.dc.html | Sua conta claude.ai (engpedroleonardoduarte@gmail.com) |
| Supabase LOCAL (só na sua máquina, via Docker) | API http://127.0.0.1:54321 · Studio http://127.0.0.1:54323 | Sem login. Chaves locais ficam em `.env.test` (arquivo não versionado) |

O Supabase local só funciona com o Docker Desktop aberto e `npx supabase start` rodando.

## Supabase na nuvem (criado em 25/09/2026, conta do seu e-mail)

| Item | Valor |
|---|---|
| Organização | RA Funcional (plano Free) |
| Projeto | ra-funcional-dev (desenvolvimento, descartável) |
| Project ref | mixrbjskhftungppggow |
| URL da API | https://mixrbjskhftungppggow.supabase.co |
| Painel | https://supabase.com/dashboard/project/mixrbjskhftungppggow |
| Região | Canada (Central) |
| Senha do banco | só no seu gerenciador de senhas (não está neste arquivo) |

Transferência ao Rafael: convidar o e-mail dele como Owner da organização e depois sair.

## O que NÃO existe (ainda)

- GitHub (repositório remoto)
- Supabase de produção (só existe o de desenvolvimento acima)
- Netlify (hospedagem) e qualquer domínio
- E-mail do Rafael / e-mail dedicado ao projeto (decisão pendente: criar `rafuncional.app@gmail.com` ou usar o do Rafael, e criar todas as contas nele)

## Status do plano de backend (13 tarefas) — atualizado em 25/09/2026

Sem Docker: usamos o Supabase de desenvolvimento na nuvem (ra-funcional-dev). Para aplicar migrations novas, rode `npx supabase db push` num terminal dentro da pasta do projeto e responda Y (o login já está salvo).

- Tasks 1 a 6 (base, sessões, check-in, cancelamento e fila): FEITAS e commitadas (25 testes passando)
- Tasks 7 a 9 (treinos, convites, ações do treinador): FEITAS e commitadas
- Tasks 10 e 11 (segurança RLS e view da agenda): FEITAS e commitadas. Suíte: 137 testes passando, migrations 0001-0009 aplicadas
- Front-end em `web/` (Vite + React + PWA): telas do aluno e painel do treinador PRONTOS e verificados no navegador com dados reais (163 testes do front)
- Migrations 0010 (automações pg_cron: gerar sessões e publicar treinos sozinhos) e 0011 (treinador edita turma sem duplicar aulas): APLICADAS e commitadas. Suíte do backend: 159 testes passando
- Pendentes: notificações push, publicação online (Netlify), e-mail do Rafael e transferência das contas

## Visual (atualizado em 03/10/2026)

O app usa a identidade **v3** do Claude Design (verde-petróleo, coral, amarelo sobre creme; fontes Bricolage Grotesque e Archivo). Todas as cores ficam em `web/src/styles/tokens.css`. O aluno tem a barra inferior Agenda / Minhas aulas / Perfil. Projeto de design: https://claude.ai/design/p/35b063ba-a193-4088-9098-fc88ae5b6054

## Manutenção

Os testes do backend criam usuários reais no banco DEV. Se `npm test` ficar lento, rode `node scripts/limpar-usuarios-teste.mjs` (apaga só contas @teste.local, nunca mexe no seed do front).

## Como rodar o app agora (no seu PC)

Terminal na pasta `web/`: `npm install` (1ª vez) e `npm run dev`; abrir http://127.0.0.1:5173
Logins de teste (só do banco DEV): e-mails e senhas em `web/.dev-credenciais.txt` (arquivo local, fora do git). Rafael (treinador), Ana e Bruno (alunos).

## Pendências e decisões suas

1. Abrir o Docker Desktop (aceitar o prompt de administrador) para retomar o Task 3.
2. Confirmar Vite + React no lugar de Next.js (recomendado; explicação pendente de resposta).
3. Definir o e-mail que será dono das contas (GitHub, Supabase, Netlify).
4. Validar o design do Claude Design (ajustes de vídeo, textura e carimbo já aplicados).
5. Na entrega: script de limpeza da máquina (`scripts/limpar-maquina.ps1`, ainda não criado).

## Regras do projeto

- Custo zero para o Rafael (nenhum serviço pago, subdomínio gratuito).
- Senhas: guarde só num gerenciador de senhas. Este arquivo não deve conter nenhuma.
