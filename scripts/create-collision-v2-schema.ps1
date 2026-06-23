param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [string] $SolutionUniqueName = "Betinhos_Core_Clean"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[collision-v2-schema] $Message"
}

function Label([string] $Text) {
  return @{
    LocalizedLabels = @(
      @{ Label = $Text; LanguageCode = 1046 }
    )
  }
}

function RequiredLevel([bool] $Required) {
  return @{ Value = $(if ($Required) { "ApplicationRequired" } else { "None" }) }
}

function Option([int] $Value, [string] $Text) {
  return @{ Value = $Value; Label = Label $Text }
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
$tokenResult = Get-MsalToken `
  -PublicClientApplication $clientApplication `
  -Scopes $scope `
  -Silent

$headers = @{
  "Authorization" = "Bearer $($tokenResult.AccessToken)"
  "Accept" = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}
$jsonHeaders = $headers + @{ "Content-Type" = "application/json; charset=utf-8" }
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $PathOrUrl, $Body = $null, [bool] $AllowNotFound = $false) {
  $uri = if ($PathOrUrl.StartsWith("http", [StringComparison]::OrdinalIgnoreCase)) { $PathOrUrl } else { "$apiBaseUrl$PathOrUrl" }
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    $json = $Body | ConvertTo-Json -Depth 50
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
    if ($AllowNotFound -and ($statusCode -in @("400", "404"))) {
      return $null
    }
    if ($AllowNotFound -and ($responseText -match "Could not find|Does Not Exist|not found|0x80040217|0x80060888")) {
      return $null
    }
    throw "$Method $PathOrUrl falhou: status=$statusCode $statusDescription body=$responseText"
  }
}

function Get-Entity([string] $LogicalName, [bool] $AllowNotFound = $false) {
  $escaped = Escape-ODataString $LogicalName
  return Invoke-Dataverse "GET" "/EntityDefinitions(LogicalName='$escaped')?`$select=LogicalName,SchemaName,EntitySetName,MetadataId" $null $AllowNotFound
}

function Test-Attribute([string] $Table, [string] $LogicalName) {
  $escapedTable = Escape-ODataString $Table
  $escapedAttr = Escape-ODataString $LogicalName
  $result = Invoke-Dataverse "GET" "/EntityDefinitions(LogicalName='$escapedTable')/Attributes(LogicalName='$escapedAttr')?`$select=LogicalName" $null $true
  return $null -ne $result
}

function New-Entity([string] $SchemaName, [string] $DisplayName, [string] $CollectionName, [string] $PrimaryNameSchema) {
  $logicalName = $SchemaName.ToLowerInvariant()
  $existing = Get-Entity $logicalName $true
  if ($existing) {
    Write-Step "table exists $logicalName"
    return $existing
  }

  Write-Step "create table $logicalName"
  $body = @{
    "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
    SchemaName = $SchemaName
    DisplayName = Label $DisplayName
    DisplayCollectionName = Label $CollectionName
    Description = Label "$DisplayName recriado com metadata limpa"
    OwnershipType = "UserOwned"
    IsActivity = $false
    HasActivities = $false
    HasNotes = $false
    Attributes = @(
      @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        AttributeType = "String"
        AttributeTypeName = @{ Value = "StringType" }
        SchemaName = $PrimaryNameSchema
        RequiredLevel = RequiredLevel $true
        MaxLength = 120
        FormatName = @{ Value = "Text" }
        DisplayName = Label "Nome"
        Description = Label "Identificador legivel do registro."
        IsPrimaryName = $true
      }
    )
  }
  Invoke-Dataverse "POST" "/EntityDefinitions" $body | Out-Null
  Start-Sleep -Seconds 6
  return Get-Entity $logicalName
}

function Add-Attribute([string] $Table, [hashtable] $Config) {
  if (Test-Attribute $Table $Config.logical) {
    Write-Step "column exists $Table.$($Config.logical)"
    return
  }

  $isRequired = $Config.ContainsKey("required") -and $Config.required -eq $true
  $base = @{
    SchemaName = $Config.schema
    DisplayName = Label $Config.label
    RequiredLevel = RequiredLevel ([bool]$isRequired)
  }

  switch ($Config.type) {
    "string" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "Text" }
      }
    }
    "url" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "Url" }
      }
    }
    "phone" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "Phone" }
      }
    }
    "memo" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "TextArea" }
      }
    }
    "integer" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        MinValue = -2147483648
        MaxValue = 2147483647
      }
    }
    "datetime" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
        Format = "DateAndTime"
        DateTimeBehavior = @{ Value = "UserLocal" }
      }
    }
    "boolean" {
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        DefaultValue = $false
        OptionSet = @{
          TrueOption = Option 1 "Sim"
          FalseOption = Option 0 "Nao"
        }
      }
    }
    "picklist" {
      $options = @()
      foreach ($option in $Config.options) {
        $options += Option ([int]$option[0]) ([string]$option[1])
      }
      $body = $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        OptionSet = @{
          IsGlobal = $false
          OptionSetType = "Picklist"
          Options = $options
        }
      }
    }
    default {
      throw "Tipo de coluna nao suportado: $($Config.type)"
    }
  }

  Write-Step "create column $Table.$($Config.logical)"
  Invoke-Dataverse "POST" "/EntityDefinitions(LogicalName='$Table')/Attributes" $body | Out-Null
}

