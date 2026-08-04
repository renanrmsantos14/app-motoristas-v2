[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $SolutionUniqueName = "AppBetinhos",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[possession-keys] $Message"
}

function Label([string] $Text) {
  return @{ LocalizedLabels = @(@{ Label = $Text; LanguageCode = 1046 }) }
}

if (-not (Get-Module -ListAvailable MSAL.PS)) {
  throw "Modulo MSAL.PS nao encontrado."
}
Import-Module MSAL.PS -ErrorAction Stop

$baseUrl = $EnvironmentUrl.TrimEnd("/")
$client = New-MsalClientApplication -ClientId $ClientId -TenantId $TenantId -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
try {
  $token = if ($DeviceCode) {
    Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -DeviceCode
  }
  else {
    Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
  }
}
catch {
  throw "Autenticacao DEV falhou. Execute novamente com -DeviceCode. $($_.Exception.Message)"
}

$headers = @{
  Authorization = "Bearer $($token.AccessToken)"
  Accept = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
  "MSCRM.SolutionUniqueName" = $SolutionUniqueName
}
$jsonHeaders = $headers + @{ "Content-Type" = "application/json; charset=utf-8" }
$api = "$baseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $Path, $Body = $null, [switch] $AllowNotFound, [int] $RetryCount = 0) {
  $uri = if ($Path -match '^https?://') { $Path } else { "$api$Path" }
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $jsonHeaders -Body ($Body | ConvertTo-Json -Depth 20)
  }
  catch {
    $status = ""
    try { $status = [string]$_.Exception.Response.StatusCode.value__ } catch {}
    $detail = ""
    try { $detail = [string]$_.ErrorDetails.Message } catch {}
    try {
      $stream = if (-not $detail) { $_.Exception.Response.GetResponseStream() } else { $null }
      if ($stream) {
        $reader = [System.IO.StreamReader]::new($stream)
        $detail = $reader.ReadToEnd()
        $reader.Dispose()
      }
    } catch {}
    if ($AllowNotFound -and $status -in @("400", "404")) { return $null }
    if ($Method -eq "GET" -and $RetryCount -lt 3 -and ($status -eq "" -or $status -in @("408", "429", "500", "502", "503", "504"))) {
      $delay = [Math]::Pow(2, $RetryCount + 1)
      Write-Step "transient GET failure status=$status; retry $($RetryCount + 1)/3 in ${delay}s"
      Start-Sleep -Seconds $delay
      return Invoke-Dataverse $Method $Path $Body -AllowNotFound:$AllowNotFound -RetryCount ($RetryCount + 1)
    }
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

function Get-EntitySetName([string] $LogicalName) {
  $metadata = Invoke-Dataverse GET "/EntityDefinitions(LogicalName='$LogicalName')?`$select=EntitySetName"
  if (-not $metadata.EntitySetName) { throw "EntitySetName nao encontrado para $LogicalName." }
  return [string]$metadata.EntitySetName
}

function Get-SolutionId {
  $escaped = $SolutionUniqueName.Replace("'", "''")
  $rows = @(Get-AllRows "/solutions?`$select=solutionid&`$filter=uniquename eq '$escaped'")
  if ($rows.Count -ne 1) { throw "Solucao $SolutionUniqueName nao encontrada de forma unica." }
  return [string]$rows[0].solutionid
}

function Ensure-SolutionComponent([string] $SolutionId, [guid] $ComponentId, [int] $ComponentType, [string] $Label) {
  $rows = @(Get-AllRows "/solutioncomponents?`$select=solutioncomponentid&`$filter=_solutionid_value eq $SolutionId and objectid eq $ComponentId and componenttype eq $ComponentType")
  if ($rows.Count -gt 1) { throw "Componente $Label aparece duplicado na solucao." }
  if ($rows.Count -eq 1) {
    Write-Step "solution component exists $Label"
    return
  }
  Write-Step "add solution component $Label"
  Invoke-Dataverse POST "/AddSolutionComponent" @{
    ComponentId = $ComponentId
    ComponentType = $ComponentType
    SolutionUniqueName = $SolutionUniqueName
    AddRequiredComponents = $false
    DoNotIncludeSubcomponents = $true
  } | Out-Null
}

function Test-Attribute([string] $LogicalName) {
  return $null -ne (Invoke-Dataverse GET "/EntityDefinitions(LogicalName='new_possedeveiculo')/Attributes(LogicalName='$LogicalName')?`$select=LogicalName" -AllowNotFound)
}

function Ensure-StringAttribute([string] $SchemaName, [string] $LogicalName, [string] $DisplayName) {
  if (Test-Attribute $LogicalName) {
    Write-Step "column exists $LogicalName"
    return
  }
  Write-Step "create column $LogicalName"
  Invoke-Dataverse POST "/EntityDefinitions(LogicalName='new_possedeveiculo')/Attributes" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
    SchemaName = $SchemaName
    DisplayName = Label $DisplayName
    Description = Label "Chave tecnica para impedir mais de uma posse aberta simultanea."
    RequiredLevel = @{ Value = "None" }
    MaxLength = 40
    FormatName = @{ Value = "Text" }
  } | Out-Null
}

