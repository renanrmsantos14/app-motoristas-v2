param(
  [switch] $DeviceCode
)

if ($PSVersionTable.PSEdition -eq "Core" -or $PSHOME -like "*codex-runtimes*") {
  $windowsPowerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath)
  if ($DeviceCode) { $arguments += "-DeviceCode" }
  & $windowsPowerShell @arguments
  exit $LASTEXITCODE
}

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceParent = Split-Path $root -Parent
$operationsCandidates = @(Get-ChildItem -LiteralPath $workspaceParent -Directory | Where-Object { $_.Name -like "Tela Fun*Operacionais" })
if ($operationsCandidates.Count -ne 1) { throw "Repositorio Tela Funcoes Operacionais nao encontrado de forma unica em $workspaceParent." }
$operationsRoot = $operationsCandidates[0].FullName
Set-Location $root

$environmentUrl = "https://org23b93544.crm2.dynamics.com/"
$expectedDevHost = "org23b93544.crm2.dynamics.com"
$solutionUniqueName = "AppBetinhos"
$backupDir = Join-Path $root "backup\exchange-lifecycle"
$backupPath = Join-Path $backupDir ("$solutionUniqueName-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")

function Write-Step([string] $Message) {
  Write-Host "[push-dev] $Message"
}

function Export-SolutionBackup([string] $Path, [string] $Description) {
  $environmentUri = [Uri] $environmentUrl
  if ($environmentUri.Scheme -ne "https" -or $environmentUri.Host -ne $expectedDevHost) {
    throw "Ambiente DEV invalido para export: $environmentUrl"
  }

  Write-Step "$Description unmanaged $Path"
  pac solution export --environment $environmentUrl --name $solutionUniqueName --path $Path --overwrite
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
    Write-Step "export unmanaged indisponivel; tentando backup managed"
    pac solution export --environment $environmentUrl --name $solutionUniqueName --path $Path --managed --overwrite
    if ($LASTEXITCODE -ne 0) { throw "$Description falhou com exit code $LASTEXITCODE" }
  }

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Description nao gerou o ZIP esperado: $Path"
  }
  if ((Get-Item -LiteralPath $Path).Length -le 0) {
    throw "$Description gerou ZIP vazio: $Path"
  }
}

Write-Step "gate de higiene do repositorio"
& (Join-Path $PSScriptRoot "check-repository-hygiene.ps1")
if (-not $?) { throw "Gate de higiene do repositorio falhou." }

function Assert-SolutionArchiveExchangeLifecycle([string] $ZipPath) {
  if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "ZIP final nao encontrado: $ZipPath" }
  $extractPath = Join-Path ([System.IO.Path]::GetTempPath()) ("exchange-lifecycle-solution-" + [guid]::NewGuid().ToString("N"))
  try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $extractPath -Force
    $customApiPath = Join-Path $extractPath "customapis"
    if (-not (Test-Path -LiteralPath $customApiPath)) { throw "ZIP final nao possui a pasta customapis." }
    $xmlText = ((Get-ChildItem -LiteralPath $customApiPath -Recurse -File -Filter "*.xml" | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n")
    foreach ($required in @("new_ConcluirTrocaDeCarro", "new_CancelarTrocaDeCarro", "new_ReverterTrocaDeCarro", "new_ConfirmarTrocaMotorista", "new_AtualizarTrocaDeCarro", "new_RegistrarTrocaDeCarro", "new_Motivo", "new_DataEfetiva", "new_VersaoEsperada", "new_IdempotencyKey", "new_TrocaId", "new_TrocaCompensatoriaId")) {
      if ($xmlText.IndexOf($required, [System.StringComparison]::Ordinal) -lt 0) { throw "ZIP final nao possui o componente esperado: $required" }
    }
    Write-Step "validacao do ZIP final OK: Custom APIs, parametros e retorno presentes"
  }
  finally {
    if (Test-Path -LiteralPath $extractPath) { Remove-Item -LiteralPath $extractPath -Recurse -Force }
  }
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
  throw "Power Platform CLI (pac) nao encontrado; exporte a solucao atual antes do deploy."
}
Export-SolutionBackup $backupPath "export solution backup"

Write-Step "gate App Motoristas: testes, TypeScript e build"
npm test
if ($LASTEXITCODE -ne 0) { throw "Testes do App Motoristas falharam." }
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
if ($LASTEXITCODE -ne 0) { throw "TypeScript do App Motoristas falhou." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build do App Motoristas falhou." }

Write-Step "gate Tela Funcoes Operacionais: testes, TypeScript e build"
Push-Location $operationsRoot
try {
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Testes da Tela Funcoes Operacionais falharam." }
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw "TypeScript da Tela Funcoes Operacionais falhou." }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build da Tela Funcoes Operacionais falhou." }
}
finally { Pop-Location }

Write-Step "gate plugin: build e testes"
dotnet build "plugins/DriverRecordSharing.Tests/DriverRecordSharing.Tests.csproj" -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw "Build do plugin falhou." }
$pluginTestDir = Join-Path ([System.IO.Path]::GetTempPath()) ("driver-record-sharing-tests-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $pluginTestDir | Out-Null
Copy-Item -Path "plugins\DriverRecordSharing.Tests\bin\Release\net462\*" -Destination $pluginTestDir -Recurse
dotnet vstest (Join-Path $pluginTestDir "DriverRecordSharing.Tests.dll")
if ($LASTEXITCODE -ne 0) { throw "Testes do plugin falharam." }

Write-Step "publish webresource in $solutionUniqueName"
& (Join-Path $PSScriptRoot "deploy-webresource.ps1") `
  -EnvironmentUrl $environmentUrl `
  -WebResourceName "new_app-motoristas-v2" `
  -SolutionUniqueName $solutionUniqueName `
  -DeviceCode:$DeviceCode

Write-Step "publish Tela Funcoes Operacionais"
& (Join-Path $operationsRoot "scripts\deploy-webresource.ps1") `
  -EnvironmentUrl $environmentUrl `
  -WebResourceName "new_telafuncoesoperacionais" `
  -SkipBuild `
  -DeviceCode:$DeviceCode

Write-Step "publish plugin in $solutionUniqueName"
& (Join-Path $PSScriptRoot "register-driver-record-sharing-plugin-webapi.ps1") `
  -EnvironmentUrl $environmentUrl `
  -SolutionUniqueName $solutionUniqueName `
  -Apply `
  -AddExistingToSolution `
  -DeviceCode:$DeviceCode

Write-Step "provision exchange lifecycle metadata in DEV"
& (Join-Path $PSScriptRoot "provision-exchange-lifecycle.ps1") `
  -EnvironmentUrl $environmentUrl `
  -SolutionUniqueName $solutionUniqueName `
  -Apply `
  -DeviceCode:$DeviceCode

Write-Step "publish exchange lifecycle command resources"
& (Join-Path $PSScriptRoot "provision-exchange-lifecycle-webresources.ps1") `
  -EnvironmentUrl $environmentUrl `
  -SolutionUniqueName $solutionUniqueName `
  -Apply `
  -DeviceCode:$DeviceCode

$finalBackupPath = Join-Path $backupDir ("$solutionUniqueName-final-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")
Export-SolutionBackup $finalBackupPath "export final solution"
Assert-SolutionArchiveExchangeLifecycle $finalBackupPath

Write-Step "DEV publish complete"
