param(
  [Parameter(Mandatory = $true)]
  [string] $EnvironmentUrl,

  [string] $WebResourceName,

  [string] $SearchText = "motoristas",

  [string] $FilePath = "dist/webresource-app-motoristas.html",

  [string] $TenantId = "organizations",

  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",

  [switch] $SkipBuild,

  [switch] $DeviceCode,

  [switch] $NoPublish
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[deploy-webresource] $Message"
}

function Escape-ODataString([string] $Value) {
  return $Value.Replace("'", "''")
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
$resolvedFilePath = Resolve-Path $FilePath

if (-not $SkipBuild) {
  Write-Step "build"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build falhou com exit code $LASTEXITCODE"
  }
}

if (-not (Get-Module -ListAvailable MSAL.PS)) {
  throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
}

Import-Module MSAL.PS -ErrorAction Stop

Write-Step "auth"
$scope = "$environmentBaseUrl/user_impersonation"
$redirectUri = [Uri] "http://localhost"
$clientApplication = New-MsalClientApplication `
  -ClientId $ClientId `
  -TenantId $TenantId `
  -RedirectUri $redirectUri

Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication

try {
  $tokenResult = Get-MsalToken `
    -PublicClientApplication $clientApplication `
    -Scopes $scope `
    -Silent
}
catch {
  if ($DeviceCode) {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -DeviceCode
  }
  else {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -Interactive
  }
}

$token = $tokenResult.AccessToken
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Falha ao obter token MSAL para $scope"
}

$headers = @{
  "Authorization"    = "Bearer $token"
  "Accept"           = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version"    = "4.0"
}

$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"
if ([string]::IsNullOrWhiteSpace($WebResourceName)) {
  Write-Step "lookup html webresource contendo '$SearchText'"
  $lookupUrl = "$apiBaseUrl/webresourceset?`$select=webresourceid,name,displayname,webresourcetype&`$filter=webresourcetype eq 1"
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $headers
  $matches = @(
    $lookup.value | Where-Object {
      ($_.name -and $_.name.IndexOf($SearchText, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
      ($_.displayname -and $_.displayname.IndexOf($SearchText, [StringComparison]::OrdinalIgnoreCase) -ge 0)
    }
  )

  if ($matches.Count -eq 0) {
    throw "Nenhum HTML WebResource encontrado contendo '$SearchText'. Rode com -WebResourceName 'nome_unico.html'."
  }

  if ($matches.Count -gt 1) {
    $matchList = $matches | ForEach-Object { "- name=$($_.name) | displayname=$($_.displayname) | id=$($_.webresourceid)" }
    throw "Mais de um HTML WebResource encontrado contendo '$SearchText'. Configure -WebResourceName.`n$($matchList -join "`n")"
  }

  $webResource = $matches[0]
  $WebResourceName = $webResource.name
}
else {
  $escapedName = Escape-ODataString $WebResourceName
  $lookupUrl = "$apiBaseUrl/webresourceset?`$select=webresourceid,name,displayname&`$filter=name eq '$escapedName'"

  Write-Step "lookup $WebResourceName"
  $lookup = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $headers

  if (-not $lookup.value -or $lookup.value.Count -eq 0) {
    throw "WebResource nao encontrado: $WebResourceName"
  }

  if ($lookup.value.Count -gt 1) {
    throw "Mais de um WebResource encontrado para name='$WebResourceName'. Deploy abortado."
  }

  $webResource = $lookup.value[0]
}

$webResourceId = $webResource.webresourceid
$html = Get-Content -Path $resolvedFilePath -Raw -Encoding UTF8
$contentBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($html))

$patchBody = @{
  content = $contentBase64
} | ConvertTo-Json -Depth 4

Write-Step "patch $webResourceId"
Invoke-RestMethod `
  -Method Patch `
  -Uri "$apiBaseUrl/webresourceset($webResourceId)" `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $patchBody | Out-Null

if (-not $NoPublish) {
  $publishXml = "<importexportxml><webresources><webresource>$webResourceId</webresource></webresources></importexportxml>"
  $publishBody = @{
    ParameterXml = $publishXml
  } | ConvertTo-Json -Depth 4

  Write-Step "publish $webResourceId"
  Invoke-RestMethod `
    -Method Post `
    -Uri "$apiBaseUrl/PublishXml" `
    -Headers $headers `
    -ContentType "application/json; charset=utf-8" `
    -Body $publishBody | Out-Null
}

Write-Step "ok $WebResourceName"
