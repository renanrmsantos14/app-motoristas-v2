[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [guid] $DriverId = "771bdcf5-26c3-4156-9058-44f8e8ab8878",
  [guid] $VehicleId = "3363c66f-44f5-f011-8406-7ced8da8212d"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$api = "$baseUrl/api/data/v9.2"
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{ Authorization = "Bearer $($token.AccessToken)"; Accept = "application/json"; "Content-Type" = "application/json" }

function Assert-Fails([string] $Name, [string] $ExpectedCode, [scriptblock] $Action) {
  try { & $Action; throw "$Name foi aceito indevidamente." }
  catch {
    $detail = [string]$_.ErrorDetails.Message + " " + [string]$_.Exception.Message
    if ($detail -notmatch [regex]::Escape($ExpectedCode)) { throw "$Name falhou com código inesperado. esperado=$ExpectedCode; detalhe=$detail" }
    Write-Host "[exchange-negative-e2e] $Name OK código=$ExpectedCode"
  }
}
function New-Payload([DateTime] $Start, [DateTime] $End, [string] $Key, [string] $Observation) {
  @{
    new_Motivo = "E2E negativo"
    new_DataEfetiva = $null
    new_Inicio = $Start.ToUniversalTime().ToString('o')
    new_Fim = $End.ToUniversalTime().ToString('o')
    new_Tipo = 100000001
    new_Motorista1 = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.cr40f_funcionarios'; cr40f_funcionariosid = [string]$DriverId }
    new_Motorista2 = $null
    new_Veiculo1 = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.cr40f_veiculos'; cr40f_veiculosid = [string]$VehicleId }
    new_Veiculo2 = $null
    new_Observacao = $Observation
    new_ConcluirImediatamente = $false
    new_ProgramarAutomaticamente = $false
    new_IdempotencyKey = $Key
  }
}
function Register([hashtable] $Payload) {
  Invoke-RestMethod -Method Post -Uri "$api/new_RegistrarTrocaDeCarro" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 8)
}
function Get-Exchange([guid] $Id) {
  Invoke-RestMethod -Method Get -Uri "$api/cr40f_trocasdecarros($Id)?`$select=cr40f_id,cr40f_statusdatroca,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,cr40f_observacao" -Headers $headers
}
function Version($Record) { ([string]$Record.'@odata.etag').Replace('W/', '').Replace('"', '') }

$future = [DateTime]::UtcNow.AddDays(4)
Assert-Fails "REGISTER ZERO WINDOW" "EXCHANGE_INVALID_WINDOW" { Register (New-Payload $future $future ("zero-" + [guid]::NewGuid().ToString('N')) "zero") | Out-Null }
Assert-Fails "REGISTER INVERTED WINDOW" "EXCHANGE_INVALID_WINDOW" { Register (New-Payload $future $future.AddMinutes(-1) ("inverted-" + [guid]::NewGuid().ToString('N')) "invertida") | Out-Null }

$key = "idempotency-" + [guid]::NewGuid().ToString('N')
$payload = New-Payload $future $future.AddHours(1) $key "idempotente"
$first = Register $payload
$second = Register $payload
if ([guid]$first.new_TrocaId -ne [guid]$second.new_TrocaId) { throw "Idempotência criou IDs diferentes." }
$exchangeId = [guid]$first.new_TrocaId
Write-Host "[exchange-negative-e2e] IDEMPOTENCY REPLAY OK id=$exchangeId"
Assert-Fails "IDEMPOTENCY KEY REUSED" "IDEMPOTENCY_KEY_REUSED" { Register (New-Payload $future $future.AddHours(1) $key "conteúdo divergente") | Out-Null }

$record = Get-Exchange $exchangeId
$oldVersion = Version $record
$update = @{
  new_Motivo = "E2E concorrência"
  new_VersaoEsperada = $oldVersion
  new_Inicio = ([DateTime]$record.cr40f_iniciodajaneladetroca).ToUniversalTime().ToString('o')
  new_Fim = ([DateTime]$record.cr40f_fimdajaneladetroca).ToUniversalTime().AddMinutes(5).ToString('o')
  new_Observacao = "versão atualizada"
}
Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($exchangeId)/Microsoft.Dynamics.CRM.new_AtualizarTrocaDeCarro" -Headers $headers -Body ($update | ConvertTo-Json) | Out-Null
Write-Host "[exchange-negative-e2e] UPDATE CURRENT VERSION OK"
Assert-Fails "STALE ROWVERSION" "EXCHANGE_CONCURRENCY_CONFLICT" {
  Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($exchangeId)/Microsoft.Dynamics.CRM.new_AtualizarTrocaDeCarro" -Headers $headers -Body ($update | ConvertTo-Json) | Out-Null
}
Assert-Fails "DIRECT STRUCTURAL PATCH" "FORBIDDEN_LIFECYCLE" {
  Invoke-RestMethod -Method Patch -Uri "$api/cr40f_trocasdecarros($exchangeId)" -Headers $headers -Body (@{ cr40f_statusdatroca = 100000001 } | ConvertTo-Json) | Out-Null
}
Assert-Fails "DIRECT DELETE" "FORBIDDEN_LIFECYCLE" { Invoke-RestMethod -Method Delete -Uri "$api/cr40f_trocasdecarros($exchangeId)" -Headers $headers | Out-Null }

$record = Get-Exchange $exchangeId
$cancel = @{ new_Motivo = "Encerramento E2E negativo"; new_VersaoEsperada = Version $record }
Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($exchangeId)/Microsoft.Dynamics.CRM.new_CancelarTrocaDeCarro" -Headers $headers -Body ($cancel | ConvertTo-Json) | Out-Null
$final = Get-Exchange $exchangeId
if ([int]$final.cr40f_statusdatroca -ne 202410002) { throw "Cancelamento não gravou status esperado." }
Write-Host "[exchange-negative-e2e] CANCEL OK troca=$($final.cr40f_id)"
Assert-Fails "REPEATED CANCEL" "EXCHANGE_CONCURRENCY_CONFLICT" {
  Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($exchangeId)/Microsoft.Dynamics.CRM.new_CancelarTrocaDeCarro" -Headers $headers -Body ($cancel | ConvertTo-Json) | Out-Null
}
Write-Host "[exchange-negative-e2e] MATRIZ NEGATIVA OK"
