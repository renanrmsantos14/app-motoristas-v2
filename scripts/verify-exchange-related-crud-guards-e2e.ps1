[CmdletBinding()]
param([string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$api = "$baseUrl/api/data/v9.2"
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{ Authorization = "Bearer $($token.AccessToken)"; Accept = "application/json"; "Content-Type" = "application/json" }

function Assert-Forbidden([string] $Name, [scriptblock] $Action) {
  try { & $Action; throw "$Name foi aceito indevidamente." }
  catch {
    $detail = [string]$_.ErrorDetails.Message + " " + [string]$_.Exception.Message
    if ($detail -notmatch 'FORBIDDEN_LIFECYCLE') { throw "$Name não retornou FORBIDDEN_LIFECYCLE. detalhe=$detail" }
    Write-Host "[exchange-related-crud-e2e] $Name OK"
  }
}

$possession = @((Invoke-RestMethod -Method Get -Uri "$api/new_possedeveiculos?`$select=new_possedeveiculoid,_new_motorista_value,_new_veiculo_value&`$filter=new_fimdaposse eq null&`$top=1" -Headers $headers).value)[0]
if ($null -eq $possession) { throw "Nenhuma posse aberta disponível para teste." }
$possessionId = [guid]$possession.new_possedeveiculoid
$driverId = [guid]$possession._new_motorista_value
$vehicleId = [guid]$possession._new_veiculo_value
$now = [DateTime]::UtcNow
Assert-Forbidden "POSSESSION CREATE" {
  $body = @{ new_iniciodaposse = $now.ToString('o') } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$api/new_possedeveiculos" -Headers $headers -Body $body | Out-Null
}
Assert-Forbidden "POSSESSION UPDATE" { Invoke-RestMethod -Method Patch -Uri "$api/new_possedeveiculos($possessionId)" -Headers $headers -Body (@{ new_fimdaposse = $now.ToString('o') } | ConvertTo-Json) | Out-Null }
Assert-Forbidden "POSSESSION DELETE" { Invoke-RestMethod -Method Delete -Uri "$api/new_possedeveiculos($possessionId)" -Headers $headers | Out-Null }

$general = @((Invoke-RestMethod -Method Get -Uri "$api/cr40f_reservadeveculoses?`$select=cr40f_reservadeveculosid,_cr40f_ot_value,cr40f_status&`$filter=_cr40f_ot_value ne null&`$top=1" -Headers $headers).value)[0]
if ($null -eq $general) { throw "Nenhuma Geral vinculada disponível para teste." }
$generalId = [guid]$general.cr40f_reservadeveculosid
$exchangeId = [guid]$general._cr40f_ot_value
Assert-Forbidden "GENERAL CREATE" {
  $body = @{ 'cr40f_OT@odata.bind' = "/cr40f_trocasdecarros($exchangeId)"; cr40f_dataehorriodesada = $now.ToString('o') } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$api/cr40f_reservadeveculoses" -Headers $headers -Body $body | Out-Null
}
Assert-Forbidden "GENERAL UPDATE" { Invoke-RestMethod -Method Patch -Uri "$api/cr40f_reservadeveculoses($generalId)" -Headers $headers -Body (@{ cr40f_status = [int]$general.cr40f_status } | ConvertTo-Json) | Out-Null }
Assert-Forbidden "GENERAL DELETE" { Invoke-RestMethod -Method Delete -Uri "$api/cr40f_reservadeveculoses($generalId)" -Headers $headers | Out-Null }
Write-Host "[exchange-related-crud-e2e] MATRIZ CRUD RELACIONADA OK"
