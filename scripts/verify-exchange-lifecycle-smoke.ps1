[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [Parameter(Mandatory = $true)][guid] $ExchangeId
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{ Authorization = "Bearer $($token.AccessToken)"; Accept = "application/json"; "Content-Type" = "application/json" }
$recordUrl = "$baseUrl/api/data/v9.2/cr40f_trocasdecarros($ExchangeId)"

function Get-Exchange {
  Invoke-RestMethod -Method Get -Uri "$recordUrl`?`$select=cr40f_id,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,cr40f_statusdatroca" -Headers $headers
}

function Get-Version($Record) {
  return ([string]$Record.'@odata.etag').Replace('W/', '').Replace('"', '')
}

$record = Get-Exchange
$update = @{
  new_Motivo = "E2E edição"
  new_VersaoEsperada = Get-Version $record
  new_Inicio = ([DateTime]$record.cr40f_iniciodajaneladetroca).ToUniversalTime().ToString('o')
  new_Fim = ([DateTime]$record.cr40f_fimdajaneladetroca).ToUniversalTime().AddMinutes(15).ToString('o')
  new_Observacao = "E2E editado"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$recordUrl/Microsoft.Dynamics.CRM.new_AtualizarTrocaDeCarro" -Headers $headers -Body $update | Out-Null
Write-Host "[exchange-lifecycle-smoke] UPDATE API OK"

try {
  Invoke-RestMethod -Method Delete -Uri $recordUrl -Headers $headers | Out-Null
  throw "DELETE DIRETO FOI ACEITO"
}
catch {
  if ($_.Exception.Message -eq "DELETE DIRETO FOI ACEITO") { throw }
  Write-Host "[exchange-lifecycle-smoke] DELETE DIRETO BLOQUEADO OK"
}

$record = Get-Exchange
$cancel = @{ new_Motivo = "Encerramento do E2E descartável"; new_VersaoEsperada = Get-Version $record } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$recordUrl/Microsoft.Dynamics.CRM.new_CancelarTrocaDeCarro" -Headers $headers -Body $cancel | Out-Null
$final = Get-Exchange
Write-Host "[exchange-lifecycle-smoke] CANCEL API OK status=$($final.cr40f_statusdatroca) troca=$($final.cr40f_id)"
