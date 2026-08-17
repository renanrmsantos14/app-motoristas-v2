param(
  [Parameter(Mandatory = $true)] [string] $EnvironmentUrl,
  [string] $SolutionUniqueName = "AppBetinhos",
  [switch] $Apply,
  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) { Write-Host "[exchange-lifecycle] $Message" }
function Escape-OData([string] $Value) { $Value.Replace("'", "''") }

function Get-AccessToken([string] $BaseUrl, [switch] $UseDeviceCode) {
  if (-not (Get-Module -ListAvailable MSAL.PS)) { throw "Modulo MSAL.PS nao encontrado." }
  Import-Module MSAL.PS -ErrorAction Stop
  $client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
  Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
  $scope = "$BaseUrl/user_impersonation"
  if ($UseDeviceCode) { return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -DeviceCode).AccessToken }
  try { return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Silent).AccessToken }
  catch { return (Get-MsalToken -PublicClientApplication $client -Scopes $scope).AccessToken }
}

$script:baseUrl = $EnvironmentUrl.TrimEnd("/")
$script:token = Get-AccessToken $script:baseUrl -UseDeviceCode:$DeviceCode
if ([string]::IsNullOrWhiteSpace($script:token)) { throw "Token Dataverse nao obtido." }

function Invoke-Dataverse {
  param([string] $Method, [string] $Path, [object] $Body)
  $headers = @{
    Authorization = "Bearer $script:token"
    Accept = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version" = "4.0"
    Prefer = "return=representation"
    "MSCRM.SolutionUniqueName" = $SolutionUniqueName
  }
  if ($Method -eq "PATCH") { $headers["If-Match"] = "*" }
  if ($Method -eq "PUT") { $headers["MSCRM.MergeLabels"] = "true" }
  $params = @{ Method = $Method; Uri = "$script:baseUrl/api/data/v9.2/$Path"; Headers = $headers; ContentType = "application/json; charset=utf-8" }
  if ($null -ne $Body) { $params.Body = $Body | ConvertTo-Json -Depth 15 -Compress }
  try { return Invoke-RestMethod @params }
  catch {
    $detail = if ($null -ne $_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    throw "Dataverse $Method $Path falhou: $detail"
  }
}

function Get-Rows([string] $EntitySet, [string] $Select, [string] $Filter = "") {
  $path = "${EntitySet}?`$select=$Select"
  if ($Filter) { $path += "&`$filter=$([uri]::EscapeDataString($Filter))" }
  $response = Invoke-Dataverse "GET" $path
  if ($null -ne $response -and $response.PSObject.Properties.Name -contains "value") { return @($response.value) }
  if ($null -ne $response) { return @($response) }
  return @()
}

function Assert-RequiredTable([string] $LogicalName) {
  try {
    $path = "EntityDefinitions?`$select=MetadataId,LogicalName&`$filter=LogicalName eq '$LogicalName'"
    $rows = @((Invoke-Dataverse "GET" $path).value)
  }
  catch {
    throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV: $($_.Exception.Message)"
  }
  if ($rows.Count -ne 1) { throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV." }
}

function Get-SolutionId {
  $solutions = @(Get-Rows "solutions" "solutionid,ismanaged" "uniquename eq '$(Escape-OData $SolutionUniqueName)'")
  if ($solutions.Count -ne 1 -or [bool]$solutions[0].ismanaged) { throw "Solucao $SolutionUniqueName nao e unmanaged unica." }
  return [guid]$solutions[0].solutionid
}

function Ensure-SolutionComponentMembership([guid] $ComponentId, [int] $ComponentType, [string] $Label, [switch] $IncludeSubcomponents) {
  if (-not $Apply) { Write-Step "DRY RUN validaria componente $Label tipo $ComponentType na solucao"; return }
  $solutionId = Get-SolutionId
  $filter = "_solutionid_value eq $solutionId and objectid eq $ComponentId and componenttype eq $ComponentType"
  $rows = @(Get-Rows "solutioncomponents" "solutioncomponentid,componenttype,rootcomponentbehavior" $filter)
  if ($rows.Count -eq 0) {
    Add-SolutionComponent $ComponentId $ComponentType $Label -IncludeSubcomponents:$IncludeSubcomponents | Out-Null
    $rows = @(Get-Rows "solutioncomponents" "solutioncomponentid,componenttype,rootcomponentbehavior" $filter)
  }
  if ($rows.Count -ne 1) { throw "Componente $Label nao ficou unico na solucao $SolutionUniqueName." }
  if ($IncludeSubcomponents -and [int]$rows[0].rootcomponentbehavior -ne 0) { throw "Componente $Label nao inclui subcomponentes na solucao $SolutionUniqueName." }
}

function Add-SolutionComponent([guid] $ComponentId, [int] $ComponentType, [string] $Label, [switch] $IncludeSubcomponents) {
  if (-not $Apply) { Write-Step "DRY RUN incluiria componente $Label na solucao"; return }
  $solution = @(Get-Rows "solutions" "solutionid,ismanaged" "uniquename eq '$(Escape-OData $SolutionUniqueName)'")
  if ($solution.Count -ne 1 -or [bool]$solution[0].ismanaged) { throw "Solucao $SolutionUniqueName nao e unmanaged unica." }
  $existing = @(Get-Rows "solutioncomponents" "solutioncomponentid,rootcomponentbehavior" "_solutionid_value eq $($solution[0].solutionid) and objectid eq $ComponentId and componenttype eq $ComponentType")
  if ($existing.Count -eq 0) {
    $body = @{ ComponentId = $ComponentId; ComponentType = $ComponentType; SolutionUniqueName = $SolutionUniqueName; AddRequiredComponents = $false }
    if ($IncludeSubcomponents) { $body.DoNotIncludeSubcomponents = $false }
    Invoke-Dataverse "POST" "AddSolutionComponent" $body | Out-Null
    Write-Step "componente adicionado $Label"
  }
  if ($existing.Count -gt 1) { throw "Componente $Label ficou duplicado na solucao $SolutionUniqueName." }
  return @($existing)
}

function Ensure-Attribute([hashtable] $Spec) {
  $entity = $Spec.Entity
  $logical = $Spec.LogicalName
  $existing = @(Get-Rows "EntityDefinitions(LogicalName='$entity')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'")
  if ($existing.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria coluna $entity.$logical"; return }
    $payload = @{
      "@odata.type" = $Spec.Type
      SchemaName = $Spec.SchemaName
      DisplayName = @{ LocalizedLabels = @(@{ Label = $Spec.DisplayName; LanguageCode = 1046 }) }
      Description = @{ LocalizedLabels = @(@{ Label = $Spec.Description; LanguageCode = 1046 }) }
      RequiredLevel = @{ Value = "None" }
    }
    foreach ($key in $Spec.Keys) { if ($key -notin @("Entity", "LogicalName", "SchemaName", "DisplayName", "Description", "Type")) { $payload[$key] = $Spec[$key] } }
    Invoke-Dataverse "POST" "EntityDefinitions(LogicalName='$entity')/Attributes" $payload | Out-Null
    Write-Step "coluna criada $entity.$logical"
    $existing = @(Get-Rows "EntityDefinitions(LogicalName='$entity')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'")
  }
  if ($existing.Count -ne 1) { throw "Coluna $entity.$logical nao ficou unica." }
  Add-SolutionComponent ([guid]$existing[0].MetadataId) 2 "$entity.$logical"
}

function Ensure-Key([string] $Entity, [string] $SchemaName, [string] $DisplayName, [string[]] $Attributes) {
  $keys = @((Invoke-Dataverse "GET" "EntityDefinitions(LogicalName='$Entity')/Keys?`$select=MetadataId,SchemaName,KeyAttributes").value | Where-Object { $_.SchemaName -eq $SchemaName })
  if ($keys.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria chave $SchemaName"; return }
    $key = Invoke-Dataverse "POST" "EntityDefinitions(LogicalName='$Entity')/Keys" @{ SchemaName = $SchemaName; DisplayName = @{ LocalizedLabels = @(@{ Label = $DisplayName; LanguageCode = 1046 }) }; KeyAttributes = $Attributes }
    Write-Step "chave criada $SchemaName"
    $keys = @($key)
  }
  if ($keys.Count -ne 1) { throw "Chave $SchemaName nao ficou unica." }
  Add-SolutionComponent ([guid]$keys[0].MetadataId) 14 $SchemaName
}

function Ensure-CascadeRestrict([string] $SchemaName) {
  $rows = @(Get-Rows "RelationshipDefinitions" "MetadataId,SchemaName" "SchemaName eq '$SchemaName'")
  if ($rows.Count -ne 1) { throw "Relacionamento $SchemaName nao encontrado de forma unica." }
  if (-not $Apply) { Write-Step "DRY RUN ajustaria cascata $SchemaName para Restrict"; return }
  $metadataId = $rows[0].MetadataId
  $select = "SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,CascadeConfiguration,AssociatedMenuConfiguration,IsHierarchical,ReferencingEntityNavigationPropertyName,ReferencedEntityNavigationPropertyName"
  $current = Invoke-Dataverse "GET" "RelationshipDefinitions($metadataId)/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?`$select=$select"
  $cascade = @{}
  foreach ($property in $current.CascadeConfiguration.PSObject.Properties) {
    if ($property.Name -notlike "@odata.*") { $cascade[$property.Name] = $property.Value }
  }
  $cascade.Delete = "Restrict"
  $payload = @{
    "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
    SchemaName = $current.SchemaName
    ReferencedEntity = $current.ReferencedEntity
    ReferencedAttribute = $current.ReferencedAttribute
    ReferencingEntity = $current.ReferencingEntity
    ReferencingAttribute = $current.ReferencingAttribute
    CascadeConfiguration = $cascade
    AssociatedMenuConfiguration = $current.AssociatedMenuConfiguration
    IsHierarchical = $current.IsHierarchical
    ReferencingEntityNavigationPropertyName = $current.ReferencingEntityNavigationPropertyName
    ReferencedEntityNavigationPropertyName = $current.ReferencedEntityNavigationPropertyName
  }
  Invoke-Dataverse "PUT" "RelationshipDefinitions($metadataId)" $payload | Out-Null
  $verified = Invoke-Dataverse "GET" "RelationshipDefinitions($metadataId)/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?`$select=CascadeConfiguration"
  if ($verified.CascadeConfiguration.Delete -ne "Restrict") { throw "Relacionamento $SchemaName nao ficou com Delete=Restrict." }
  Write-Step "cascata Restrict aplicada $SchemaName"
}

function Ensure-CustomApi([hashtable] $Spec, [guid] $PluginTypeId) {
  $customApiComponentType = 10036
  $requestParameterComponentType = 10037
  $responsePropertyComponentType = 10038
  $apis = @(Get-Rows "customapis" "customapiid,uniquename,executeprivilegename" "uniquename eq '$($Spec.UniqueName)'")
  if ($apis.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria Custom API $($Spec.UniqueName)"; return }
    $apiPayload = @{
      uniquename = $Spec.UniqueName
      name = $Spec.UniqueName
      displayname = $Spec.DisplayName
      description = $Spec.Description
      bindingtype = $(if ($Spec.ContainsKey("Unbound") -and $Spec.Unbound) { 0 } else { 1 })
      isfunction = $false
      isprivate = $false
      allowedcustomprocessingsteptype = 0
      workflowsdkstepenabled = $false
      executeprivilegename = $Spec.ExecutePrivilegeName
    }
    if (-not ($Spec.ContainsKey("Unbound") -and $Spec.Unbound)) { $apiPayload.boundentitylogicalname = "cr40f_trocasdecarro" }
    $api = Invoke-Dataverse "POST" "customapis" $apiPayload
    $apis = @($api)
    Write-Step "Custom API criada $($Spec.UniqueName)"
  }
  if ($apis.Count -ne 1) { throw "Custom API $($Spec.UniqueName) nao ficou unica." }
  $apiId = [guid]$apis[0].customapiid
  if ($Apply) { Invoke-Dataverse "PATCH" "customapis($apiId)" @{ "PluginTypeId@odata.bind" = "/plugintypes($PluginTypeId)"; executeprivilegename = $Spec.ExecutePrivilegeName } | Out-Null }
  Ensure-SolutionComponentMembership $apiId $customApiComponentType "Custom API $($Spec.UniqueName)" -IncludeSubcomponents
  if ($Apply) {
    $verifiedApi = @(Get-Rows "customapis" "customapiid,executeprivilegename" "customapiid eq $apiId")
    if ($verifiedApi.Count -ne 1 -or $verifiedApi[0].executeprivilegename -ne $Spec.ExecutePrivilegeName) { throw "ExecutePrivilegeName invalido em $($Spec.UniqueName)." }
  }
  $parameters = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_Motivo'")
  if ($parameters.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria parametro $($Spec.UniqueName).new_Motivo"; return }
    Invoke-Dataverse "POST" "customapirequestparameters" @{ name = "$($Spec.UniqueName).new_Motivo"; uniquename = "new_Motivo"; displayname = "Motivo"; description = "Motivo obrigatorio da acao"; type = 10; isoptional = $false; "CustomAPIId@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  $effectiveParameters = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_DataEfetiva'")
  if ($Spec.ContainsKey("HasEffectiveAt") -and $Spec.HasEffectiveAt -and $effectiveParameters.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria parametro $($Spec.UniqueName).new_DataEfetiva"; return }
    Invoke-Dataverse "POST" "customapirequestparameters" @{ name = "$($Spec.UniqueName).new_DataEfetiva"; uniquename = "new_DataEfetiva"; displayname = "Data efetiva"; description = "Horario efetivo da troca; opcional para compatibilidade"; type = 1; isoptional = $true; "CustomAPIId@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  $versionParameters = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_VersaoEsperada'")
  if ($versionParameters.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria parametro $($Spec.UniqueName).new_VersaoEsperada"; return }
    $versionOptional = $Spec.ContainsKey("Register") -and $Spec.Register
    Invoke-Dataverse "POST" "customapirequestparameters" @{ name = "$($Spec.UniqueName).new_VersaoEsperada"; uniquename = "new_VersaoEsperada"; displayname = "Versao esperada"; description = "RowVersion lida pelo cliente"; type = 10; isoptional = $versionOptional; "CustomAPIId@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  if (($Spec.ContainsKey("Register") -and $Spec.Register) -or ($Spec.ContainsKey("Update") -and $Spec.Update)) {
    $registerParameters = @(
      @{ Name = "new_Inicio"; Type = 1; Optional = $false },
      @{ Name = "new_Fim"; Type = 1; Optional = $false },
      @{ Name = "new_Observacao"; Type = 10; Optional = $true }
    )
    if ($Spec.ContainsKey("Register") -and $Spec.Register) {
      $registerParameters += @(
        @{ Name = "new_Tipo"; Type = 9; Optional = $false },
        @{ Name = "new_Motorista1"; Type = 5; Optional = $false; Entity = "cr40f_funcionarios" },
        @{ Name = "new_Motorista2"; Type = 5; Optional = $true; Entity = "cr40f_funcionarios" },
        @{ Name = "new_Veiculo1"; Type = 5; Optional = $true; Entity = "cr40f_veiculos" },
        @{ Name = "new_Veiculo2"; Type = 5; Optional = $true; Entity = "cr40f_veiculos" },
        @{ Name = "new_ConcluirImediatamente"; Type = 0; Optional = $false },
        @{ Name = "new_ProgramarAutomaticamente"; Type = 0; Optional = $false },
        @{ Name = "new_IdempotencyKey"; Type = 10; Optional = $false }
      )
    }
    foreach ($parameterSpec in $registerParameters) {
      $found = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename" "_customapiid_value eq $apiId and uniquename eq '$($parameterSpec.Name)'")
      if ($found.Count -eq 0 -and $Apply) {
        $payload = @{ name = "$($Spec.UniqueName).$($parameterSpec.Name)"; uniquename = $parameterSpec.Name; displayname = $parameterSpec.Name; description = "Parametro transacional de registro"; type = $parameterSpec.Type; isoptional = $parameterSpec.Optional; "CustomAPIId@odata.bind" = "/customapis($apiId)" }
        if ($parameterSpec.ContainsKey("Entity")) { $payload.logicalentityname = $parameterSpec.Entity }
        Invoke-Dataverse "POST" "customapirequestparameters" $payload | Out-Null
      }
    }
    $registerResponses = @(Get-Rows "customapiresponseproperties" "customapiresponsepropertyid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_TrocaId'")
    if ($Spec.ContainsKey("Register") -and $Spec.Register -and $registerResponses.Count -eq 0 -and $Apply) {
      Invoke-Dataverse "POST" "customapiresponseproperties" @{ name = "$($Spec.UniqueName).new_TrocaId"; uniquename = "new_TrocaId"; displayname = "Troca criada"; description = "ID transacional da troca"; type = 12; "CustomAPIId@odata.bind" = "/customapis($apiId)" } | Out-Null
    }
  }
  $responses = @(Get-Rows "customapiresponseproperties" "customapiresponsepropertyid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_TrocaCompensatoriaId'")
  if ($Spec.HasResponse -and $responses.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria retorno $($Spec.UniqueName).new_TrocaCompensatoriaId"; return }
    Invoke-Dataverse "POST" "customapiresponseproperties" @{ name = "$($Spec.UniqueName).new_TrocaCompensatoriaId"; uniquename = "new_TrocaCompensatoriaId"; displayname = "Troca compensatoria"; description = "Identificador da compensacao criada"; type = 12; "CustomAPIId@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  $parameters = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename,type,isoptional" "_customapiid_value eq $apiId")
  if ($Spec.ContainsKey("Update") -and $Spec.Update) {
    $allowedUpdateParameters = @("new_Motivo", "new_VersaoEsperada", "new_Inicio", "new_Fim", "new_Observacao")
    $obsoleteParameters = @($parameters | Where-Object { $_.uniquename -notin $allowedUpdateParameters })
    foreach ($obsolete in $obsoleteParameters) {
      if (-not $Apply) { Write-Step "DRY RUN removeria parametro obsoleto $($Spec.UniqueName).$($obsolete.uniquename)"; continue }
      Invoke-Dataverse "DELETE" "customapirequestparameters($($obsolete.customapirequestparameterid))" | Out-Null
      Write-Step "parametro obsoleto removido $($Spec.UniqueName).$($obsolete.uniquename)"
    }
    if ($obsoleteParameters.Count -gt 0 -and $Apply) {
      $parameters = @(Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename,type,isoptional" "_customapiid_value eq $apiId")
    }
  }
  $motivo = @($parameters | Where-Object { $_.uniquename -eq "new_Motivo" })
  if ($motivo.Count -ne 1 -or [int]$motivo[0].type -ne 10 -or [bool]$motivo[0].isoptional) { throw "Parametro new_Motivo invalido na Custom API $($Spec.UniqueName)." }
  if ($Spec.ContainsKey("HasEffectiveAt") -and $Spec.HasEffectiveAt) {
    $effective = @($parameters | Where-Object { $_.uniquename -eq "new_DataEfetiva" })
    if ($effective.Count -ne 1 -or [int]$effective[0].type -ne 1 -or -not [bool]$effective[0].isoptional) { throw "Parametro new_DataEfetiva invalido na Custom API $($Spec.UniqueName)." }
  }
  $responses = @(Get-Rows "customapiresponseproperties" "customapiresponsepropertyid,uniquename,type" "_customapiid_value eq $apiId")
  if ($Spec.HasResponse) {
    $response = @($responses | Where-Object { $_.uniquename -eq "new_TrocaCompensatoriaId" })
    if ($response.Count -ne 1 -or [int]$response[0].type -ne 12) { throw "Retorno new_TrocaCompensatoriaId invalido na Custom API $($Spec.UniqueName)." }
  }
  if ($Apply) {
    foreach ($parameter in $parameters) { Ensure-SolutionComponentMembership ([guid]$parameter.customapirequestparameterid) $requestParameterComponentType "parametro $($Spec.UniqueName).$($parameter.uniquename)" }
    foreach ($response in $responses) { Ensure-SolutionComponentMembership ([guid]$response.customapiresponsepropertyid) $responsePropertyComponentType "retorno $($Spec.UniqueName).$($response.uniquename)" }
  }
  Write-Step "Custom API $($Spec.UniqueName) provisionada, associada ao PluginType e validada na solucao com componentType=$customApiComponentType."
}

Assert-RequiredTable "cr40f_trocasdecarro"
Assert-RequiredTable "new_possedeveiculo"
Assert-RequiredTable "cr40f_reservadeveculos"

$attributes = @(
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodecancelamento"; SchemaName = "new_MotivoDeCancelamento"; DisplayName = "Motivo de cancelamento"; Description = "Motivo informado no cancelamento"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodeconclusaomanual"; SchemaName = "new_MotivoDeConclusaoManual"; DisplayName = "Motivo de conclusao manual"; Description = "Motivo informado na conclusao manual"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodereversao"; SchemaName = "new_MotivoDeReversao"; DisplayName = "Motivo de reversao"; Description = "Motivo informado na reversao"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_revertida"; SchemaName = "new_Revertida"; DisplayName = "Revertida"; Description = "Indica que existe evento compensatorio"; Type = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"; DefaultValue = $false; OptionSet = @{ TrueOption = @{ Value = 1; Label = @{ LocalizedLabels = @(@{ Label = "Sim"; LanguageCode = 1046 }) } }; FalseOption = @{ Value = 0; Label = @{ LocalizedLabels = @(@{ Label = "Nao"; LanguageCode = 1046 }) } } } }
  ,@{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_idempotencykey"; SchemaName = "new_IdempotencyKey"; DisplayName = "Chave de idempotencia"; Description = "Identifica unicamente o comando de registro"; Type = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; MaxLength = 100; FormatName = @{ Value = "Text" } }
  ,@{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_requesthash"; SchemaName = "new_RequestHash"; DisplayName = "Hash do comando"; Description = "Hash do conteudo protegido pela chave"; Type = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; MaxLength = 64; FormatName = @{ Value = "Text" } }
)

foreach ($attribute in $attributes) { Ensure-Attribute $attribute }

Ensure-Key "new_possedeveiculo" "new_ChaveMotoristaPosseAberta_Key" "Posse aberta unica por motorista" @("new_chavemotoristaposseaberta")
Ensure-Key "new_possedeveiculo" "new_ChaveVeiculoPosseAberta_Key" "Posse aberta unica por veiculo" @("new_chaveveiculoposseaberta")
Ensure-Key "cr40f_reservadeveculos" "cr40f_OT_GeralUnica_Key" "Uma Geral por troca" @("cr40f_ot")
Ensure-Key "cr40f_trocasdecarro" "new_IdempotencyKey_Key" "Comando de troca idempotente" @("new_idempotencykey")

$pluginTypes = @(Get-Rows "plugintypes" "plugintypeid,typename" "typename eq 'Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin'")
if ($pluginTypes.Count -ne 1) { throw "PluginType ExchangeLifecycleCommandPlugin precisa ser registrado antes das Custom APIs." }
$apis = @(
  @{ UniqueName = "new_ConcluirTrocaDeCarro"; DisplayName = "Concluir troca de carro"; Description = "Conclui troca com validacao transacional"; HasResponse = $false; HasEffectiveAt = $true; ExecutePrivilegeName = "prvWritecr40f_TrocasdeCarro" },
  @{ UniqueName = "new_CancelarTrocaDeCarro"; DisplayName = "Cancelar troca de carro"; Description = "Cancela troca com motivo"; HasResponse = $false; ExecutePrivilegeName = "prvWritecr40f_TrocasdeCarro" },
  @{ UniqueName = "new_ReverterTrocaDeCarro"; DisplayName = "Reverter troca de carro"; Description = "Cria evento compensatorio da troca"; HasResponse = $true; HasEffectiveAt = $true; ExecutePrivilegeName = "prvWritecr40f_TrocasdeCarro" },
  @{ UniqueName = "new_ConfirmarTrocaMotorista"; DisplayName = "Confirmar troca pelo motorista"; Description = "Confirma somente o participante autenticado"; HasResponse = $false; ExecutePrivilegeName = "prvReadcr40f_TrocasdeCarro" }
  ,@{ UniqueName = "new_AtualizarTrocaDeCarro"; DisplayName = "Atualizar troca de carro"; Description = "Edita troca aberta com concorrencia e conflitos"; HasResponse = $false; ExecutePrivilegeName = "prvWritecr40f_TrocasdeCarro"; Update = $true }
  ,@{ UniqueName = "new_RegistrarTrocaDeCarro"; DisplayName = "Registrar troca de carro"; Description = "Cria e opcionalmente conclui a troca na mesma transacao"; HasResponse = $false; HasEffectiveAt = $true; ExecutePrivilegeName = "prvWritecr40f_TrocasdeCarro"; Unbound = $true; Register = $true }
)
foreach ($api in $apis) { Ensure-CustomApi $api ([guid]$pluginTypes[0].plugintypeid) }

foreach ($relationship in @(
  "cr40f_cr40f_trocasdecarro_new_TrocaOriginalRevertida_cr40f_trocasdecarro",
  "cr40f_reservadeveculos_OT_cr40f_trocasdecarro",
  "new_cr40f_trocasdecarro_TrocanaBaseVinculo_cr40f_trocasdecarro",
  "new_PossedeVeiculo_TrocadeCarroRelacionada_cr40f_TrocasdeCarro"
)) { Ensure-CascadeRestrict $relationship }

Write-Step $(if ($Apply) { "PROVISIONAMENTO DEV OK" } else { "DRY RUN OK; use -Apply para publicar metadata no DEV" })
