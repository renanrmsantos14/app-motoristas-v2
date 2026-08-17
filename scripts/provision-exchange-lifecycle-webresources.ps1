param(
  [Parameter(Mandatory = $true)] [string] $EnvironmentUrl,
  [string] $SolutionUniqueName = "AppBetinhos",
  [switch] $Apply,
  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) { Write-Host "[exchange-lifecycle-webresources] $Message" }
function Escape-OData([string] $Value) { $Value.Replace("'", "''") }

Import-Module MSAL.PS -ErrorAction Stop
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$scope = "$baseUrl/user_impersonation"
$token = if ($DeviceCode) { (Get-MsalToken -PublicClientApplication $client -Scopes $scope -DeviceCode).AccessToken } else { try { (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Silent).AccessToken } catch { (Get-MsalToken -PublicClientApplication $client -Scopes $scope).AccessToken } }
$api = "$baseUrl/api/data/v9.2"
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; "MSCRM.SolutionUniqueName" = $SolutionUniqueName }

function Request([string] $Method, [string] $Path, [object] $Body) {
  $params = @{ Method = $Method; Uri = "$api/$Path"; Headers = $headers; ContentType = "application/json; charset=utf-8" }
  if ($null -ne $Body) { $params.Body = $Body | ConvertTo-Json -Depth 10 -Compress }
  return Invoke-RestMethod @params
}

function Add-SolutionComponent([guid] $Id) {
  $solutions = @((Request "GET" "solutions?`$select=solutionid,ismanaged&`$filter=uniquename eq '$(Escape-OData $SolutionUniqueName)'" $null).value)
  if ($solutions.Count -ne 1 -or [bool]$solutions[0].ismanaged) { throw "Solucao $SolutionUniqueName nao e unmanaged unica." }
  $components = @((Request "GET" "solutioncomponents?`$select=solutioncomponentid&`$filter=_solutionid_value eq $($solutions[0].solutionid) and objectid eq $Id and componenttype eq 61" $null).value)
  if ($components.Count -eq 0) { Request "POST" "AddSolutionComponent" @{ ComponentId = $Id; ComponentType = 61; SolutionUniqueName = $SolutionUniqueName; AddRequiredComponents = $false } | Out-Null }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$resources = @(
  @{ Name = "new_exchange_lifecycle_commands.js"; DisplayName = "Comandos do ciclo de troca"; Type = 3; File = Join-Path $root "webresources\new_exchange_lifecycle_commands.js" },
  @{ Name = "new_exchange_lifecycle_dialog.html"; DisplayName = "Dialogo do ciclo de troca"; Type = 1; File = Join-Path $root "webresources\new_exchange_lifecycle_dialog.html" }
)

foreach ($resource in $resources) {
  $rows = @((Request "GET" "webresourceset?`$select=webresourceid,name&`$filter=name eq '$(Escape-OData $resource.Name)'" $null).value)
  if ($rows.Count -gt 1) { throw "WebResource duplicado: $($resource.Name)" }
  if (-not $Apply) { Write-Step "DRY RUN atualizaria $($resource.Name)"; continue }
  $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($resource.File))
  if ($rows.Count -eq 0) {
    Request "POST" "webresourceset" @{ name = $resource.Name; displayname = $resource.DisplayName; webresourcetype = $resource.Type; content = $content } | Out-Null
    $createdRows = @((Request "GET" "webresourceset?`$select=webresourceid,name&`$filter=name eq '$(Escape-OData $resource.Name)'" $null).value)
    if ($createdRows.Count -ne 1) { throw "WebResource $($resource.Name) criado, mas nao foi localizado de forma univoca." }
    $id = [guid]$createdRows[0].webresourceid
  }
  else {
    $id = [guid]$rows[0].webresourceid
    Request "PATCH" "webresourceset($id)" @{ content = $content } | Out-Null
  }
  Add-SolutionComponent $id
  Write-Step "webresource publicado $($resource.Name)"
}

if ($Apply) {
  Request "POST" "PublishAllXml" @{} | Out-Null
  Write-Step "PUBLICACAO DEV OK"
}
else {
  Write-Step "DRY RUN OK; use -Apply para publicar no DEV"
}