function Get-Keys([string] $EntityLogicalName) {
  return Invoke-Dataverse GET "/EntityDefinitions(LogicalName='$EntityLogicalName')/Keys?`$select=SchemaName,LogicalName,KeyAttributes,EntityKeyIndexStatus,MetadataId"
}

function Ensure-Key([string] $EntityLogicalName, [string] $SchemaName, [string] $Attribute, [string] $DisplayName) {
  $keyResponse = Get-Keys $EntityLogicalName
  $existing = @(@($keyResponse.value) | Where-Object { $_.SchemaName -eq $SchemaName -or $_.KeyAttributes -contains $Attribute })
  if ($existing.Count -gt 1) { throw "Mais de uma chave encontrada para $Attribute." }
  if ($existing.Count -eq 1) {
    Write-Step "key exists $SchemaName status=$($existing[0].EntityKeyIndexStatus)"
    return
  }
  Write-Step "create alternate key $SchemaName"
  Invoke-Dataverse POST "/EntityDefinitions(LogicalName='$EntityLogicalName')/Keys" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.EntityKeyMetadata"
    SchemaName = $SchemaName
    DisplayName = Label $DisplayName
    KeyAttributes = @($Attribute)
  } | Out-Null
}

Write-Step "preflight all open possessions and linked Generals"
$possessionSet = Get-EntitySetName "new_possedeveiculo"
$generalSet = Get-EntitySetName "cr40f_reservadeveculos"
$open = @(Get-AllRows "/$possessionSet`?`$select=new_possedeveiculoid,_new_motorista_value,_new_veiculo_value,new_iniciodaposse&`$filter=new_fimdaposse eq null")
$driverSeen = @{}
$vehicleSeen = @{}
foreach ($row in $open) {
  $vehicleId = [string]$row._new_veiculo_value
  $driverId = [string]$row._new_motorista_value
  if (-not $vehicleId) { throw "Posse aberta $($row.new_possedeveiculoid) sem veiculo." }
  if ($vehicleSeen.ContainsKey($vehicleId)) { throw "Veiculo $vehicleId possui mais de uma posse aberta. Nenhuma chave foi criada." }
  $vehicleSeen[$vehicleId] = $true
  if ($driverId) {
    if ($driverSeen.ContainsKey($driverId)) { throw "Motorista $driverId possui mais de uma posse aberta. Nenhuma chave foi criada." }
    $driverSeen[$driverId] = $true
  }
}

$linkedGenerals = @(Get-AllRows "/$generalSet`?`$select=cr40f_reservadeveculosid,_cr40f_ot_value&`$filter=_cr40f_ot_value ne null")
$exchangeSeen = @{}
foreach ($row in $linkedGenerals) {
  $exchangeId = [string]$row._cr40f_ot_value
  if (-not $exchangeId) { continue }
  if ($exchangeSeen.ContainsKey($exchangeId)) {
    throw "Troca $exchangeId possui mais de uma Geral vinculada. Nenhuma chave foi criada. Corrija a duplicidade primeiro."
  }
  $exchangeSeen[$exchangeId] = $true
}

