param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [switch] $Apply
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$api = "$baseUrl/api/data/v9.2"
$appId = "7c7c8fda-53d0-f011-8543-6045bd3a51ea"
$subAreaId = "subarea_comunicados_motoristas"
$resourceName = "new_gestaocomunicadosmotoristas"
Import-Module MSAL.PS -ErrorAction Stop
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = (Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent).AccessToken
if (-not $token) { throw "Token DEV indisponivel." }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0" }
function Read-Dv([string] $Path) { return Invoke-RestMethod -Method Get -Uri "$api/$Path" -Headers $headers }
function Post-Dv([string] $Path, $Body) { return Invoke-RestMethod -Method Post -Uri "$api/$Path" -Headers $headers -ContentType "application/json; charset=utf-8" -Body ($Body | ConvertTo-Json -Depth 20) }

$app = Read-Dv "appmodules($appId)?`$select=appmoduleid,appmoduleidunique,name"
if ($app.name -ne "App Betinhos Interno") { throw "Aplicativo interno inesperado." }
$components = @((Read-Dv "appmodulecomponents?`$select=objectid,componenttype&`$filter=_appmoduleidunique_value eq $($app.appmoduleidunique) and componenttype eq 62").value)
if ($components.Count -ne 1) { throw "Sitemap do aplicativo ausente ou duplicado." }
$sitemapId = [guid]$components[0].objectid
$sitemap = Read-Dv "sitemaps($sitemapId)?`$select=sitemapid,sitemapname,sitemapxml"
$resource = @((Read-Dv "webresourceset?`$select=webresourceid,name&`$filter=name eq '$resourceName'").value)
if ($resource.Count -ne 1) { throw "WebResource de gestao nao publicado de forma unica." }
[xml]$xml = $sitemap.sitemapxml
$targetGroup = @($xml.SelectNodes("//Group[@Id='group_16b0a016']"))
$oldSubarea = @($xml.SelectNodes("//SubArea[@Id='subarea_comunicados']"))
$existing = @($xml.SelectNodes("//SubArea[@Id='$subAreaId']"))
if ($targetGroup.Count -ne 1 -or $oldSubarea.Count -ne 1 -or $existing.Count -gt 1) { throw "Estrutura do menu inesperada." }
if ($oldSubarea[0].GetAttribute("Url") -ne '$webresource:cr40f_GerenciarComunicados.html') { throw "Entrada antiga de comunicados foi alterada." }
if ($existing.Count -eq 1) {
  if ($existing[0].GetAttribute("Url") -ne "`$webresource:$resourceName") { throw "Nova entrada tem URL inesperada." }
  Write-Output "Menu de Comunicados para Motoristas ja existe; nenhuma alteracao necessaria."
  return
}
if (-not $Apply) { Write-Output "DRY RUN: adicionaria Comunicados para Motoristas em Operacional; entrada antiga preservada."; return }
$backupDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "backup\comunicados"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupPath = Join-Path $backupDir ("sitemap-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".xml")
[IO.File]::WriteAllText($backupPath, $sitemap.sitemapxml, [Text.Encoding]::UTF8)
$newSubarea = $oldSubarea[0].CloneNode($true)
$newSubarea.SetAttribute("Id", $subAreaId)
$newSubarea.SetAttribute("Url", "`$webresource:$resourceName")
$newSubarea.SelectSingleNode("Titles/Title").SetAttribute("Title", "Comunicados para Motoristas")
[void]$targetGroup[0].AppendChild($newSubarea)
$body = @{ sitemapxml = $xml.OuterXml } | ConvertTo-Json -Depth 5
$writeHeaders = $headers.Clone()
$writeHeaders["If-Match"] = "*"
Invoke-RestMethod -Method Patch -Uri "$api/sitemaps($sitemapId)" -Headers $writeHeaders -ContentType "application/json; charset=utf-8" -Body $body | Out-Null
Post-Dv "PublishXml" @{ ParameterXml = "<importexportxml><sitemaps><sitemap>$sitemapId</sitemap></sitemaps><appmodules><appmodule>$appId</appmodule></appmodules></importexportxml>" } | Out-Null
$published = Read-Dv "sitemaps($sitemapId)?`$select=sitemapxml"
[xml]$publishedXml = $published.sitemapxml
$verified = @($publishedXml.SelectNodes("//Group[@Id='group_16b0a016']/SubArea[@Id='$subAreaId']"))
$oldVerified = @($publishedXml.SelectNodes("//SubArea[@Id='subarea_comunicados']"))
if ($verified.Count -ne 1 -or $verified[0].GetAttribute("Url") -ne "`$webresource:$resourceName" -or $oldVerified.Count -ne 1) { throw "Menu publicado diverge do esperado. Backup: $backupPath" }
Write-Output "Menu Operacional publicado com Comunicados para Motoristas. Backup: $backupPath"
