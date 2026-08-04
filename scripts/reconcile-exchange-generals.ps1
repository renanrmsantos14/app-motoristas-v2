[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [switch] $Apply
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[exchange-general-reconcile] $Message"
}

if (-not (Get-Module -ListAvailable MSAL.PS)) { throw "Modulo MSAL.PS nao encontrado." }
Import-Module MSAL.PS -ErrorAction Stop

$baseUrl = $EnvironmentUrl.TrimEnd("/")
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{
  Authorization = "Bearer $($token.AccessToken)"
  Accept = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}
$jsonHeaders = $headers + @{ "Content-Type" = "application/json; charset=utf-8"; "If-Match" = "*" }
$api = "$baseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $Path, $Body = $null, [int] $RetryCount = 0) {
  $uri = if ($Path -match '^https?://') { $Path } else { "$api$Path" }
  try {
    if ($null -eq $Body) { return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $jsonHeaders -Body ($Body | ConvertTo-Json -Depth 10)
  }
  catch {
    $status = ""
    try { $status = [string]$_.Exception.Response.StatusCode.value__ } catch {}
    $isTransient = $status -eq "" -or $status -in @("408", "429", "500", "502", "503", "504")
    if ($Method -in @("GET", "PATCH") -and $isTransient -and $RetryCount -lt 3) {
      Start-Sleep -Seconds ([Math]::Pow(2, $RetryCount + 1))
      return Invoke-Dataverse $Method $Path $Body ($RetryCount + 1)
    }
    $detail = ""
    try { $detail = [string]$_.ErrorDetails.Message } catch {}
    throw "$Method $Path falhou. status=$status $($_.Exception.Message) $detail"
  }
}

function Get-AllRows([string] $Path) {
  $rows = @()
  $next = $Path
  while ($next) {
    $page = Invoke-Dataverse GET $next
    $rows += @($page.value)
    $nextProperty = $page.PSObject.Properties['@odata.nextLink']
    $next = if ($nextProperty) { [string]$nextProperty.Value } else { "" }
  }
  return $rows
}

function Get-LinkedGeneralCounts {
  $counts = @{}
  $rows = @(Get-AllRows "/cr40f_reservadeveculoses?`$select=cr40f_reservadeveculosid,_cr40f_ot_value&`$filter=_cr40f_ot_value ne null")
  foreach ($row in $rows) {
    $exchangeId = ([string]$row._cr40f_ot_value).ToLowerInvariant()
    if (-not $exchangeId) { continue }
    if (-not $counts.ContainsKey($exchangeId)) { $counts[$exchangeId] = 0 }
    $counts[$exchangeId]++
  }
  return $counts
}

$exchanges = @(Get-AllRows "/cr40f_trocasdecarros?`$select=cr40f_trocasdecarroid,cr40f_id,cr40f_statusdatroca&`$orderby=createdon asc")
$counts = Get-LinkedGeneralCounts
foreach ($exchange in $exchanges) {
  $id = ([string]$exchange.cr40f_trocasdecarroid).ToLowerInvariant()
  if ($counts.ContainsKey($id) -and [int]$counts[$id] -gt 1) {
    throw "Troca $($exchange.cr40f_id) possui mais de uma Geral. Reconciliacao abortada."
  }
}

$missing = @($exchanges | Where-Object {
  $id = ([string]$_.cr40f_trocasdecarroid).ToLowerInvariant()
  -not $counts.ContainsKey($id)
})
Write-Step "trocas=$($exchanges.Count); Gerais ausentes=$($missing.Count)"
foreach ($exchange in $missing) {
  Write-Step "missing $($exchange.cr40f_id) status=$($exchange.cr40f_statusdatroca)"
}
if (-not $Apply) {
  Write-Step "DRY RUN OK. Use -Apply para acionar o plugin sem alterar posse."
  return
}

foreach ($exchange in $missing) {
  if ($null -eq $exchange.cr40f_statusdatroca) { throw "Troca $($exchange.cr40f_id) sem status." }
  $id = [string]$exchange.cr40f_trocasdecarroid
  Write-Step "trigger $($exchange.cr40f_id)"
  Invoke-Dataverse PATCH "/cr40f_trocasdecarros($id)" @{ cr40f_statusdatroca = [int]$exchange.cr40f_statusdatroca } | Out-Null
}

$finalCounts = Get-LinkedGeneralCounts
foreach ($exchange in $exchanges) {
  $id = ([string]$exchange.cr40f_trocasdecarroid).ToLowerInvariant()
  if (-not $finalCounts.ContainsKey($id) -or [int]$finalCounts[$id] -ne 1) {
    throw "Troca $($exchange.cr40f_id) nao terminou com exatamente uma Geral."
  }
}
Write-Step "RECONCILIACAO DEV OK. Gerais criadas=$($missing.Count)"
