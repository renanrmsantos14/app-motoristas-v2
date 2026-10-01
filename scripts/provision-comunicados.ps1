param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $SolutionUniqueName = "AppBetinhos",
  [switch] $Apply,
  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Label([string] $Text) { return @{ LocalizedLabels = @(@{ Label = $Text; LanguageCode = 1046 }) } }
function RequiredLevel([bool] $Required) { return @{ Value = $(if ($Required) { "ApplicationRequired" } else { "None" }) } }
function Option([int] $Value, [string] $Text) { return @{ Value = $Value; Label = (Label $Text) } }
function Write-Step([string] $Message) { Write-Host "[comunicados] $Message" }

if (-not (Get-Module -ListAvailable MSAL.PS)) { throw "Modulo MSAL.PS nao encontrado." }
Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$scope = "$baseUrl/user_impersonation"
if ($DeviceCode) { $token = (Get-MsalToken -PublicClientApplication $client -Scopes $scope -DeviceCode).AccessToken }
else {
  try { $token = (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Silent).AccessToken }
  catch { $token = (Get-MsalToken -PublicClientApplication $client -Scopes $scope).AccessToken }
}
if (-not $token) { throw "Token Dataverse nao obtido." }
$apiBase = "$baseUrl/api/data/v9.2"
$missingTables = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

function Invoke-Dv([string] $Method, [string] $Path, $Body = $null) {
  $headers = @{
    Authorization = "Bearer $token"
    Accept = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version" = "4.0"
    "MSCRM.SolutionUniqueName" = $SolutionUniqueName
    Prefer = "return=representation"
  }
  $args = @{ Method = $Method; Uri = "$apiBase/$Path"; Headers = $headers }
  if ($null -ne $Body) {
    $args.ContentType = "application/json; charset=utf-8"
    $args.Body = $Body | ConvertTo-Json -Depth 50 -Compress
  }
  try { return Invoke-RestMethod @args }
  catch {
    $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    throw "Dataverse $Method $Path falhou: $detail"
  }
}

function Get-Rows([string] $Set, [string] $Select, [string] $Filter = "") {
  $path = "${Set}?`$select=$Select"
  if ($Filter) { $path += "&`$filter=$([uri]::EscapeDataString($Filter))" }
  $result = Invoke-Dv "GET" $path
  return @($result.value)
}

function Add-SolutionComponent([guid] $Id, [int] $Type, [string] $Name) {
  if (-not $Apply) { return }
  $solution = @(Get-Rows "solutions" "solutionid,ismanaged" "uniquename eq '$SolutionUniqueName'")
  if ($solution.Count -ne 1 -or [bool]$solution[0].ismanaged) { throw "Solucao $SolutionUniqueName nao encontrada como unmanaged unica." }
  $existing = @(Get-Rows "solutioncomponents" "solutioncomponentid" "_solutionid_value eq $($solution[0].solutionid) and objectid eq $Id and componenttype eq $Type")
  if ($existing.Count -eq 0) {
    Invoke-Dv "POST" "AddSolutionComponent" @{ ComponentId = $Id; ComponentType = $Type; SolutionUniqueName = $SolutionUniqueName; AddRequiredComponents = $false; DoNotIncludeSubcomponents = $false } | Out-Null
    Write-Step "adicionado a solucao: $Name"
  }
}

function Ensure-Table([string] $SchemaName, [string] $LabelSingular, [string] $LabelPlural, [string] $Ownership) {
  $logical = $SchemaName.ToLowerInvariant()
  $found = @(Get-Rows "EntityDefinitions" "MetadataId,LogicalName,EntitySetName,OwnershipType" "LogicalName eq '$logical'")
  if ($found.Count -eq 0) {
    if (-not $Apply) { [void]$missingTables.Add($logical); Write-Step "DRY RUN criaria tabela $logical"; return }
    Invoke-Dv "POST" "EntityDefinitions" @{
      "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
      SchemaName = $SchemaName
      DisplayName = (Label $LabelSingular)
      DisplayCollectionName = (Label $LabelPlural)
      Description = (Label "Comunicados operacionais do App Motoristas")
      OwnershipType = $Ownership
      IsActivity = $false
      HasActivities = $false
      HasNotes = $false
      Attributes = @(@{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName = "new_Name"
        AttributeType = "String"
        AttributeTypeName = @{ Value = "StringType" }
        RequiredLevel = (RequiredLevel $true)
        MaxLength = 150
        FormatName = @{ Value = "Text" }
        DisplayName = (Label "Nome")
        IsPrimaryName = $true
      })
    } | Out-Null
    $found = @(Get-Rows "EntityDefinitions" "MetadataId,LogicalName,EntitySetName,OwnershipType" "LogicalName eq '$logical'")
  }
  if ($found.Count -ne 1 -or [string]$found[0].OwnershipType -ne $Ownership) { throw "Metadata da tabela $logical inesperada." }
  Add-SolutionComponent ([guid]$found[0].MetadataId) 1 $logical
  Write-Step "tabela pronta: $logical / $($found[0].EntitySetName)"
}

