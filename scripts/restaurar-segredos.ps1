# Restaura os arquivos de chaves a partir de segredos.7z (protegido por senha) nos lugares certos.
# Uso, na raiz do projeto:  powershell -ExecutionPolicy Bypass -File scripts/restaurar-segredos.ps1
# Precisa do 7-Zip instalado (https://www.7-zip.org). A senha fica só com o Pedro, não está no repositório.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$zip = Join-Path $raiz 'segredos.7z'
$sete = @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sete) { throw '7-Zip não encontrado. Instale em https://www.7-zip.org e rode de novo.' }
if (-not (Test-Path $zip)) { throw "Não achei $zip" }

$destinos = @{
  'env.test.txt'        = Join-Path $raiz '.env.test'
  'env.local.txt'       = Join-Path $raiz 'web\.env.local'
  'dev-credenciais.txt' = Join-Path $raiz 'web\.dev-credenciais.txt'
}

foreach ($d in $destinos.Values) {
  if (Test-Path $d) { throw "Já existe $d. Apague ou mova antes, para não sobrescrever." }
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("ra-seg-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  # 7z pergunta a senha no terminal.
  & $sete x $zip "-o$tmp" -y
  if ($LASTEXITCODE -ne 0) { throw 'Senha errada ou arquivo corrompido.' }
  foreach ($nome in $destinos.Keys) {
    Copy-Item (Join-Path $tmp $nome) $destinos[$nome]
    Write-Host "OK  $($destinos[$nome])"
  }
} finally {
  Remove-Item -Recurse -Force $tmp
}
Write-Host 'Pronto. Agora rode: cd web; npm install'
