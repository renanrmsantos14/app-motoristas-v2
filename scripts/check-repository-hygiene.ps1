$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
  $tracked = @(git ls-files)
  $forbidden = @($tracked | Where-Object {
    $_ -match '(^|/)(tmp|\.tmp|\.dev-backups|bin|obj)/' -or
    $_ -match '(^|/)graphify-out/cache/' -or
    $_ -match '\.zip$'
  })
  if ($forbidden.Count -gt 0) {
    throw "Repositorio contem artefatos proibidos versionados: $($forbidden.Count)."
  }

  $credentialFiles = @(git grep -I -l -E 'https://[^[:space:]"'']+(sig|code|token|secret|key)=' -- . 2>$null)
  if ($LASTEXITCODE -notin @(0, 1)) { throw "Scanner de credenciais falhou." }
  if ($credentialFiles.Count -gt 0) {
    throw "Repositorio contem URL com parametro de credencial em arquivo versionado: $($credentialFiles.Count)."
  }

  Write-Host "[hygiene] OK: sem exports, binarios, ZIPs ou URLs credenciadas versionadas."
}
finally {
  Pop-Location
}
