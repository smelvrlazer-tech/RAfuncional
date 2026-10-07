# Continuar o RA Funcional em outra máquina

Passo a passo para o Pedro. Tudo vem do GitHub; não precisa de pendrive.

Repositório (privado): https://github.com/smelvrlazer-tech/RAfuncional

## 1. Instale 4 programas (todos gratuitos)
- **Git**: https://git-scm.com/download/win (clique em "Next" até o fim)
- **Node.js**, versão LTS: https://nodejs.org
- **7-Zip**: https://www.7-zip.org (abre o arquivo de chaves)
- **Claude Code**, entrando com a mesma conta de sempre

## 2. Baixe o projeto
Abra o PowerShell e rode, um comando de cada vez:

```bash
git clone https://github.com/smelvrlazer-tech/RAfuncional.git
```
```bash
cd RAfuncional
```

Vai abrir uma janela pedindo login no GitHub. Entre na conta onde o repositório está.

## 3. Instale as dependências do app
```bash
cd web
```
```bash
npm install
```
```bash
cd ..
```

## 4. Restaure as chaves
Na pasta `RAfuncional`:

```bash
powershell -ExecutionPolicy Bypass -File scripts/restaurar-segredos.ps1
```

O script pede a **senha** do `segredos.7z` (a que o Pedro guardou no gerenciador de senhas ou no celular) e coloca nos lugares certos:

| Arquivo dentro do `.7z` | Vira |
|---|---|
| `env.test.txt` | `.env.test` (raiz) |
| `env.local.txt` | `web/.env.local` |
| `dev-credenciais.txt` | `web/.dev-credenciais.txt` |

Ele não sobrescreve arquivos que já existam. Se a senha foi perdida, as chaves se recuperam no painel do Supabase e o `.7z` é refeito.

## 5. Ligue ao Supabase
```bash
npx supabase login
```
```bash
npx supabase link
```
Docker **não** é necessário: o banco DEV está na nuvem. O ref do projeto está em `docs/ACESSOS-E-STATUS.md`.

## 6. Abra o Claude Code na pasta e peça
> Leia o CLAUDE.md e o docs/PROJETO.md e me diga em que ponto estamos.

Depois, para conferir que está tudo certo:
> Rode o app e os testes.

(Manualmente: `cd web`, `npm run dev -- --host 127.0.0.1 --port 5173`, e `npx vitest run`. Esperado: 22 arquivos / 180 testes passando, em 07/10/2026.)

## 7. Opcional: restaurar a memória do Claude Code
As notas do Claude estão em `docs/memoria/`. Para o Claude lembrar delas como memória, copie `docs/memoria/*.md` para a pasta de memória do projeto: `~/.claude/projects/<pasta-do-projeto>/memory/`. Se não fizer, não tem problema: o essencial está no `CLAUDE.md` e em `docs/PROJETO.md`.

## Se algo der errado
- **"7-Zip não encontrado"**: instale o 7-Zip (passo 1) e rode o passo 4 de novo.
- **"Senha errada"**: confira a senha, sem espaços no começo ou no fim.
- **Pede login do GitHub toda hora**: faça o login pela janela do navegador que abre; o Git guarda depois.
- **Qualquer outro erro**: copie a mensagem inteira e cole no Claude Code.

## Depois, antes de entregar ao Rafael
O `segredos.7z` fica no histórico do git. Antes de transferir o repositório, trocar as chaves do Supabase (ou criar o projeto de produção novo) e apagar o `segredos.7z`.
