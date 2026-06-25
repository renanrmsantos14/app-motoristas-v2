param(
  [Parameter(Mandatory = $true)]
  [string] $Target,
  [switch] $Spa,
  [string] $Client = "codex"
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://here.now"
$targetPath = (Resolve-Path -LiteralPath $Target).Path
$credentialsPath = Join-Path $HOME ".herenow\credentials"
$apiKey = $env:HERENOW_API_KEY
$apiKeySource = "none"
if ($apiKey) {
  $apiKeySource = "env"
} elseif (Test-Path -LiteralPath $credentialsPath) {
  $apiKey = (Get-Content -LiteralPath $credentialsPath -Raw).Trim()
  if ($apiKey) { $apiKeySource = "credentials" }
}

function Get-ContentType {
  param([string] $Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".htm" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "text/javascript; charset=utf-8"; break }
    ".mjs" { "text/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".txt" { "text/plain; charset=utf-8"; break }
    ".md" { "text/plain; charset=utf-8"; break }
    ".svg" { "image/svg+xml"; break }
    ".png" { "image/png"; break }
    ".jpg" { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".gif" { "image/gif"; break }
    ".webp" { "image/webp"; break }
    ".pdf" { "application/pdf"; break }
    ".ico" { "image/x-icon"; break }
    default { "application/octet-stream" }
  }
}

$rootItem = Get-Item -LiteralPath $targetPath
$files = @()
$fileMap = @{}
if ($rootItem.PSIsContainer) {
  $rootPrefix = $rootItem.FullName.TrimEnd("\", "/")
  foreach ($file in Get-ChildItem -LiteralPath $rootItem.FullName -Recurse -File | Sort-Object FullName) {
    $relative = $file.FullName.Substring($rootPrefix.Length + 1).Replace("\", "/")
    if ($relative -eq ".DS_Store" -or $relative.EndsWith("/.DS_Store")) { continue }
    if ($relative -eq ".herenow/fork-meta.json") { continue }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
    $files += [ordered]@{
      path = $relative
      size = $file.Length
      contentType = Get-ContentType $file.FullName
      hash = $hash
    }
    $fileMap[$relative] = $file.FullName
  }
} else {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $rootItem.FullName).Hash.ToLowerInvariant()
  $files += [ordered]@{
    path = $rootItem.Name
    size = $rootItem.Length
    contentType = Get-ContentType $rootItem.FullName
    hash = $hash
  }
  $fileMap[$rootItem.Name] = $rootItem.FullName
}

if ($files.Count -eq 0) {
  throw "no files found"
}

$body = [ordered]@{ files = $files }
if ($Spa) { $body.spaMode = $true }
$headers = @{ "x-herenow-client" = "$($Client.ToLowerInvariant())/powershell" }
if ($apiKey) { $headers.authorization = "Bearer $apiKey" }

Write-Host "creating publish ($($files.Count) files)..."
$createResponse = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/publish" -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10)
if ($createResponse.error) {
  throw $createResponse.error
}

$uploads = @($createResponse.upload.uploads)
$skipped = @($createResponse.upload.skipped)
Write-Host "uploading $($uploads.Count) files ($($skipped.Count) unchanged, skipped)..."
foreach ($upload in $uploads) {
  $localFile = $fileMap[[string]$upload.path]
  if (-not $localFile -or -not (Test-Path -LiteralPath $localFile)) {
    throw "missing local file for $($upload.path)"
  }
  $contentType = $upload.headers."Content-Type"
  if (-not $contentType) { $contentType = Get-ContentType $localFile }
  $uploadUrl = [string]$upload.url
  $curlArgs = @("-sS", "-o", "NUL", "-w", "%{http_code}", "-X", "PUT", "-H", "Content-Type: $contentType", "--data-binary", "@$localFile", $uploadUrl)
  $httpCode = & curl.exe @curlArgs
  if ($LASTEXITCODE -ne 0 -or [int]$httpCode -lt 200 -or [int]$httpCode -ge 300) {
    throw "upload failed for $($upload.path) (HTTP $httpCode)"
  }
}

Write-Host "finalizing..."
$finalizeBody = @{ versionId = $createResponse.upload.versionId } | ConvertTo-Json
$finalizeResponse = Invoke-RestMethod -Method Post -Uri $createResponse.upload.finalizeUrl -Headers $headers -ContentType "application/json" -Body $finalizeBody
if ($finalizeResponse.error) {
  throw "finalize failed: $($finalizeResponse.error)"
}

$stateDir = Join-Path (Get-Location) ".herenow"
$stateFile = Join-Path $stateDir "state.json"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
if (Test-Path -LiteralPath $stateFile) {
  $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
} else {
  $state = [pscustomobject]@{ publishes = [pscustomobject]@{} }
}
$entry = [ordered]@{ siteUrl = $createResponse.siteUrl }
if ($createResponse.claimToken) { $entry.claimToken = $createResponse.claimToken }
if ($createResponse.claimUrl) { $entry.claimUrl = $createResponse.claimUrl }
if ($createResponse.expiresAt) { $entry.expiresAt = $createResponse.expiresAt }
$state.publishes | Add-Member -Force -NotePropertyName $createResponse.slug -NotePropertyValue ([pscustomobject]$entry)
$state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $stateFile -Encoding UTF8

$authMode = if ($apiKey) { "authenticated" } else { "anonymous" }
$persistence = if ($apiKey) { "permanent" } else { "expires_24h" }
$claimUrl = ""
if ($createResponse.claimUrl -and ([string]$createResponse.claimUrl).StartsWith("https://")) {
  $claimUrl = $createResponse.claimUrl
}

Write-Host $createResponse.siteUrl
Write-Host "publish_result.site_url=$($createResponse.siteUrl)"
Write-Host "publish_result.slug=$($createResponse.slug)"
Write-Host "publish_result.action=create"
Write-Host "publish_result.auth_mode=$authMode"
Write-Host "publish_result.api_key_source=$apiKeySource"
Write-Host "publish_result.persistence=$persistence"
Write-Host "publish_result.expires_at=$($createResponse.expiresAt)"
Write-Host "publish_result.claim_url=$claimUrl"