function Add-Relationship([hashtable] $Config) {
  $escaped = Escape-ODataString $Config.schema
  $existing = Invoke-Dataverse "GET" "/RelationshipDefinitions(SchemaName='$escaped')?`$select=SchemaName" $null $true
  if ($existing) {
    Write-Step "relationship exists $($Config.schema)"
    return
  }

  Write-Step "create relationship $($Config.schema)"
  $body = @{
    "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
    SchemaName = $Config.schema
    ReferencedEntity = $Config.referenced
    ReferencingEntity = $Config.referencing
    Lookup = @{
      "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
      SchemaName = $Config.lookupSchema
      DisplayName = Label $Config.lookupLabel
      RequiredLevel = RequiredLevel ([bool]$Config.required)
    }
    CascadeConfiguration = @{
      Assign = "NoCascade"
      Delete = "Restrict"
      Merge = "NoCascade"
      Reparent = "NoCascade"
      Share = "NoCascade"
      Unshare = "NoCascade"
    }
  }
  Invoke-Dataverse "POST" "/RelationshipDefinitions" $body | Out-Null
}

function Ensure-Solution() {
  $escaped = Escape-ODataString $SolutionUniqueName
  $existing = Invoke-Dataverse "GET" "/solutions?`$select=solutionid,uniquename,friendlyname&`$filter=uniquename eq '$escaped'&`$top=1"
  if ($existing.value.Count -gt 0) {
    Write-Step "solution exists $SolutionUniqueName"
    return $existing.value[0]
  }

  $publisher = Invoke-Dataverse "GET" "/publishers?`$select=publisherid,uniquename&`$filter=uniquename eq 'DefaultPublisherorg23b93544'&`$top=1"
  if ($publisher.value.Count -eq 0) {
    throw "Publisher DefaultPublisherorg23b93544 nao encontrado."
  }

  Write-Step "create solution $SolutionUniqueName"
  $body = @{
    uniquename = $SolutionUniqueName
    friendlyname = "Betinhos Core Clean"
    version = "1.0.0.0"
    "publisherid@odata.bind" = "/publishers($($publisher.value[0].publisherid))"
  }
  Invoke-Dataverse "POST" "/solutions" $body | Out-Null
  $created = Invoke-Dataverse "GET" "/solutions?`$select=solutionid,uniquename,friendlyname&`$filter=uniquename eq '$escaped'&`$top=1"
  return $created.value[0]
}

function Add-TableToSolution([string] $LogicalName) {
  $entity = Get-Entity $LogicalName
  Write-Step "add to solution $SolutionUniqueName $LogicalName"
  $body = @{
    ComponentId = $entity.MetadataId
    ComponentType = 1
    SolutionUniqueName = $SolutionUniqueName
    AddRequiredComponents = $false
    IncludedComponentSettingsValues = $null
  }
  try {
    Invoke-Dataverse "POST" "/AddSolutionComponent" $body | Out-Null
  }
  catch {
    Write-Step "add solution component warning ${LogicalName}: $($_.Exception.Message)"
  }
}

$solution = Ensure-Solution

New-Entity "cr40f_Colisao_v2" "Colisao v2" "Colisoes v2" "cr40f_Nome" | Out-Null
New-Entity "cr40f_AnexoRecebimento_v2" "Anexo de Recebimento v2" "Anexos de Recebimento v2" "cr40f_Nome" | Out-Null
New-Entity "cr40f_AnexoColisao_v2" "Anexo de Colisao v2" "Anexos de Colisao v2" "cr40f_Nome" | Out-Null

