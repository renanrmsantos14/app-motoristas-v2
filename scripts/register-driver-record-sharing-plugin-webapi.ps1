param(
  [Parameter(Mandatory = $true)]
  [string] $EnvironmentUrl,

  [string] $TechnicalUserEmail = "",

  [string] $DllPath = "",

  [string] $SolutionUniqueName = "AppBetinhos",

  [switch] $Apply,

  [switch] $DeviceCode,

  [switch] $AddExistingToSolution
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[driver-sharing-plugin-webapi] $Message"
}

function Escape-ODataText([string] $Value) {
  return $Value.Replace("'", "''")
}

function Normalize-Csv([string] $Value) {
  return (($Value -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object) -join ",")
}

function Assert-SameCsv([string] $Expected, [string] $Actual, [string] $Label) {
  if ((Normalize-Csv $Expected) -ne (Normalize-Csv $Actual)) {
    throw "$Label divergente. esperado='$Expected'; atual='$Actual'."
  }
}

function Get-AccessToken([string] $BaseUrl, [switch] $UseDeviceCode) {
  if (-not (Get-Module -ListAvailable MSAL.PS)) {
    throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
  }

  Import-Module MSAL.PS -ErrorAction Stop
  $client = New-MsalClientApplication `
    -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" `
    -TenantId "organizations" `
    -RedirectUri ([Uri] "http://localhost")
  Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
  $scope = "$BaseUrl/user_impersonation"

  if ($UseDeviceCode) {
    return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -DeviceCode).AccessToken
  }

  try {
    return (Get-MsalToken -PublicClientApplication $client -Scopes $scope -Silent).AccessToken
  }
  catch {
    return (Get-MsalToken -PublicClientApplication $client -Scopes $scope).AccessToken
  }
}

$script:baseUrl = $EnvironmentUrl.TrimEnd("/")
$script:token = Get-AccessToken $script:baseUrl -UseDeviceCode:$DeviceCode
if ([string]::IsNullOrWhiteSpace($script:token)) {
  throw "Falha ao obter token para $script:baseUrl"
}

function Get-DataverseErrorDetail($ErrorRecord) {
  if ($null -ne $ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace([string]$ErrorRecord.ErrorDetails.Message)) {
    return [string]$ErrorRecord.ErrorDetails.Message
  }

  try {
    $responseStream = $ErrorRecord.Exception.Response.GetResponseStream()
    if ($null -ne $responseStream) {
      $reader = New-Object IO.StreamReader($responseStream)
      try { return $reader.ReadToEnd() }
      finally { $reader.Dispose() }
    }
  }
  catch {}

  return [string]$ErrorRecord.Exception.Message
}

function Invoke-DataverseRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $Method,
    [Parameter(Mandatory = $true)] [string] $Path,
    [object] $Body
  )

  $headers = @{
    Authorization = "Bearer $script:token"
    Accept = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version" = "4.0"
    Prefer = "return=representation"
    "MSCRM.SolutionUniqueName" = $SolutionUniqueName
  }
  if ($Method -eq "PATCH") {
    $headers["If-Match"] = "*"
  }

  $params = @{
    Method = $Method
    Uri = "$script:baseUrl/api/data/v9.2/$Path"
    Headers = $headers
    ContentType = "application/json; charset=utf-8"
  }
  if ($null -ne $Body) {
    $params.Body = $Body | ConvertTo-Json -Depth 10 -Compress
  }

  $lastError = $null
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      return Invoke-RestMethod @params
    }
    catch {
      $lastError = $_
      $statusCode = $null
      try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
      $isTransient = $null -eq $statusCode -or $statusCode -eq 408 -or $statusCode -eq 429 -or $statusCode -ge 500
      $canRetry = $Method -in @("GET", "PATCH") -and $isTransient
      if ($attempt -eq 4 -or -not $canRetry) { break }
      Write-Step "$Method $Path falhou tentativa $attempt/4: $(Get-DataverseErrorDetail $_)"
      Start-Sleep -Seconds ($attempt * 2)
    }
  }
  throw "Dataverse $Method $Path falhou: $(Get-DataverseErrorDetail $lastError)"
}

function Get-DataverseRows([string] $EntitySet, [string] $Select, [string] $Filter) {
  $path = "${EntitySet}?`$select=$Select"
  if ($Filter) { $path += "&`$filter=$([uri]::EscapeDataString($Filter))" }
  $response = Invoke-DataverseRequest -Method "GET" -Path $path
  if ($null -ne $response -and $response.PSObject.Properties.Name -contains "value") { return @($response.value) }
  if ($null -ne $response) { return @($response) }
  return @()
}

