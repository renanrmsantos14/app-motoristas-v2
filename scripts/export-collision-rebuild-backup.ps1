param(
  [string] $EnvironmentUrl = "https://appbetinhosdev.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [string] $OutputDir = "backup",
  [switch] $DeviceCode,
  [switch] $Interactive
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[collision-backup] $Message"
}

function Escape-ODataString([string] $Value) {
  return $Value.Replace("'", "''")
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Get-Module -ListAvailable MSAL.PS)) {
  throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
}

Import-Module MSAL.PS -ErrorAction Stop

$environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
$scope = "$environmentBaseUrl/user_impersonation"
$redirectUri = [Uri] "http://localhost"
$clientApplication = New-MsalClientApplication `
  -ClientId $ClientId `
  -TenantId $TenantId `
  -RedirectUri $redirectUri

Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication

Write-Step "auth $environmentBaseUrl"
try {
  if ($DeviceCode) {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -DeviceCode
  }
  elseif ($Interactive) {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -Interactive
  }
  else {
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -Silent
  }
}
catch {
  if (-not $DeviceCode -and -not $Interactive) {
    Write-Step "silent auth failed, falling back to device code"
    $tokenResult = Get-MsalToken `
      -PublicClientApplication $clientApplication `
      -Scopes $scope `
      -DeviceCode
  }
  else {
    throw
  }
}

if ([string]::IsNullOrWhiteSpace($tokenResult.AccessToken)) {
  throw "Falha ao obter token Dataverse."
}

$headers = @{
  "Authorization" = "Bearer $($tokenResult.AccessToken)"
  "Accept" = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}
$jsonHeaders = $headers + @{
  "Content-Type" = "application/json; charset=utf-8"
}
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $PathOrUrl, $Body = $null) {
  $uri = if ($PathOrUrl.StartsWith("http", [StringComparison]::OrdinalIgnoreCase)) { $PathOrUrl } else { "$apiBaseUrl$PathOrUrl" }
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    $json = $Body | ConvertTo-Json -Depth 30
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $jsonHeaders -Body $json
  }
  catch {
    $responseText = ""
    if ($_.Exception.Response) {
      try {
        $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseText = $reader.ReadToEnd()
      }
      catch {}
    }
    $statusCode = ""
    $statusDescription = ""
    try {
      $statusCode = [string]$_.Exception.Response.StatusCode.value__
      $statusDescription = [string]$_.Exception.Response.StatusDescription
    }
    catch {}
    throw "$Method $PathOrUrl falhou: status=$statusCode $statusDescription body=$responseText"
  }
}

function Read-AllRecords([string] $EntitySetName) {
  $records = New-Object System.Collections.Generic.List[object]
  $next = "$apiBaseUrl/$($EntitySetName)?`$top=5000"
  while ($next) {
    $page = Invoke-Dataverse "GET" $next
    foreach ($row in @($page.value)) {
      $records.Add($row)
    }
    $next = $null
    if ($page.PSObject.Properties.Name -contains "@odata.nextLink") {
      $next = $page.'@odata.nextLink'
    }
  }
  return $records.ToArray()
}

$resolvedOutputDir = Join-Path $root $OutputDir
New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null

$tables = @(
  @{ logicalName = "cr40f_anexorecebimento"; entitySetName = "cr40f_anexorecebimentos" },
  @{ logicalName = "cr40f_anexocolisao"; entitySetName = "cr40f_anexocolisaos" },
  @{ logicalName = "cr40f_colisao"; entitySetName = "cr40f_colisaos" }
)

$dataTables = @{}
$metadataTables = @{}
foreach ($table in $tables) {
  Write-Step "metadata $($table.logicalName)"
  $escapedLogicalName = Escape-ODataString $table.logicalName
  $metadataTables[$table.logicalName] = Invoke-Dataverse "GET" "/EntityDefinitions(LogicalName='$escapedLogicalName')?`$select=LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute&`$expand=Attributes(`$select=LogicalName,SchemaName,AttributeType,RequiredLevel,DisplayName),ManyToOneRelationships(`$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity)"

  Write-Step "data $($table.entitySetName)"
  $dataTables[$table.logicalName] = @{
    entitySetName = $table.entitySetName
    records = @(Read-AllRecords $table.entitySetName)
  }
}

$dataBackup = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  environment = $environmentBaseUrl
  exportStatus = "ok"
  tables = $dataTables
}

$metadataBackup = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  environment = $environmentBaseUrl
  tables = $metadataTables
}

$dataPath = Join-Path $resolvedOutputDir "dataverse-data-before.json"
$metadataPath = Join-Path $resolvedOutputDir "dataverse-live-metadata-before.json"

$dataBackup | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $dataPath -Encoding UTF8
$metadataBackup | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Step "wrote $dataPath"
Write-Step "wrote $metadataPath"
Write-Step "ok"