function Ensure-Column([string] $Table, [string] $SchemaName, [string] $DisplayName, [string] $Type, [int] $MaxLength = 0, $Options = @()) {
  $logical = $SchemaName.ToLowerInvariant()
  if ($missingTables.Contains($Table)) { Write-Step "DRY RUN criaria coluna $Table.$logical"; return }
  $found = @(Get-Rows "EntityDefinitions(LogicalName='$Table')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'")
  if ($found.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria coluna $Table.$logical"; return }
    $body = @{ SchemaName = $SchemaName; DisplayName = (Label $DisplayName); RequiredLevel = (RequiredLevel $false) }
    switch ($Type) {
      "string" { $body["@odata.type"] = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; $body.MaxLength = $MaxLength; $body.FormatName = @{ Value = "Text" } }
      "memo" { $body["@odata.type"] = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; $body.MaxLength = $MaxLength; $body.FormatName = @{ Value = "TextArea" } }
      "datetime" { $body["@odata.type"] = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; $body.Format = "DateAndTime"; $body.DateTimeBehavior = @{ Value = "UserLocal" } }
      "choice" { $body["@odata.type"] = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"; $body.OptionSet = @{ IsGlobal = $false; OptionSetType = "Picklist"; Options = @($Options) } }
      default { throw "Tipo desconhecido: $Type" }
    }
    Invoke-Dv "POST" "EntityDefinitions(LogicalName='$Table')/Attributes" $body | Out-Null
    $found = @(Get-Rows "EntityDefinitions(LogicalName='$Table')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'")
  }
  if ($found.Count -ne 1) { throw "Coluna $Table.$logical nao ficou unica." }
  Add-SolutionComponent ([guid]$found[0].MetadataId) 2 "$Table.$logical"
}

function Ensure-Relationship([string] $SchemaName, [string] $Referenced, [string] $Referencing, [string] $LookupSchema, [string] $LookupLabel) {
  if ($missingTables.Contains($Referenced) -or $missingTables.Contains($Referencing)) { Write-Step "DRY RUN criaria relacionamento $SchemaName"; return }
  $found = @(Get-Rows "RelationshipDefinitions" "MetadataId,SchemaName" "SchemaName eq '$SchemaName'")
  if ($found.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria relacionamento $SchemaName"; return }
    Invoke-Dv "POST" "RelationshipDefinitions" @{
      "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
      SchemaName = $SchemaName
      ReferencedEntity = $Referenced
      ReferencingEntity = $Referencing
      Lookup = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
        SchemaName = $LookupSchema
        DisplayName = (Label $LookupLabel)
        RequiredLevel = (RequiredLevel $true)
      }
      CascadeConfiguration = @{ Assign = "NoCascade"; Delete = "Restrict"; Merge = "NoCascade"; Reparent = "NoCascade"; Share = "NoCascade"; Unshare = "NoCascade" }
    } | Out-Null
    $found = @(Get-Rows "RelationshipDefinitions" "MetadataId,SchemaName" "SchemaName eq '$SchemaName'")
  }
  if ($found.Count -ne 1) { throw "Relacionamento $SchemaName nao ficou unico." }
  Add-SolutionComponent ([guid]$found[0].MetadataId) 10 $SchemaName
}