Ensure-StringAttribute "new_ChaveMotoristaPosseAberta" "new_chavemotoristaposseaberta" "Chave motorista posse aberta"
Ensure-StringAttribute "new_ChaveVeiculoPosseAberta" "new_chaveveiculoposseaberta" "Chave veiculo posse aberta"
Invoke-Dataverse POST "/PublishAllXml" @{} | Out-Null

Write-Step "backfill open possession keys"
foreach ($row in $open) {
  $payload = @{ new_chaveveiculoposseaberta = ([string]$row._new_veiculo_value).ToLowerInvariant() }
  if ($row._new_motorista_value) { $payload.new_chavemotoristaposseaberta = ([string]$row._new_motorista_value).ToLowerInvariant() }
  Invoke-Dataverse PATCH "/$possessionSet($($row.new_possedeveiculoid))" $payload | Out-Null
}

$keySpecs = @(
  @{ Entity = "new_possedeveiculo"; Schema = "new_ChaveMotoristaPosseAberta_Key"; Attribute = "new_chavemotoristaposseaberta"; DisplayName = "Motorista com posse aberta unica" },
  @{ Entity = "new_possedeveiculo"; Schema = "new_ChaveVeiculoPosseAberta_Key"; Attribute = "new_chaveveiculoposseaberta"; DisplayName = "Veiculo com posse aberta unica" },
  @{ Entity = "cr40f_reservadeveculos"; Schema = "cr40f_OT_GeralUnica_Key"; Attribute = "cr40f_ot"; DisplayName = "Geral unica por troca" }
)
foreach ($spec in $keySpecs) {
  Ensure-Key $spec.Entity $spec.Schema $spec.Attribute $spec.DisplayName
}
Invoke-Dataverse POST "/PublishAllXml" @{} | Out-Null

Write-Step "wait until all alternate keys are active"
for ($attempt = 1; $attempt -le 60; $attempt++) {
  $pending = @()
  foreach ($spec in $keySpecs) {
    $response = Get-Keys $spec.Entity
    $matches = @(@($response.value) | Where-Object { $_.SchemaName -eq $spec.Schema })
    if ($matches.Count -ne 1) { throw "Chave $($spec.Schema) nao foi encontrada de forma unica." }
    $status = [string]$matches[0].EntityKeyIndexStatus
    if ($status -match "Failed|3") { throw "Chave $($spec.Schema) falhou: status=$status." }
    if ($status -notmatch "Active|2") { $pending += "$($spec.Schema)=$status" }
  }
  if ($pending.Count -eq 0) { break }
  if ($attempt -eq 60) { throw "Chaves nao ficaram ativas no prazo: $($pending -join ', ')." }
  Write-Step "indexes pending ($attempt/60): $($pending -join ', ')"
  Start-Sleep -Seconds 2
}
foreach ($spec in $keySpecs) {
  Write-Step "key active $($spec.Schema)"
}

Write-Step "ensure columns and keys are exportable in solution $SolutionUniqueName"
$solutionId = Get-SolutionId
foreach ($attributeName in @("new_chavemotoristaposseaberta", "new_chaveveiculoposseaberta")) {
  $attribute = Invoke-Dataverse GET "/EntityDefinitions(LogicalName='new_possedeveiculo')/Attributes(LogicalName='$attributeName')?`$select=MetadataId"
  Ensure-SolutionComponent $solutionId ([guid]$attribute.MetadataId) 2 $attributeName
}
foreach ($spec in $keySpecs) {
  $response = Get-Keys $spec.Entity
  $matches = @(@($response.value) | Where-Object { $_.SchemaName -eq $spec.Schema })
  if ($matches.Count -ne 1) { throw "Chave $($spec.Schema) nao foi encontrada de forma unica para a solucao." }
  Ensure-SolutionComponent $solutionId ([guid]$matches[0].MetadataId) 14 $spec.Schema
}
Write-Step "PROVISIONAMENTO DEV OK. Posses abertas=$($open.Count); Gerais vinculadas=$($linkedGenerals.Count)"
