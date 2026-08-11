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
  $params = @{ Method = $Method; Uri = "$script:baseUrl/api/data/v9.2/$Path"; Headers = $headers; ContentType = "application/json; charset=utf-8" }
  if ($null -ne $Body) { $params.Body = $Body | ConvertTo-Json -Depth 15 -Compress }
  try { return Invoke-RestMethod @params }
  catch { throw "Dataverse $Method $Path falhou: $($_.ErrorDetails.Message)" }
}

function Get-Rows([string] $EntitySet, [string] $Select, [string] $Filter = "") {
  $path = "${EntitySet}?`$select=$Select"
  if ($Filter) { $path += "&`$filter=$([uri]::EscapeDataString($Filter))" }
  return @((Invoke-Dataverse "GET" $path).value)
}

function Assert-RequiredTable([string] $LogicalName) {
  try {
    $rows = Get-Rows "EntityDefinitions(LogicalName='$LogicalName')" "MetadataId,LogicalName"
  }
  catch {
    throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV: $($_.Exception.Message)"
  }
  if ($rows.Count -ne 1) { throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV." }
}

function Add-SolutionComponent([guid] $ComponentId, [int] $ComponentType, [string] $Label) {
  if (-not $Apply) { Write-Step "DRY RUN incluiria componente $Label na solucao"; return }
  $solution = Get-Rows "solutions" "solutionid,ismanaged" "uniquename eq '$(Escape-OData $SolutionUniqueName)'"
  if ($solution.Count -ne 1 -or [bool]$solution[0].ismanaged) { throw "Solucao $SolutionUniqueName nao e unmanaged unica." }
  $existing = Get-Rows "solutioncomponents" "solutioncomponentid" "_solutionid_value eq $($solution[0].solutionid) and objectid eq $ComponentId and componenttype eq $ComponentType"
  if ($existing.Count -eq 0) {
    Invoke-Dataverse "POST" "AddSolutionComponent" @{ ComponentId = $ComponentId; ComponentType = $ComponentType; SolutionUniqueName = $SolutionUniqueName; AddRequiredComponents = $false } | Out-Null
    Write-Step "componente adicionado $Label"
  }
}

function Ensure-Attribute([hashtable] $Spec) {
  $entity = $Spec.Entity
  $logical = $Spec.LogicalName
  $existing = Get-Rows "EntityDefinitions(LogicalName='$entity')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'"
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
    $existing = Get-Rows "EntityDefinitions(LogicalName='$entity')/Attributes" "MetadataId,LogicalName" "LogicalName eq '$logical'"
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
  $rows = Get-Rows "RelationshipDefinitions" "MetadataId,SchemaName" "SchemaName eq '$SchemaName'"
  if ($rows.Count -ne 1) { throw "Relacionamento $SchemaName nao encontrado de forma unica." }
  if (-not $Apply) { Write-Step "DRY RUN ajustaria cascata $SchemaName para Restrict"; return }
  Invoke-Dataverse "PATCH" "RelationshipDefinitions($($rows[0].MetadataId))" @{ CascadeConfiguration = @{ Delete = "Restrict" } } | Out-Null
  Write-Step "cascata Restrict aplicada $SchemaName"
}

function Ensure-CustomApi([hashtable] $Spec, [guid] $PluginTypeId) {
  $apis = Get-Rows "customapis" "customapiid,uniquename" "uniquename eq '$($Spec.UniqueName)'"
  if ($apis.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria Custom API $($Spec.UniqueName)"; return }
    $api = Invoke-Dataverse "POST" "customapis" @{
      uniquename = $Spec.UniqueName
      name = $Spec.UniqueName
      displayname = $Spec.DisplayName
      description = $Spec.Description
      bindingtype = 1
      boundentitylogicalname = "cr40f_trocasdecarro"
      isfunction = $false
      isprivate = $false
      allowedcustomprocessingsteptype = 0
      executeprivilegename = "prvWritecr40f_TrocasdeCarro"
      workflowsdkstepenabled = $false
      "plugintypeid@odata.bind" = "/plugintypes($PluginTypeId)"
    }
    $apis = @($api)
    Write-Step "Custom API criada $($Spec.UniqueName)"
  }
  if ($apis.Count -ne 1) { throw "Custom API $($Spec.UniqueName) nao ficou unica." }
  $apiId = [guid]$apis[0].customapiid
  $parameters = Get-Rows "customapirequestparameters" "customapirequestparameterid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_Motivo'"
  if ($parameters.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria parametro $($Spec.UniqueName).new_Motivo"; return }
    Invoke-Dataverse "POST" "customapirequestparameters" @{ name = "$($Spec.UniqueName).new_Motivo"; uniquename = "new_Motivo"; displayname = "Motivo"; description = "Motivo obrigatorio da acao"; type = 10; isoptional = $false; "customapiid@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  $responses = Get-Rows "customapiresponseproperties" "customapiresponsepropertyid,uniquename" "_customapiid_value eq $apiId and uniquename eq 'new_TrocaCompensatoriaId'"
  if ($Spec.HasResponse -and $responses.Count -eq 0) {
    if (-not $Apply) { Write-Step "DRY RUN criaria retorno $($Spec.UniqueName).new_TrocaCompensatoriaId"; return }
    Invoke-Dataverse "POST" "customapiresponseproperties" @{ name = "$($Spec.UniqueName).new_TrocaCompensatoriaId"; uniquename = "new_TrocaCompensatoriaId"; displayname = "Troca compensatoria"; description = "Identificador da compensacao criada"; type = 12; "customapiid@odata.bind" = "/customapis($apiId)" } | Out-Null
  }
  Add-SolutionComponent $apiId 10400 $Spec.UniqueName
}

Assert-RequiredTable "cr40f_trocasdecarro"
Assert-RequiredTable "cr40f_reservadeveiculos"
Assert-RequiredTable "new_possedeveiculo"

$attributes = @(
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodecancelamento"; SchemaName = "new_MotivoDeCancelamento"; DisplayName = "Motivo de cancelamento"; Description = "Motivo informado no cancelamento"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodeconclusaomanual"; SchemaName = "new_MotivoDeConclusaoManual"; DisplayName = "Motivo de conclusao manual"; Description = "Motivo informado na conclusao manual"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_motivodereversao"; SchemaName = "new_MotivoDeReversao"; DisplayName = "Motivo de reversao"; Description = "Motivo informado na reversao"; Type = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; MaxLength = 2000 },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_trocaoriginalrevertida"; SchemaName = "new_TrocaOriginalRevertida"; DisplayName = "Troca original revertida"; Description = "Troca compensada por este evento"; Type = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"; Targets = @("cr40f_trocasdecarro") },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_revertida"; SchemaName = "new_Revertida"; DisplayName = "Revertida"; Description = "Indica que existe evento compensatorio"; Type = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"; DefaultValue = $false; OptionSet = @{ TrueOption = @{ Value = 1; Label = @{ LocalizedLabels = @(@{ Label = "Sim"; LanguageCode = 1046 }) } }; FalseOption = @{ Value = 0; Label = @{ LocalizedLabels = @(@{ Label = "Nao"; LanguageCode = 1046 }) } } } },
  @{ Entity = "cr40f_trocasdecarro"; LogicalName = "new_executadopor"; SchemaName = "new_ExecutadoPor"; DisplayName = "Executado por"; Description = "Usuario que solicitou a acao compensatoria"; Type = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"; Targets = @("systemuser") }
)

foreach ($attribute in $attributes) { Ensure-Attribute $attribute }
Ensure-Key "cr40f_trocasdecarro" "new_TrocaOriginalRevertida_Key" "Troca original revertida unica" @("new_trocaoriginalrevertida")
Ensure-CascadeRestrict "new_PossedeVeiculo_TrocadeCarroRelacionada_cr40f_TrocasdeCarro"
Ensure-CascadeRestrict "cr40f_reservadeveiculos_OT_cr40f_trocasdecarro"

$pluginTypes = Get-Rows "plugintypes" "plugintypeid,typename" "typename eq 'Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin'"
if ($pluginTypes.Count -ne 1) { throw "PluginType ExchangeLifecycleCommandPlugin precisa ser registrado antes das Custom APIs." }
$apis = @(
  @{ UniqueName = "new_ConcluirTrocaDeCarro"; DisplayName = "Concluir troca de carro"; Description = "Conclui troca com validacao transacional"; HasResponse = $false },
  @{ UniqueName = "new_CancelarTrocaDeCarro"; DisplayName = "Cancelar troca de carro"; Description = "Cancela troca com motivo"; HasResponse = $false },
  @{ UniqueName = "new_ReverterTrocaDeCarro"; DisplayName = "Reverter troca de carro"; Description = "Cria evento compensatorio da troca"; HasResponse = $true }
)
foreach ($api in $apis) { Ensure-CustomApi $api ([guid]$pluginTypes[0].plugintypeid) }

Write-Step $(if ($Apply) { "PROVISIONAMENTO DEV OK" } else { "DRY RUN OK; use -Apply para publicar metadata no DEV" })