function Ensure-Key([string] $Table, [string] $SchemaName, [string] $Attribute) {
  if ($missingTables.Contains($Table)) { Write-Step "DRY RUN criaria chave $SchemaName"; return }
  $found = @((Invoke-Dv "GET" "EntityDefinitions(LogicalName='$Table')/Keys?`$select=MetadataId,SchemaName,KeyAttributes").value | Where-Object { $_.SchemaName -eq $SchemaName })
  if ($found.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria chave $SchemaName"; return }
    Invoke-Dv "POST" "EntityDefinitions(LogicalName='$Table')/Keys" @{
      "@odata.type" = "Microsoft.Dynamics.CRM.EntityKeyMetadata"
      SchemaName = $SchemaName
      DisplayName = (Label "Comunicado e motorista")
      KeyAttributes = @($Attribute)
    } | Out-Null
    $found = @((Invoke-Dv "GET" "EntityDefinitions(LogicalName='$Table')/Keys?`$select=MetadataId,SchemaName,KeyAttributes").value | Where-Object { $_.SchemaName -eq $SchemaName })
  }
  if ($found.Count -ne 1) { throw "Chave $SchemaName nao ficou unica." }
  Add-SolutionComponent ([guid]$found[0].MetadataId) 14 $SchemaName
}

function Ensure-Api([string] $Name, [guid] $PluginTypeId, [string] $Privilege, $Parameters) {
  $found = @(Get-Rows "customapis" "customapiid,uniquename" "uniquename eq '$Name'")
  if ($found.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria Custom API $Name"; return }
    Invoke-Dv "POST" "customapis" @{
      uniquename = $Name
      name = $Name
      displayname = $Name
      description = "Acao transacional de comunicados do motorista"
      bindingtype = 0
      isfunction = $false
      isprivate = $false
      allowedcustomprocessingsteptype = 0
      workflowsdkstepenabled = $false
      executeprivilegename = $Privilege
      "PluginTypeId@odata.bind" = "/plugintypes($PluginTypeId)"
    } | Out-Null
    $found = @(Get-Rows "customapis" "customapiid,uniquename" "uniquename eq '$Name'")
  }
  if ($found.Count -ne 1) { throw "Custom API $Name nao ficou unica." }
  $apiId = [guid]$found[0].customapiid
  Add-SolutionComponent $apiId 10036 $Name
  foreach ($parameter in $Parameters) {
    $existing = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename,type" "_customapiid_value eq $apiId and uniquename eq '$($parameter.Name)'")
    if ($existing.Count -eq 0) {
      if (-not $Apply) { Write-Step "DRY RUN criaria parametro $Name.$($parameter.Name)"; continue }
      Invoke-Dv "POST" "customapirequestparameters" @{
        name = "$Name.$($parameter.Name)"
        uniquename = $parameter.Name
        displayname = $parameter.Name
        description = "Parametro de comunicado"
        type = $parameter.Type
        isoptional = $parameter.Optional
        "CustomAPIId@odata.bind" = "/customapis($apiId)"
      } | Out-Null
      $existing = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename,type" "_customapiid_value eq $apiId and uniquename eq '$($parameter.Name)'")
    }
    if ($existing.Count -ne 1 -or [int]$existing[0].type -ne $parameter.Type) { throw "Parametro $Name.$($parameter.Name) invalido." }
    Add-SolutionComponent ([guid]$existing[0].customapirequestparameterid) 10037 "$Name.$($parameter.Name)"
  }
}

function Ensure-HeaderGuard([guid] $PluginTypeId, [string] $Message, [string] $StepName, [string] $Description, [string] $Attributes) {
  $messages = @(Get-Rows "sdkmessages" "sdkmessageid,name" "name eq '$Message'")
  if ($messages.Count -ne 1) { throw "Mensagem $Message ausente ou duplicada." }
  $messageId = [guid]$messages[0].sdkmessageid
  $metadata = @(Get-Rows "EntityDefinitions" "ObjectTypeCode" "LogicalName eq 'new_comunicadomotorista'")
  if ($metadata.Count -ne 1) { throw "ObjectTypeCode do comunicado nao encontrado." }
  $filters = @(Get-Rows "sdkmessagefilters" "sdkmessagefilterid,primaryobjecttypecode" "_sdkmessageid_value eq $messageId" | Where-Object { [string]$_.primaryobjecttypecode -eq "new_comunicadomotorista" -or [string]$_.primaryobjecttypecode -eq [string]$metadata[0].ObjectTypeCode })
  if ($filters.Count -ne 1) { throw "Filtro $Message do comunicado ausente ou duplicado." }
  $filterId = [guid]$filters[0].sdkmessagefilterid
  $steps = @(Get-Rows "sdkmessageprocessingsteps" "sdkmessageprocessingstepid,name,stage,mode,filteringattributes" "_eventhandler_value eq $PluginTypeId and _sdkmessageid_value eq $messageId and _sdkmessagefilterid_value eq $filterId and stage eq 10")
  if ($steps.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria step: $StepName"; return }
    $step = @{
      name = $StepName
      description = $Description
      "eventhandler_plugintype@odata.bind" = "/plugintypes($PluginTypeId)"
      "sdkmessageid@odata.bind" = "/sdkmessages($messageId)"
      "sdkmessagefilterid@odata.bind" = "/sdkmessagefilters($filterId)"
      stage = 10
      mode = 0
      rank = 1
      supporteddeployment = 0
      asyncautodelete = $false
    }
    if ($Attributes) { $step.filteringattributes = $Attributes }
    Invoke-Dv "POST" "sdkmessageprocessingsteps" $step | Out-Null
    $steps = @(Get-Rows "sdkmessageprocessingsteps" "sdkmessageprocessingstepid,name,stage,mode,filteringattributes" "_eventhandler_value eq $PluginTypeId and _sdkmessageid_value eq $messageId and _sdkmessagefilterid_value eq $filterId and stage eq 10")
  }
  if ($steps.Count -ne 1 -or [int]$steps[0].mode -ne 0 -or [string]$steps[0].filteringattributes -ne $Attributes) { throw "Step '$StepName' nao ficou unico ou tem contrato divergente." }
  Add-SolutionComponent ([guid]$steps[0].sdkmessageprocessingstepid) 92 $StepName
}