function Assert-RequiredTable([string] $LogicalName) {
  try {
    $path = "EntityDefinitions?`$select=MetadataId,LogicalName&`$filter=LogicalName eq '$LogicalName'"
    $rows = @((Invoke-DataverseRequest -Method "GET" -Path $path).value)
  }
  catch {
    throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV: $(Get-DataverseErrorDetail $_)"
  }
  if ($rows.Count -ne 1) { throw "Tabela obrigatoria $LogicalName nao esta disponivel neste ambiente DEV." }
}

function Get-SingleRow([string] $EntitySet, [string] $Select, [string] $Filter, [string] $Label) {
  $rows = @(Get-DataverseRows $EntitySet $Select $Filter)
  if ($rows.Count -ne 1) {
    throw "${Label}: esperado 1 registro, encontrado $($rows.Count)."
  }
  return $rows[0]
}

function New-Bind([string] $EntitySet, [string] $Id) {
  return "/$EntitySet($Id)"
}

function Get-Sha256Hex([byte[]] $Bytes) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha256.ComputeHash($Bytes))).Replace("-", "")
  }
  finally {
    $sha256.Dispose()
  }
}

$specs = @(
  [pscustomobject]@{ Label = "Servicos Create"; Entity = "cr40f_reservadeveculos"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Servicos Update"; Entity = "cr40f_reservadeveculos"; Message = "Update"; Mode = 0; Filtering = "cr40f_motorista,cr40f_solicitante,cr40f_dataehorriodesada,cr40f_horrioprevistoderetorno,cr40f_veiculo,new_origemveiculo,cr40f_ot,cr40f_status,new_datadefinalizacao"; PreImage = @("cr40f_motorista", "cr40f_solicitante", "cr40f_dataehorriodesada", "cr40f_horrioprevistoderetorno", "cr40f_veiculo", "new_origemveiculo", "cr40f_ot", "cr40f_status", "new_datadefinalizacao") },
  [pscustomobject]@{ Label = "Funcionarios Create"; Entity = "cr40f_funcionarios"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Funcionarios Update"; Entity = "cr40f_funcionarios"; Message = "Update"; Mode = 0; Filtering = "cr40f_emailmicrosoft"; PreImage = @("cr40f_emailmicrosoft") },
  [pscustomobject]@{ Label = "Servicos por passageiro Create"; Entity = "cr40f_servicosporpassageiro"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Servicos por passageiro Update"; Entity = "cr40f_servicosporpassageiro"; Message = "Update"; Mode = 1; Filtering = "cr40f_geral,cr40f_bancodedados"; PreImage = @("cr40f_geral", "cr40f_bancodedados") },
  [pscustomobject]@{ Label = "Servicos por passageiro Delete"; Entity = "cr40f_servicosporpassageiro"; Message = "Delete"; Mode = 1; Filtering = ""; PreImage = @("cr40f_geral", "cr40f_bancodedados") },
  [pscustomobject]@{ Label = "Passageiros Update"; Entity = "cr40f_bancodedados"; Message = "Update"; Mode = 1; Filtering = "cr40f_nomedopassageiro,cr40f_telefone"; PreImage = @("cr40f_nomedopassageiro", "cr40f_telefone") },
  [pscustomobject]@{ Label = "Trocas de carro Create"; Entity = "cr40f_trocasdecarro"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Trocas de carro Update"; Entity = "cr40f_trocasdecarro"; Message = "Update"; Mode = 0; Filtering = "cr40f_motorista1,cr40f_motorista2,cr40f_statusdatroca,cr40f_veiculo1antesdatroca,cr40f_veiculo2antesdatroca,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,new_tipodetroca,new_concluidomotorista1,new_concluidomotorista2,new_observacaodomotorista1,new_observacaodomotorista2"; PreImage = @("cr40f_motorista1", "cr40f_motorista2", "cr40f_statusdatroca", "cr40f_veiculo1antesdatroca", "cr40f_veiculo2antesdatroca", "cr40f_iniciodajaneladetroca", "cr40f_fimdajaneladetroca", "new_tipodetroca", "new_concluidomotorista1", "new_concluidomotorista2", "new_observacaodomotorista1", "new_observacaodomotorista2") },
  [pscustomobject]@{ Label = "Trocas de carro Create PreValidation"; Entity = "cr40f_trocasdecarro"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Trocas de carro Update PreValidation"; Entity = "cr40f_trocasdecarro"; Message = "Update"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Trocas de carro Delete PreValidation"; Entity = "cr40f_trocasdecarro"; Message = "Delete"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Servicos de troca Create PreValidation"; Entity = "cr40f_reservadeveculos"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Servicos de troca Update PreValidation"; Entity = "cr40f_reservadeveculos"; Message = "Update"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Servicos de troca Delete PreValidation"; Entity = "cr40f_reservadeveculos"; Message = "Delete"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Posse de veiculo Create PreValidation"; Entity = "new_possedeveiculo"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Posse de veiculo Update PreValidation"; Entity = "new_possedeveiculo"; Message = "Update"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Posse de veiculo Delete PreValidation"; Entity = "new_possedeveiculo"; Message = "Delete"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 10 },
  [pscustomobject]@{ Label = "Posse de veiculo Create PreOperation"; Entity = "new_possedeveiculo"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @(); Stage = 20 },
  [pscustomobject]@{ Label = "Posse de veiculo Update PreOperation"; Entity = "new_possedeveiculo"; Message = "Update"; Mode = 0; Filtering = "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse"; PreImage = @("new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse"); Stage = 20 },
  [pscustomobject]@{ Label = "Posse de veiculo Create"; Entity = "new_possedeveiculo"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Posse de veiculo Update"; Entity = "new_possedeveiculo"; Message = "Update"; Mode = 0; Filtering = "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse"; PreImage = @("new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse") },
  [pscustomobject]@{ Label = "Colisoes Create"; Entity = "cr40f_colisao_v2"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Colisoes Update"; Entity = "cr40f_colisao_v2"; Message = "Update"; Mode = 1; Filtering = "cr40f_motorista"; PreImage = @("cr40f_motorista") },
  [pscustomobject]@{ Label = "Recibos Create"; Entity = "cr40f_recibos_v2"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Recibos Update"; Entity = "cr40f_recibos_v2"; Message = "Update"; Mode = 1; Filtering = "cr40f_motorista"; PreImage = @("cr40f_motorista") },
  [pscustomobject]@{ Label = "Pedido de cotacao Update"; Entity = "cr40f_pedidodecotacao"; Message = "Update"; Mode = 0; Filtering = "cr40f_origemultimasincronizacao,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_condicaocomercial,cr40f_respostaenviadacliente,cr40f_clienteempresa,cr40f_contatocliente,cr40f_telefonewhatsapp,cr40f_emailcliente,cr40f_origem,cr40f_destino,cr40f_datahoraservico,cr40f_quantidadepassageiros,cr40f_observacoespedido,cr40f_prioridade"; PreImage = @() }
)

Assert-RequiredTable "cr40f_trocasdecarro"
Assert-RequiredTable "new_possedeveiculo"
$registrationSpecs = @($specs)
Write-Step "registrando e validando os contratos de plugin, incluindo cr40f_reservadeveculos."

function Resolve-RegistrationContext {
  $messages = @{}
  foreach ($message in ($specs.Message | Select-Object -Unique)) {
    $messages[$message] = Get-SingleRow "sdkmessages" "sdkmessageid,name" "name eq '$(Escape-ODataText $message)'" "sdkmessage $message"
  }
  return $messages
}

function Get-RunAsUser {
  if (-not $TechnicalUserEmail) { return $null }
  return Get-SingleRow "systemusers" "systemuserid,fullname,internalemailaddress" "internalemailaddress eq '$(Escape-ODataText $TechnicalUserEmail)' and isdisabled eq false" "Usuario tecnico $TechnicalUserEmail"
}

function Get-MessageFilter($MessageId, [string] $Entity) {
  $metadataPath = "EntityDefinitions?`$select=ObjectTypeCode&`$filter=LogicalName eq '$Entity'"
  $metadata = @((Invoke-DataverseRequest -Method "GET" -Path $metadataPath).value)
  if ($metadata.Count -ne 1 -or $null -eq $metadata[0].ObjectTypeCode) {
    throw "Metadata da tabela $Entity nao retornou ObjectTypeCode: $($metadata | ConvertTo-Json -Compress)"
  }
  $objectTypeCode = [int]$metadata[0].ObjectTypeCode
  $allRows = @(Get-DataverseRows "sdkmessagefilters" "sdkmessagefilterid,primaryobjecttypecode" "_sdkmessageid_value eq $MessageId")
  $rows = @($allRows | Where-Object { [string]$_.primaryobjecttypecode -eq $Entity -or [string]$_.primaryobjecttypecode -eq [string]$objectTypeCode })
  if ($rows.Count -ne 1) { throw "sdkmessagefilter $Entity`: esperado 1 registro, encontrado $($rows.Count)." }
  return $rows[0]
}

function Get-PluginAssembly {
  return @(Get-DataverseRows "pluginassemblies" "pluginassemblyid,name,version,isolationmode,sourcetype,content" "name eq 'Betinhos.DriverRecordSharing'")
}

function Get-PluginType {
  return @(Get-DataverseRows "plugintypes" "plugintypeid,typename,_pluginassemblyid_value" "typename eq 'Betinhos.DriverRecordSharing.ServiceDriverSharePlugin'")
}

function Get-CommandPluginType {
  return @(Get-DataverseRows "plugintypes" "plugintypeid,typename,_pluginassemblyid_value" "typename eq 'Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin'")
}

function Get-Step($PluginTypeId, $MessageId, $FilterId, [int] $Stage) {
  return @(Get-DataverseRows "sdkmessageprocessingsteps" "sdkmessageprocessingstepid,name,mode,stage,filteringattributes,supporteddeployment,statecode,asyncautodelete,_impersonatinguserid_value" "_eventhandler_value eq $PluginTypeId and _sdkmessageid_value eq $MessageId and _sdkmessagefilterid_value eq $FilterId and stage eq $Stage and statecode eq 0")
}

function Get-PreImage($StepId) {
  return @(Get-DataverseRows "sdkmessageprocessingstepimages" "sdkmessageprocessingstepimageid,entityalias,imagetype,messagepropertyname,attributes" "_sdkmessageprocessingstepid_value eq $StepId and imagetype eq 0 and entityalias eq 'pre'")
}

function Get-Solution([string] $UniqueName) {
  return Get-SingleRow "solutions" "solutionid,uniquename,ismanaged" "uniquename eq '$(Escape-ODataText $UniqueName)'" "Solucao $UniqueName"
}

function Get-SolutionComponent([string] $SolutionId, [string] $ComponentId, [int] $ComponentType) {
  return @(Get-DataverseRows "solutioncomponents" "solutioncomponentid,objectid,componenttype" "_solutionid_value eq $SolutionId and objectid eq $ComponentId and componenttype eq $ComponentType")
}

function Ensure-SolutionComponent([string] $SolutionId, [string] $ComponentId, [int] $ComponentType, [string] $Label) {
  $existing = @(Get-SolutionComponent $SolutionId $ComponentId $ComponentType)
  if ($existing.Count -gt 1) { throw "${Label}: componente duplicado na solucao." }
  if ($existing.Count -eq 1) {
    Write-Step "solucao ja contem $Label"
    return
  }

  Write-Step "adicionando $Label na solucao $SolutionUniqueName"
  Invoke-DataverseRequest "POST" "AddSolutionComponent" @{
    ComponentId = $ComponentId
    ComponentType = $ComponentType
    SolutionUniqueName = $SolutionUniqueName
    AddRequiredComponents = $false
  } | Out-Null

  $created = @(Get-SolutionComponent $SolutionId $ComponentId $ComponentType)
  if ($created.Count -ne 1) { throw "${Label}: componente nao foi incluido na solucao." }
}

function Add-PluginToSolution {
  $solution = Get-Solution $SolutionUniqueName
  if ([bool]$solution.ismanaged) { throw "Solucao $SolutionUniqueName e gerenciada; use uma solucao nao gerenciada no ambiente de desenvolvimento." }

  $assembly = @(Get-PluginAssembly)
  if ($assembly.Count -ne 1) { throw "Assembly Betinhos.DriverRecordSharing: esperado 1, encontrado $($assembly.Count)." }
  $types = @(Get-PluginType)
  if ($types.Count -ne 1) { throw "PluginType Betinhos.DriverRecordSharing.ServiceDriverSharePlugin: esperado 1, encontrado $($types.Count)." }
  $commandTypes = @(Get-CommandPluginType)
  if ($commandTypes.Count -ne 1) { throw "PluginType Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin: esperado 1, encontrado $($commandTypes.Count)." }

  Ensure-SolutionComponent $solution.solutionid $assembly[0].pluginassemblyid 91 "assembly Betinhos.DriverRecordSharing"

  $messages = Resolve-RegistrationContext
  foreach ($spec in $registrationSpecs) {
    $stage = if ($spec.PSObject.Properties['Stage']) { [int]$spec.Stage } else { 40 }
    $filter = Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity
    $steps = @(Get-Step $types[0].plugintypeid $messages[$spec.Message].sdkmessageid $filter.sdkmessagefilterid $stage)
    if ($steps.Count -ne 1) { throw "$($spec.Label): esperado 1 step, encontrado $($steps.Count)." }
    $step = $steps[0]
    Ensure-SolutionComponent $solution.solutionid $step.sdkmessageprocessingstepid 92 "step $($spec.Label)"
  }
}

function Assert-PluginComponentInventory {
  $solution = Get-Solution $SolutionUniqueName
  if ([bool]$solution.ismanaged) { throw "Solucao $SolutionUniqueName e gerenciada; use uma solucao nao gerenciada no ambiente de desenvolvimento." }

  $assembly = @(Get-PluginAssembly)
  if ($assembly.Count -ne 1) { throw "Assembly Betinhos.DriverRecordSharing: esperado 1, encontrado $($assembly.Count)." }
  $types = @(Get-PluginType)
  if ($types.Count -ne 1) { throw "PluginType Betinhos.DriverRecordSharing.ServiceDriverSharePlugin: esperado 1, encontrado $($types.Count)." }
  $commandTypes = @(Get-CommandPluginType)
  if ($commandTypes.Count -ne 1) { throw "PluginType Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin: esperado 1, encontrado $($commandTypes.Count)." }

  $messages = Resolve-RegistrationContext
  foreach ($spec in $registrationSpecs) {
    $stage = if ($spec.PSObject.Properties['Stage']) { [int]$spec.Stage } else { 40 }
    $filter = Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity
    $steps = @(Get-Step $types[0].plugintypeid $messages[$spec.Message].sdkmessageid $filter.sdkmessagefilterid $stage)
    if ($steps.Count -ne 1) { throw "$($spec.Label): esperado 1 step, encontrado $($steps.Count)." }
    if ($spec.PreImage.Count -eq 0) { continue }
    $images = @(Get-PreImage $steps[0].sdkmessageprocessingstepid)
    if ($images.Count -ne 1) { throw "$($spec.Label): esperado 1 Pre Image, encontrado $($images.Count)." }
  }
}

function Assert-Configuration([switch] $SkipAssemblyHash) {
  $assemblies = @(Get-PluginAssembly)
  if ($assemblies.Count -ne 1) { throw "Assembly Betinhos.DriverRecordSharing: esperado 1, encontrado $($assemblies.Count)." }
  $assembly = $assemblies[0]
  if ([int]$assembly.isolationmode -ne 2 -or [int]$assembly.sourcetype -ne 0) { throw "Assembly nao esta Sandbox/Database." }

  if (-not $SkipAssemblyHash) {
    $localHash = (Get-FileHash -LiteralPath $DllPath -Algorithm SHA256).Hash
    $remoteHash = Get-Sha256Hex ([Convert]::FromBase64String([string]$assembly.content))
    if ($localHash -ne $remoteHash) { throw "DLL publicada diverge da DLL local. local=$localHash; remoto=$remoteHash" }
  }

  $types = @(Get-PluginType)
  if ($types.Count -ne 1 -or [string]$types[0]._pluginassemblyid_value -ne [string]$assembly.pluginassemblyid) { throw "PluginType nao aponta para assembly correto." }
  $commandTypes = @(Get-CommandPluginType)
  if ($commandTypes.Count -ne 1 -or [string]$commandTypes[0]._pluginassemblyid_value -ne [string]$assembly.pluginassemblyid) { throw "PluginType de comandos nao aponta para assembly correto." }
  $runAs = Get-RunAsUser
  $messages = Resolve-RegistrationContext

  foreach ($spec in $registrationSpecs) {
    $stage = if ($spec.PSObject.Properties['Stage']) { [int]$spec.Stage } else { 40 }
    $filter = Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity
    $steps = @(Get-Step $types[0].plugintypeid $messages[$spec.Message].sdkmessageid $filter.sdkmessagefilterid $stage)
    if ($steps.Count -ne 1) { throw "$($spec.Label): esperado 1 step, encontrado $($steps.Count)." }
    $step = $steps[0]
    if ([int]$step.mode -ne $spec.Mode -or [int]$step.stage -ne $stage -or [int]$step.supporteddeployment -ne 0 -or [int]$step.statecode -ne 0 -or [bool]$step.asyncautodelete -ne ($spec.Mode -eq 1)) { throw "$($spec.Label): modo, estagio, deployment, estado ou asyncautodelete divergente." }
    Assert-SameCsv $spec.Filtering ([string]$step.filteringattributes) "$($spec.Label): filtro"
    if ($runAs -and [string]$step._impersonatinguserid_value -ne [string]$runAs.systemuserid) { throw "$($spec.Label): Run As divergente." }
    $images = @(Get-PreImage $step.sdkmessageprocessingstepid)
    if ($spec.PreImage.Count -eq 0) {
      if ($images.Count -ne 0) { throw "$($spec.Label): nao deveria ter Pre Image 'pre'." }
      continue
    }
    if ($images.Count -ne 1) { throw "$($spec.Label): esperado 1 Pre Image, encontrado $($images.Count)." }
    if ([string]$images[0].messagepropertyname -ne "Target") { throw "$($spec.Label): Pre Image deve usar Target." }
    Assert-SameCsv ($spec.PreImage -join ",") ([string]$images[0].attributes) "$($spec.Label): Pre Image"
  }
}

$messages = Resolve-RegistrationContext
foreach ($spec in $registrationSpecs) { [void](Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity) }

if ($AddExistingToSolution -and -not $Apply) {
  Assert-PluginComponentInventory
  Write-Step "DRY RUN OK. Registro validado; use -Apply -AddExistingToSolution para incluir na solucao $SolutionUniqueName."
  return
}

if (-not $DllPath) {
  $DllPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll"
}
if (-not (Test-Path -LiteralPath $DllPath)) { throw "DLL nao encontrada: $DllPath" }

if (-not $Apply) {
  Write-Step "DRY RUN OK. Metadados dos $($specs.Count) steps conferidos; use -Apply para publicar."
  return
}

$assemblyBytes = [IO.File]::ReadAllBytes((Resolve-Path $DllPath))
$assemblyRows = @(Get-PluginAssembly)
if ($assemblyRows.Count -gt 1) { throw "Assembly Betinhos.DriverRecordSharing duplicado." }
if ($assemblyRows.Count -eq 1) {
  $assemblyId = [string]$assemblyRows[0].pluginassemblyid
  Write-Step "atualizando assembly"
  Invoke-DataverseRequest "PATCH" "pluginassemblies($assemblyId)" @{ content = [Convert]::ToBase64String($assemblyBytes) } | Out-Null
}
else {
  Write-Step "criando assembly"
  $assemblyName = [Reflection.AssemblyName]::GetAssemblyName((Resolve-Path $DllPath))
  $publicKeyTokenBytes = $assemblyName.GetPublicKeyToken()
  $publicKeyToken = if ($publicKeyTokenBytes) { ([BitConverter]::ToString($publicKeyTokenBytes)).Replace("-", "").ToLowerInvariant() } else { "" }
  $created = Invoke-DataverseRequest "POST" "pluginassemblies" @{
    name = "Betinhos.DriverRecordSharing"; content = [Convert]::ToBase64String($assemblyBytes); isolationmode = 2; sourcetype = 0
    version = [string]$assemblyName.Version; culture = if ($assemblyName.CultureName) { $assemblyName.CultureName } else { "neutral" }; publickeytoken = $publicKeyToken
  }
  $assemblyId = [string]$created.pluginassemblyid
}

$typeRows = @(Get-PluginType)
if ($typeRows.Count -gt 1) { throw "PluginType duplicado." }
if ($typeRows.Count -eq 1) {
  $pluginTypeId = [string]$typeRows[0].plugintypeid
}
else {
  Write-Step "criando PluginType"
  $created = Invoke-DataverseRequest "POST" "plugintypes" @{ name = "ServiceDriverSharePlugin"; friendlyname = "ServiceDriverSharePlugin"; typename = "Betinhos.DriverRecordSharing.ServiceDriverSharePlugin"; "pluginassemblyid@odata.bind" = (New-Bind "pluginassemblies" $assemblyId) }
  $pluginTypeId = [string]$created.plugintypeid
}

$commandTypeRows = @(Get-CommandPluginType)
if ($commandTypeRows.Count -gt 1) { throw "PluginType ExchangeLifecycleCommandPlugin duplicado." }
if ($commandTypeRows.Count -eq 1) {
  $commandPluginTypeId = [string]$commandTypeRows[0].plugintypeid
}
else {
  Write-Step "criando PluginType ExchangeLifecycleCommandPlugin"
  $created = Invoke-DataverseRequest "POST" "plugintypes" @{ name = "ExchangeLifecycleCommandPlugin"; friendlyname = "ExchangeLifecycleCommandPlugin"; typename = "Betinhos.DriverRecordSharing.ExchangeLifecycleCommandPlugin"; "pluginassemblyid@odata.bind" = (New-Bind "pluginassemblies" $assemblyId) }
  $commandPluginTypeId = [string]$created.plugintypeid
}

$runAs = Get-RunAsUser
  foreach ($spec in $registrationSpecs) {
  $stage = if ($spec.PSObject.Properties['Stage']) { [int]$spec.Stage } else { 40 }
  $messageId = [string]$messages[$spec.Message].sdkmessageid
  $filterId = [string](Get-MessageFilter $messageId $spec.Entity).sdkmessagefilterid
  $stepRows = @(Get-Step $pluginTypeId $messageId $filterId $stage)
  if ($stepRows.Count -gt 1) { throw "$($spec.Label): steps duplicados." }
  $payload = @{ name = "DriverRecordSharing - $($spec.Label)"; description = "Criado pelo script register-driver-record-sharing-plugin-webapi.ps1"; "eventhandler_plugintype@odata.bind" = (New-Bind "plugintypes" $pluginTypeId); "sdkmessageid@odata.bind" = (New-Bind "sdkmessages" $messageId); "sdkmessagefilterid@odata.bind" = (New-Bind "sdkmessagefilters" $filterId); stage = $stage; mode = $spec.Mode; asyncautodelete = ($spec.Mode -eq 1); rank = 1; supporteddeployment = 0 }
  if ($spec.Message -eq "Update") { $payload.filteringattributes = $spec.Filtering }
  if ($runAs) { $payload["impersonatinguserid@odata.bind"] = (New-Bind "systemusers" $runAs.systemuserid) }
  if ($stepRows.Count -eq 1) {
    $stepId = [string]$stepRows[0].sdkmessageprocessingstepid
    Write-Step "atualizando step $($spec.Label)"
    Invoke-DataverseRequest "PATCH" "sdkmessageprocessingsteps($stepId)" $payload | Out-Null
  }
  else {
    Write-Step "criando step $($spec.Label)"
    $stepId = [string](Invoke-DataverseRequest "POST" "sdkmessageprocessingsteps" $payload).sdkmessageprocessingstepid
  }
  if ($spec.PreImage.Count -eq 0) { continue }
  $imageRows = @(Get-PreImage $stepId)
  if ($imageRows.Count -gt 1) { throw "$($spec.Label): Pre Images duplicadas." }
  $imagePayload = @{ name = "pre"; entityalias = "pre"; imagetype = 0; messagepropertyname = "Target"; attributes = ($spec.PreImage -join ","); "sdkmessageprocessingstepid@odata.bind" = (New-Bind "sdkmessageprocessingsteps" $stepId) }
  if ($imageRows.Count -eq 1) {
    Invoke-DataverseRequest "PATCH" "sdkmessageprocessingstepimages($($imageRows[0].sdkmessageprocessingstepimageid))" $imagePayload | Out-Null
  }
  else {
    Invoke-DataverseRequest "POST" "sdkmessageprocessingstepimages" $imagePayload | Out-Null
  }
}

Assert-Configuration
if ($AddExistingToSolution) {
  Add-PluginToSolution
  Assert-PluginComponentInventory
  Write-Step "PLUGIN ADICIONADO E VALIDADO NA SOLUCAO $SolutionUniqueName"
}

Write-Step "REGISTRO E VALIDACAO OK"
