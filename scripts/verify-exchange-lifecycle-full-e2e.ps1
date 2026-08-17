[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [guid] $DriverId = "771bdcf5-26c3-4156-9058-44f8e8ab8878",
  [guid] $VehicleId = "3363c66f-44f5-f011-8406-7ced8da8212d",
  [guid] $RevertOnlyExchangeId = [guid]::Empty
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

function Get-Exchange([guid] $Id) {
  Invoke-RestMethod -Method Get -Uri "$api/cr40f_trocasdecarros($Id)?`$select=cr40f_id,cr40f_statusdatroca,new_revertida,_cr40f_motorista1_value,_cr40f_veiculo1antesdatroca_value" -Headers $headers
}
function Get-Version($Record) { ([string]$Record.'@odata.etag').Replace('W/', '').Replace('"', '') }
function Invoke-Bound([guid] $Id, [string] $Action, [hashtable] $Payload, [hashtable] $RequestHeaders = $headers) {
  Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($Id)/Microsoft.Dynamics.CRM.$Action" -Headers $RequestHeaders -Body ($Payload | ConvertTo-Json -Depth 8)
}
function Get-OpenPossessions {
  (Invoke-RestMethod -Method Get -Uri "$api/new_possedeveiculos?`$select=new_possedeveiculoid,_new_motorista_value,_new_veiculo_value,new_iniciodaposse,new_fimdaposse,_new_trocadecarrorelacionada_value&`$filter=new_fimdaposse eq null and (_new_motorista_value eq $DriverId or _new_veiculo_value eq $VehicleId)" -Headers $headers).value
}

if ($RevertOnlyExchangeId -ne [guid]::Empty) {
  $completed = Get-Exchange $RevertOnlyExchangeId
  $DriverId = [guid]$completed._cr40f_motorista1_value
  $VehicleId = [guid]$completed._cr40f_veiculo1antesdatroca_value
  $reverted = Invoke-Bound $RevertOnlyExchangeId "new_ReverterTrocaDeCarro" @{
    new_Motivo = "Reversão E2E após correção"
    new_VersaoEsperada = Get-Version $completed
    new_DataEfetiva = [DateTime]::UtcNow.ToString('o')
  }
  $original = Get-Exchange $RevertOnlyExchangeId
  if (-not [bool]$original.new_revertida) { throw "REVERT não marcou a troca original como revertida." }
  $afterRevert = @(Get-OpenPossessions)
  if (@($afterRevert | Where-Object { $_._new_motorista_value -eq $DriverId -and $_._new_veiculo_value -eq $VehicleId }).Count -ne 1) {
    throw "Reversão não restaurou exatamente uma posse aberta para motorista e veículo."
  }
  Write-Host "[exchange-full-e2e] REVERT RETRY OK compensacao=$($reverted.new_TrocaCompensatoriaId)"
  Write-Host "[exchange-full-e2e] MATRIZ COMPLETA OK troca=$($original.cr40f_id)"
  return
}

$activeUsers = @((Invoke-RestMethod -Method Get -Uri "$api/systemusers?`$select=systemuserid,internalemailaddress&`$filter=isdisabled eq false and internalemailaddress ne null" -Headers $headers).value)
$openCandidates = @((Invoke-RestMethod -Method Get -Uri "$api/new_possedeveiculos?`$select=_new_motorista_value,_new_veiculo_value&`$filter=new_fimdaposse eq null and _new_motorista_value ne null" -Headers $headers).value)
$driverUserId = [guid]::Empty
foreach ($candidate in $openCandidates) {
  $candidateDriver = [guid]$candidate._new_motorista_value
  $employee = Invoke-RestMethod -Method Get -Uri "$api/cr40f_funcionarioses($candidateDriver)?`$select=cr40f_emailmicrosoft" -Headers $headers
  $email = [string]$employee.cr40f_emailmicrosoft
  if ([string]::IsNullOrWhiteSpace($email)) { continue }
  $matches = @($activeUsers | Where-Object { [string]::Equals([string]$_.internalemailaddress, $email, [StringComparison]::OrdinalIgnoreCase) })
  if ($matches.Count -ne 1) { continue }
  $DriverId = $candidateDriver
  $VehicleId = [guid]$candidate._new_veiculo_value
  $driverUserId = [guid]$matches[0].systemuserid
  break
}
if ($driverUserId -eq [guid]::Empty) { throw "Nenhuma posse aberta possui motorista com systemuser ativo e único." }
$before = @(Get-OpenPossessions)
if (@($before | Where-Object { $_._new_motorista_value -eq $DriverId -and $_._new_veiculo_value -eq $VehicleId }).Count -ne 1) {
  throw "Pré-condição inválida: motorista e veículo devem possuir exatamente uma posse aberta conjunta."
}

$start = [DateTime]::UtcNow.AddSeconds(-5)
$end = $start.AddHours(1)
$key = "codex-full-e2e-" + [guid]::NewGuid().ToString("N")
$register = @{
  new_Motivo = "E2E completo Codex"
  new_DataEfetiva = $null
  new_Inicio = $start.ToString('o')
  new_Fim = $end.ToString('o')
  new_Tipo = 100000001
  new_Motorista1 = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.cr40f_funcionarios'; cr40f_funcionariosid = [string]$DriverId }
  new_Motorista2 = $null
  new_Veiculo1 = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.cr40f_veiculos'; cr40f_veiculosid = [string]$VehicleId }
  new_Veiculo2 = $null
  new_Observacao = "E2E completo Codex"
  new_ConcluirImediatamente = $false
  new_ProgramarAutomaticamente = $false
  new_IdempotencyKey = $key
}
$created = Invoke-RestMethod -Method Post -Uri "$api/new_RegistrarTrocaDeCarro" -Headers $headers -Body ($register | ConvertTo-Json -Depth 8)
$exchangeId = [guid]$created.new_TrocaId
Write-Host "[exchange-full-e2e] CREATE OK id=$exchangeId"

$record = Get-Exchange $exchangeId
$driverHeaders = $headers.Clone()
$driverHeaders['MSCRMCallerID'] = [string]$driverUserId
Invoke-Bound $exchangeId "new_ConfirmarTrocaMotorista" @{ new_Motivo = "Confirmação E2E"; new_VersaoEsperada = Get-Version $record } $driverHeaders | Out-Null
$completed = Get-Exchange $exchangeId
if ([int]$completed.cr40f_statusdatroca -ne 202410001) { throw "CONFIRM não concluiu a troca; status=$($completed.cr40f_statusdatroca)." }
Write-Host "[exchange-full-e2e] CONFIRM + COMPLETE OK troca=$($completed.cr40f_id)"

$afterComplete = @(Get-OpenPossessions)
if (@($afterComplete | Where-Object { -not $_._new_motorista_value -and $_._new_veiculo_value -eq $VehicleId }).Count -ne 1) {
  throw "Conclusão não deixou exatamente uma posse-base aberta para o veículo."
}
Write-Host "[exchange-full-e2e] POSSESSION TO BASE OK"

Start-Sleep -Seconds 1
$completed = Get-Exchange $exchangeId
$reverted = Invoke-Bound $exchangeId "new_ReverterTrocaDeCarro" @{
  new_Motivo = "Reversão E2E"
  new_VersaoEsperada = Get-Version $completed
  new_DataEfetiva = [DateTime]::UtcNow.ToString('o')
}
$original = Get-Exchange $exchangeId
if (-not [bool]$original.new_revertida) { throw "REVERT não marcou a troca original como revertida." }
$afterRevert = @(Get-OpenPossessions)
if (@($afterRevert | Where-Object { $_._new_motorista_value -eq $DriverId -and $_._new_veiculo_value -eq $VehicleId }).Count -ne 1) {
  throw "Reversão não restaurou exatamente uma posse aberta para motorista e veículo."
}
Write-Host "[exchange-full-e2e] REVERT OK compensacao=$($reverted.new_TrocaCompensatoriaId)"
Write-Host "[exchange-full-e2e] MATRIZ COMPLETA OK troca=$($original.cr40f_id)"