function Ensure-ChoiceLabel([string] $Table, [string] $Attribute, [int] $Value, [string] $Text) {
  if ($missingTables.Contains($Table)) { return }
  $metadata = Invoke-Dv "GET" "EntityDefinitions(LogicalName='$Table')/Attributes(LogicalName='$Attribute')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet(`$select=Options)"
  $option = @($metadata.OptionSet.Options | Where-Object { [int]$_.Value -eq $Value })
  if ($option.Count -ne 1) { throw "Opcao $Value ausente em $Table.$Attribute." }
  $current = @($option[0].Label.LocalizedLabels | Where-Object { [int]$_.LanguageCode -eq 1046 } | ForEach-Object { [string]$_.Label })
  if ($current -contains $Text) { return }
  if (-not $Apply) { Write-Step "DRY RUN atualizaria rotulo $Table.$Attribute=$Value para '$Text'"; return }
  Invoke-Dv "POST" "UpdateOptionValue" @{ EntityLogicalName = $Table; AttributeLogicalName = $Attribute; Value = $Value; Label = (Label $Text); MergeLabels = $true } | Out-Null
  Write-Step "rotulo atualizado: $Table.$Attribute=$Value"
}

Write-Step "alvo: $baseUrl, solucao: $SolutionUniqueName, apply: $Apply"
Ensure-Table "new_ComunicadoMotorista" "Comunicado do motorista" "Comunicados dos motoristas" "OrganizationOwned"
Ensure-Table "new_ComunicadoDestinatario" "Destinatario de comunicado" "Destinatarios de comunicados" "UserOwned"

$assinaturaLabel = "Assinatura obrigat$([char]0x00F3)ria"
$header = "new_comunicadomotorista"
Ensure-Column $header "new_Titulo" "Titulo" "string" 150
Ensure-Column $header "new_Corpo" "Mensagem" "memo" 4000
Ensure-Column $header "new_Tipo" "Tipo" "choice" 0 @((Option 100000000 "Informativo"), (Option 100000001 $assinaturaLabel))
Ensure-Column $header "new_Escopo" "Destinatarios" "choice" 0 @((Option 100000000 "Todos"), (Option 100000001 "Selecionados"))
Ensure-Column $header "new_AlvosJson" "Motoristas selecionados" "memo" 40000
Ensure-Column $header "new_Estado" "Estado" "choice" 0 @((Option 100000000 "Rascunho"), (Option 100000001 "Disparado"))
Ensure-Column $header "new_DisparadoEm" "Disparado em" "datetime"
Ensure-Column $header "new_DisparadoPor" "Disparado por" "string" 36

