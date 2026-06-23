param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [int] $Top = 10,
  [switch] $SilentOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-MsalAccessTokenForScope([string[]] $Scopes) {
  $redirectUri = [Uri] "http://localhost"
  $clientApplication = New-MsalClientApplication `
    -ClientId $ClientId `
    -TenantId $TenantId `
    -RedirectUri $redirectUri

  Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication

  try {
    $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $Scopes -Silent
  }
  catch {
    if ($SilentOnly) {
      throw "Token silencioso indisponivel para $($Scopes -join ', '): $($_.Exception.Message)"
    }
    $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $Scopes -DeviceCode
  }

  if ([string]::IsNullOrWhiteSpace($tokenResult.AccessToken)) {
    throw "Token vazio para $($Scopes -join ', ')"
  }
  return $tokenResult.AccessToken
}

function ConvertTo-GraphShareToken([string] $Url) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Url)
  $base64 = [Convert]::ToBase64String($bytes)
  return "u!" + $base64.TrimEnd("=").Replace("/", "_").Replace("+", "-")
}

function Get-FirstUrl([string] $Value) {
  $match = [regex]::Match($Value, "https?://[^\s<>'""]+")
  if ($match.Success) { return $match.Value }
  return ""
}

Import-Module MSAL.PS -ErrorAction Stop

$environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
$dataverseToken = Get-MsalAccessTokenForScope @("$environmentBaseUrl/user_impersonation")
$dataverseHeaders = @{
  Authorization = "Bearer $dataverseToken"
  Accept = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}

$select = "cr40f_manutencoesid,cr40f_id,cr40f_foto01,cr40f_linkdaevidencia,cr40f_foto03,new_linkdafotofinal1,new_linkdafotofinal2,new_linkdafotofinal3"
$filter = "cr40f_foto01 ne null or cr40f_linkdaevidencia ne null or cr40f_foto03 ne null or new_linkdafotofinal1 ne null or new_linkdafotofinal2 ne null or new_linkdafotofinal3 ne null"
$query = "cr40f_manutencoeses?`$select=$select&`$filter=$([uri]::EscapeDataString($filter))&`$top=$Top"
$records = Invoke-RestMethod -Method Get -Uri "$environmentBaseUrl/api/data/v9.2/$query" -Headers $dataverseHeaders

if (-not $records.value -or $records.value.Count -eq 0) {
  throw "Nenhuma manutencao com link de foto encontrada no Dataverse."
}

$photoFields = @("cr40f_foto01", "cr40f_linkdaevidencia", "cr40f_foto03", "new_linkdafotofinal1", "new_linkdafotofinal2", "new_linkdafotofinal3")
$candidate = $null
foreach ($record in $records.value) {
  foreach ($field in $photoFields) {
    $rawValue = ""
    if ($null -ne $record.$field) {
      $rawValue = [string] $record.$field
    }
    $url = Get-FirstUrl $rawValue
    if (-not [string]::IsNullOrWhiteSpace($url)) {
      $candidate = [pscustomobject]@{
        MaintenanceId = $record.cr40f_id
        Field = $field
        Url = $url
      }
      break
    }
  }
  if ($candidate) { break }
}

if (-not $candidate) {
  throw "Registros encontrados, mas nenhum URL http(s) foi extraido dos campos de foto."
}

$graphToken = Get-MsalAccessTokenForScope @("https://graph.microsoft.com/Files.Read")
$graphHeaders = @{
  Authorization = "Bearer $graphToken"
  Accept = "application/json"
  Prefer = "redeemSharingLinkIfNecessary"
}

$shareToken = ConvertTo-GraphShareToken $candidate.Url
$driveItemUrl = "https://graph.microsoft.com/v1.0/shares/$shareToken/driveItem?`$select=id,name,file,image,photo,@microsoft.graph.downloadUrl"
$driveItem = Invoke-RestMethod -Method Get -Uri $driveItemUrl -Headers $graphHeaders
$downloadUrl = $driveItem.'@microsoft.graph.downloadUrl'
if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
  throw "Graph resolveu driveItem, mas nao retornou @microsoft.graph.downloadUrl."
}

$response = Invoke-WebRequest -Method Get -Uri $downloadUrl -MaximumRedirection 5
$contentType = [string] $response.Headers["Content-Type"]
if (-not $contentType.StartsWith("image/", [StringComparison]::OrdinalIgnoreCase)) {
  throw "Download retornou Content-Type nao imagem: $contentType"
}

$bytes = $response.Content
if ($bytes -is [string]) {
  $byteLength = [Text.Encoding]::UTF8.GetByteCount($bytes)
} else {
  $byteLength = $bytes.Length
}
if ($byteLength -le 1000) {
  throw "Imagem baixada pequena demais: $byteLength bytes"
}

[pscustomobject]@{
  ok = $true
  maintenanceId = $candidate.MaintenanceId
  field = $candidate.Field
  driveItemName = $driveItem.name
  contentType = $contentType
  bytes = $byteLength
} | ConvertTo-Json -Compress
