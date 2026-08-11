param(
  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$environmentUrl = "https://org23b93544.crm2.dynamics.com/"
$solutionUniqueName = "AppBetinhos"
$backupDir = Join-Path $root "backup\exchange-lifecycle"
$backupPath = Join-Path $backupDir ("$solutionUniqueName-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")

function Write-Step([string] $Message) {
  Write-Host "[push-dev] $Message"
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
  throw "Power Platform CLI (pac) nao encontrado; exporte a solucao atual antes do deploy."
}
Write-Step "export unmanaged solution backup $backupPath"
pac solution export --name $solutionUniqueName --path $backupPath --overwrite
if ($LASTEXITCODE -ne 0) { throw "Export da solucao atual falhou com exit code $LASTEXITCODE" }

Write-Step "build plugin Release"
dotnet build "plugins/DriverRecordSharing/DriverRecordSharing.csproj" -c Release --nologo
if ($LASTEXITCODE -ne 0) {
  throw "Build do plugin falhou com exit code $LASTEXITCODE"
}

Write-Step "publish webresource in $solutionUniqueName"
& (Join-Path $PSScriptRoot "deploy-webresource.ps1") `
  -EnvironmentUrl $environmentUrl `
  -WebResourceName "new_app-motoristas-v2" `
  -SolutionUniqueName $solutionUniqueName `
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

Write-Step "DEV publish complete"