$recipient = "new_comunicadodestinatario"
Ensure-Column $recipient "new_ChaveUnica" "Chave unica" "string" 100
Ensure-Column $recipient "new_Titulo" "Titulo" "string" 150
Ensure-Column $recipient "new_Corpo" "Mensagem" "memo" 4000
Ensure-Column $recipient "new_Tipo" "Tipo" "choice" 0 @((Option 100000000 "Informativo"), (Option 100000001 $assinaturaLabel))
Ensure-Column $recipient "new_EnviadoEm" "Enviado em" "datetime"
Ensure-Column $recipient "new_AbertoEm" "Visualizado em" "datetime"
Ensure-Column $recipient "new_LidoEm" "Lido em" "datetime"
Ensure-Column $recipient "new_CienteEm" "Ciente em" "datetime"
Ensure-Column $recipient "new_NomeAssinante" "Nome do motorista" "string" 150
Ensure-Column $recipient "new_Observacao" "Observacao" "memo" 1000
Ensure-Column $recipient "new_AssinaturaJson" "Assinatura desenhada" "memo" 100000
Ensure-Column $recipient "new_PushStatus" "Estado do push" "choice" 0 @((Option 100000000 "Pendente"), (Option 100000001 "Enviado"), (Option 100000002 "Falhou"))
Ensure-Column $recipient "new_PushErro" "Erro do push" "string" 500
Ensure-Relationship "new_new_comunicadomotorista_Comunicado_new_comunicadodestinatario" $header $recipient "new_Comunicado" "Comunicado"
Ensure-Relationship "new_cr40f_funcionarios_Motorista_new_comunicadodestinatario" "cr40f_funcionarios" $recipient "new_Motorista" "Motorista"
Ensure-Key $recipient "new_ComunicadoDestinatarioChaveUnica" "new_chaveunica"
Ensure-ChoiceLabel $header "new_tipo" 100000001 $assinaturaLabel
Ensure-ChoiceLabel $recipient "new_tipo" 100000001 $assinaturaLabel

$pluginTypes = @(Get-Rows "plugintypes" "plugintypeid,typename" "typename eq 'Betinhos.DriverRecordSharing.ComunicadoCommandPlugin'")
if ($pluginTypes.Count -eq 0 -and $Apply) {
  $assemblies = @(Get-Rows "pluginassemblies" "pluginassemblyid,name" "name eq 'Betinhos.DriverRecordSharing'")
  if ($assemblies.Count -ne 1) { throw "Assembly DriverRecordSharing precisa ser publicado antes das Custom APIs." }
  Invoke-Dv "POST" "plugintypes" @{ name = "ComunicadoCommandPlugin"; friendlyname = "ComunicadoCommandPlugin"; typename = "Betinhos.DriverRecordSharing.ComunicadoCommandPlugin"; "pluginassemblyid@odata.bind" = "/pluginassemblies($($assemblies[0].pluginassemblyid))" } | Out-Null
  $pluginTypes = @(Get-Rows "plugintypes" "plugintypeid,typename" "typename eq 'Betinhos.DriverRecordSharing.ComunicadoCommandPlugin'")
}
if ($pluginTypes.Count -ne 1 -and $Apply) { throw "PluginType ComunicadoCommandPlugin nao encontrado de forma unica." }
if ($pluginTypes.Count -eq 1) {
  $typeId = [guid]$pluginTypes[0].plugintypeid
  $idParameter = @(@{ Name = "new_DestinatarioId"; Type = 12; Optional = $false })
  Ensure-Api "new_DispararComunicadoMotorista" $typeId "prvWritenew_ComunicadoMotorista" @(@{ Name = "new_ComunicadoId"; Type = 12; Optional = $false })
  Ensure-Api "new_AbrirComunicadoMotorista" $typeId "prvReadnew_ComunicadoDestinatario" $idParameter
  Ensure-Api "new_RegistrarCienciaComunicado" $typeId "prvReadnew_ComunicadoDestinatario" @($idParameter + @(@{ Name = "new_AssinaturaJson"; Type = 10; Optional = $false }, @{ Name = "new_Observacao"; Type = 10; Optional = $true }))
  Ensure-Api "new_ReenviarPushComunicado" $typeId "prvWritenew_ComunicadoMotorista" $idParameter
  Ensure-HeaderGuard $typeId "Update" "Comunicados - bloquear edicao apos disparo" "Impede alterar conteudo, publico ou estado de comunicado ja disparado" "new_name,new_titulo,new_corpo,new_tipo,new_escopo,new_alvosjson,new_estado"
  Ensure-HeaderGuard $typeId "Delete" "Comunicados - bloquear exclusao apos disparo" "Permite excluir somente rascunhos de comunicado" ""
}

if ($Apply) {
  Invoke-Dv "POST" "PublishXml" @{ ParameterXml = "<importexportxml><entities><entity>new_comunicadomotorista</entity><entity>new_comunicadodestinatario</entity></entities></importexportxml>" } | Out-Null
  Write-Step "schema e APIs publicados. Valide roles e Flow antes de liberar acesso."
} else { Write-Step "DRY RUN concluido." }
