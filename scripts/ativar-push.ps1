# Ativa as notificações push num projeto Supabase (docs/PUSH.md). Roda tudo em sequência e só
# para quando precisa de você: login no navegador, senha do banco e um colar/Run no SQL Editor.
# Uso, na raiz do projeto (num terminal normal, não em segundo plano):
#   powershell -ExecutionPolicy Bypass -File scripts/ativar-push.ps1 -Ref mixrbjskhftungppggow
param([Parameter(Mandatory)][ValidatePattern('^[a-z]{20}$')][string]$Ref)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$sb = Join-Path $raiz 'node_modules\.bin\supabase.cmd'
$envFuncoes = Join-Path $raiz 'supabase\functions\.env'

function Passo($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Rodar {
  & $sb @args
  if ($LASTEXITCODE -ne 0) { throw "supabase $($args -join ' ') falhou (código $LASTEXITCODE)" }
}

if (-not (Test-Path $sb)) { throw 'Rode "npm install" na raiz do projeto antes.' }
if (-not (Test-Path $envFuncoes)) { throw "Falta $envFuncoes (chaves VAPID e PUSH_SEGREDO). Restaure os segredos primeiro." }

Passo '1/6 Login na conta do Supabase'
# No PowerShell 5.1, stderr redirecionado de um programa vira erro fatal com 'Stop': só para esta sondagem.
$ErrorActionPreference = 'Continue'
& $sb projects list 2>&1 | Out-Null
$logado = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'
if ($logado) {
  Write-Host 'Já está logado.'
} else {
  Write-Host 'Aperte Enter, autorize no navegador e digite o código de verificação aqui.'
  Rodar login
}

Passo '2/6 Ligar este projeto ao Supabase (vai pedir a senha do banco)'
Rodar link --project-ref $Ref

Passo '3/6 Aplicar as migrations pendentes (responda Y)'
Rodar db push

Passo '4/6 Segredos da Edge Function (chaves VAPID e PUSH_SEGREDO)'
Rodar secrets set --env-file $envFuncoes --project-ref $Ref

Passo '5/6 Publicar a Edge Function enviar-push'
Rodar functions deploy enviar-push --project-ref $Ref --use-api

Passo '6/6 Vault: URL e segredo que o agendador usa'
$segredo = ((Get-Content $envFuncoes | Where-Object { $_ -match '^PUSH_SEGREDO=' }) -replace '^PUSH_SEGREDO=', '').Trim()
if (-not $segredo) { throw 'PUSH_SEGREDO não encontrado no .env da função.' }
$sql = @"
select vault.create_secret('https://$Ref.supabase.co/functions/v1/enviar-push', 'push_url');
select vault.create_secret('$segredo', 'push_segredo');
"@
Set-Clipboard -Value $sql
Start-Process "https://supabase.com/dashboard/project/$Ref/sql/new"
Write-Host 'O SQL (com o segredo) já está na área de transferência e o SQL Editor abriu no navegador.'
Write-Host 'Cole com Ctrl+V, clique em Run e volte aqui.'
Read-Host 'Depois de clicar em Run, aperte Enter aqui para limpar a área de transferência'
Set-Clipboard -Value ' '
Write-Host "`nPronto. Teste: docs/PUSH.md, passo 6." -ForegroundColor Green