$colisaoColumns = @(
  @{ type="datetime"; schema="cr40f_DataHora"; logical="cr40f_datahora"; label="Data/hora" },
  @{ type="memo"; schema="cr40f_Descricao"; logical="cr40f_descricao"; label="Descricao"; maxLength=4000 },
  @{ type="boolean"; schema="cr40f_HouveTerceiro"; logical="cr40f_houveterceiro"; label="Houve terceiro" },
  @{ type="string"; schema="cr40f_Local"; logical="cr40f_local"; label="Local"; maxLength=1000 },
  @{ type="string"; schema="cr40f_Nome"; logical="cr40f_nome"; label="Nome"; maxLength=1000 },
  @{ type="picklist"; schema="cr40f_StatusAnexo"; logical="cr40f_statusanexo"; label="Status dos anexos"; options=@(@(100000000,"Sem anexo"),@(100000001,"Enviando"),@(100000002,"Completo"),@(100000003,"Falhou"),@(100000004,"Parcial")) },
  @{ type="picklist"; schema="cr40f_StatusOperacional"; logical="cr40f_statusoperacional"; label="Status operacional"; options=@(@(100000000,"Enviado"),@(100000001,"Em analise"),@(100000002,"Resolvido"),@(100000003,"Cancelado")) },
  @{ type="string"; schema="cr40f_TerceiroDocumento"; logical="cr40f_terceirodocumento"; label="Documento do terceiro"; maxLength=1000 },
  @{ type="string"; schema="cr40f_TerceiroNome"; logical="cr40f_terceironome"; label="Nome do terceiro"; maxLength=1000 },
  @{ type="memo"; schema="cr40f_TerceiroObservacao"; logical="cr40f_terceiroobservacao"; label="Observacao do terceiro"; maxLength=4000 },
  @{ type="string"; schema="cr40f_TerceiroPlaca"; logical="cr40f_terceiroplaca"; label="Placa do terceiro"; maxLength=1000 },
  @{ type="string"; schema="cr40f_TerceiroSeguradora"; logical="cr40f_terceiroseguradora"; label="Seguradora do terceiro"; maxLength=1000 },
  @{ type="phone"; schema="cr40f_TerceiroTelefone"; logical="cr40f_terceirotelefone"; label="Telefone do terceiro"; maxLength=1000 },
  @{ type="string"; schema="cr40f_TerceiroVeiculo"; logical="cr40f_terceiroveiculo"; label="Veiculo do terceiro"; maxLength=1000 },
  @{ type="picklist"; schema="cr40f_TipoOcorrencia"; logical="cr40f_tipoocorrencia"; label="Tipo da ocorrencia"; options=@(@(100000000,"Eu bati"),@(100000001,"Bateram em mim")) }
)

$anexoRecebimentoColumns = @(
  @{ type="datetime"; schema="cr40f_DataEnvio"; logical="cr40f_dataenvio"; label="Data de envio" },
  @{ type="string"; schema="cr40f_Nome"; logical="cr40f_nome"; label="Nome"; maxLength=1000 },
  @{ type="string"; schema="cr40f_NomeArquivo"; logical="cr40f_nomearquivo"; label="Nome do arquivo"; maxLength=1000 },
  @{ type="memo"; schema="cr40f_Observacao"; logical="cr40f_observacao"; label="Observacao"; maxLength=4000 },
  @{ type="integer"; schema="cr40f_Ordem"; logical="cr40f_ordem"; label="Ordem" },
  @{ type="url"; schema="cr40f_ShareLink"; logical="cr40f_sharelink"; label="Share link"; maxLength=1000 },
  @{ type="picklist"; schema="cr40f_Status"; logical="cr40f_status"; label="Status"; options=@(@(100000000,"Pendente"),@(100000001,"Enviado"),@(100000002,"Falhou"),@(100000003,"Invalido")) },
  @{ type="picklist"; schema="cr40f_Tipo"; logical="cr40f_tipo"; label="Tipo"; options=@(@(100000000,"Comprovante"),@(100000001,"Foto complementar"),@(100000002,"Outros")) },
  @{ type="picklist"; schema="cr40f_TipoMidia"; logical="cr40f_tipomidia"; label="Tipo da midia"; options=@(@(100000000,"Foto"),@(100000001,"Video")) },
  @{ type="url"; schema="cr40f_UrlSharePoint"; logical="cr40f_urlsharepoint"; label="URL SharePoint"; maxLength=1000 }
)

