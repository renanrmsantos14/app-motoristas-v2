[CmdletBinding()]
param([string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{ Authorization = "Bearer $($token.AccessToken)"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0" }
$api = "$baseUrl/api/data/v9.2"

function Get-AllRows([string] $Path) {
  $rows = @()
  $url = if ($Path -match '^https?://') { $Path } else { "$api$Path" }
  while ($url) {
    $page = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    $rows += @($page.value)
    $nextLink = $page.PSObject.Properties['@odata.nextLink']
    $url = if ($null -ne $nextLink) { [string]$nextLink.Value } else { "" }
  }
  return $rows
}

function As-Utc($Value) {
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  return ([DateTimeOffset]::Parse([string]$Value)).UtcDateTime
}

$possessions = @(Get-AllRows "/new_possedeveiculos?`$select=new_possedeveiculoid,_new_motorista_value,_new_veiculo_value,new_iniciodaposse,new_fimdaposse,_new_trocadecarrorelacionada_value&`$orderby=new_iniciodaposse asc")
$exchanges = @(Get-AllRows "/cr40f_trocasdecarros?`$select=cr40f_trocasdecarroid,cr40f_id,cr40f_statusdatroca,cr40f_fimdajaneladetroca,_cr40f_motorista1_value,_cr40f_motorista2_value,_cr40f_veiculo1antesdatroca_value,_cr40f_veiculo2antesdatroca_value")
$generals = @(Get-AllRows "/cr40f_reservadeveculoses?`$select=cr40f_reservadeveculosid,_cr40f_ot_value")

$issues = [System.Collections.Generic.List[object]]::new()
function Add-Issue([string] $Code, [string] $Entity, [string] $Id, [string] $Detail) {
  $issues.Add([pscustomobject]@{ code = $Code; entity = $Entity; id = $Id; detail = $Detail })
}

foreach ($possession in $possessions) {
  $start = As-Utc $possession.new_iniciodaposse
  $end = As-Utc $possession.new_fimdaposse
  if ($null -eq $start) { Add-Issue "POSSESSION_START_MISSING" "new_possedeveiculo" $possession.new_possedeveiculoid "inicio ausente"; continue }
  if ($null -ne $end -and $end -lt $start) { Add-Issue "POSSESSION_INVALID_WINDOW" "new_possedeveiculo" $possession.new_possedeveiculoid "fim anterior ao inicio" }
}

foreach ($dimension in @(@{ name = "motorista"; field = "_new_motorista_value" }, @{ name = "veiculo"; field = "_new_veiculo_value" })) {
  $groups = $possessions | Where-Object { $_.($dimension.field) } | Group-Object -Property $dimension.field
  foreach ($group in $groups) {
    $ordered = @($group.Group | Sort-Object { As-Utc $_.new_iniciodaposse })
    for ($index = 0; $index -lt $ordered.Count; $index++) {
      $left = $ordered[$index]
      $leftStart = As-Utc $left.new_iniciodaposse
      $leftEnd = As-Utc $left.new_fimdaposse
      for ($otherIndex = $index + 1; $otherIndex -lt $ordered.Count; $otherIndex++) {
        $right = $ordered[$otherIndex]
        $rightStart = As-Utc $right.new_iniciodaposse
        $rightEnd = As-Utc $right.new_fimdaposse
        if ($null -eq $leftStart -or $null -eq $rightStart) { continue }
        $overlap = ($null -eq $leftEnd -or $rightStart -lt $leftEnd) -and ($null -eq $rightEnd -or $leftStart -lt $rightEnd)
        if ($overlap) { Add-Issue "POSSESSION_OVERLAP" "new_possedeveiculo" $left.new_possedeveiculoid "$($dimension.name)=$($group.Name); conflito=$($right.new_possedeveiculoid)" }
      }
    }
  }
}

$generalCounts = @{}
foreach ($general in $generals) {
  if ($general._cr40f_ot_value) {
    $key = ([string]$general._cr40f_ot_value).ToLowerInvariant()
    $currentCount = if ($generalCounts.ContainsKey($key)) { [int]$generalCounts[$key] } else { 0 }
    $generalCounts[$key] = 1 + $currentCount
  }
}
$now = [DateTime]::UtcNow
foreach ($exchange in $exchanges) {
  $id = ([string]$exchange.cr40f_trocasdecarroid).ToLowerInvariant()
  $count = if ($generalCounts.ContainsKey($id)) { [int]$generalCounts[$id] } else { 0 }
  if ($count -eq 0) { Add-Issue "GENERAL_MISSING" "cr40f_trocasdecarro" $exchange.cr40f_id "sem Geral vinculada" }
  if ($count -gt 1) { Add-Issue "GENERAL_DUPLICATE" "cr40f_trocasdecarro" $exchange.cr40f_id "Gerais vinculadas=$count" }
  $windowEnd = As-Utc $exchange.cr40f_fimdajaneladetroca
  if ($exchange.cr40f_statusdatroca -in @(202410000, 100000001) -and $null -ne $windowEnd -and $windowEnd -lt $now) {
    Add-Issue "EXCHANGE_OVERDUE_OPEN" "cr40f_trocasdecarro" $exchange.cr40f_id "janela encerrada em $($windowEnd.ToString('o'))"
  }
}

$summary = $issues | Group-Object code | Sort-Object Name | Select-Object Name,Count
Write-Host "[exchange-possession-audit] posses=$($possessions.Count); trocas=$($exchanges.Count); Gerais=$($generals.Count); problemas=$($issues.Count)"
$summary | Format-Table -AutoSize
$issues | Select-Object -First 100 | Format-Table -AutoSize
Write-Host "[exchange-possession-audit] DRY RUN CONCLUIDO; nenhum dado foi alterado."