$anexoColisaoColumns = @(
  @{ type="datetime"; schema="cr40f_DataEnvio"; logical="cr40f_dataenvio"; label="Data de envio" },
  @{ type="string"; schema="cr40f_Nome"; logical="cr40f_nome"; label="Nome"; maxLength=1000 },
  @{ type="string"; schema="cr40f_NomeArquivo"; logical="cr40f_nomearquivo"; label="Nome do arquivo"; maxLength=1000 },
  @{ type="integer"; schema="cr40f_Ordem"; logical="cr40f_ordem"; label="Ordem" },
  @{ type="url"; schema="cr40f_ShareLink"; logical="cr40f_sharelink"; label="Share link"; maxLength=1000 },
  @{ type="picklist"; schema="cr40f_Status"; logical="cr40f_status"; label="Status"; options=@(@(100000000,"Pendente"),@(100000001,"Enviado"),@(100000002,"Falhou"),@(100000003,"Invalido")) },
  @{ type="picklist"; schema="cr40f_Tipo"; logical="cr40f_tipo"; label="Tipo"; options=@(@(100000000,"Cena"),@(100000001,"Dano Betinhos"),@(100000002,"Dano terceiro"),@(100000003,"Documento/placa"),@(100000004,"Extra")) },
  @{ type="picklist"; schema="cr40f_TipoMidia"; logical="cr40f_tipomidia"; label="Tipo da midia"; required=$true; options=@(@(100000000,"Foto"),@(100000001,"Video")) },
  @{ type="url"; schema="cr40f_UrlSharePoint"; logical="cr40f_urlsharepoint"; label="URL SharePoint"; maxLength=1000 }
)

foreach ($column in $colisaoColumns) { Add-Attribute "cr40f_colisao_v2" $column }
foreach ($column in $anexoRecebimentoColumns) { Add-Attribute "cr40f_anexorecebimento_v2" $column }
foreach ($column in $anexoColisaoColumns) { Add-Attribute "cr40f_anexocolisao_v2" $column }

$relationships = @(
  @{ schema="cr40f_cr40f_funcionarios_Motorista_cr40f_colisao_v2"; referenced="cr40f_funcionarios"; referencing="cr40f_colisao_v2"; lookupSchema="cr40f_Motorista"; lookupLabel="Motorista"; required=$true },
  @{ schema="cr40f_cr40f_veiculos_Veiculo_cr40f_colisao_v2"; referenced="cr40f_veiculos"; referencing="cr40f_colisao_v2"; lookupSchema="cr40f_Veiculo"; lookupLabel="Veiculo"; required=$true },
  @{ schema="cr40f_cr40f_reservadeveculos_Reserva_cr40f_anexorecebimento_v2"; referenced="cr40f_reservadeveculos"; referencing="cr40f_anexorecebimento_v2"; lookupSchema="cr40f_Reserva"; lookupLabel="Reserva"; required=$true },
  @{ schema="cr40f_cr40f_funcionarios_EnviadoPor_cr40f_anexorecebimento_v2"; referenced="cr40f_funcionarios"; referencing="cr40f_anexorecebimento_v2"; lookupSchema="cr40f_EnviadoPor"; lookupLabel="Enviado por"; required=$false },
  @{ schema="cr40f_cr40f_colisao_v2_Colisao_cr40f_anexocolisao_v2"; referenced="cr40f_colisao_v2"; referencing="cr40f_anexocolisao_v2"; lookupSchema="cr40f_Colisao"; lookupLabel="Colisao"; required=$true },
  @{ schema="cr40f_cr40f_funcionarios_EnviadoPor_cr40f_anexocolisao_v2"; referenced="cr40f_funcionarios"; referencing="cr40f_anexocolisao_v2"; lookupSchema="cr40f_EnviadoPor"; lookupLabel="Enviado por"; required=$false }
)

foreach ($relationship in $relationships) { Add-Relationship $relationship }

Start-Sleep -Seconds 8
Add-TableToSolution "cr40f_colisao_v2"
Add-TableToSolution "cr40f_anexorecebimento_v2"
Add-TableToSolution "cr40f_anexocolisao_v2"

Write-Step "publish all"
Invoke-Dataverse "POST" "/PublishAllXml" @{} | Out-Null

$map = [ordered]@{ tables = [ordered]@{}; columns = [ordered]@{} }
foreach ($logicalName in @("cr40f_anexorecebimento_v2","cr40f_anexocolisao_v2","cr40f_colisao_v2")) {
  $entity = Get-Entity $logicalName
  $oldName = $logicalName -replace "_v2$",""
  $map.tables[$oldName] = [ordered]@{
    newLogicalName = $logicalName
    newEntitySetName = $entity.EntitySetName
  }
}
$map | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "dataverse-name-map.json" -Encoding UTF8

Write-Step "wrote dataverse-name-map.json"
Write-Step "ok"
