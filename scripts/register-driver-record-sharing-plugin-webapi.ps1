param(
  [Parameter(Mandatory = $true)]
  [string] $EnvironmentUrl,

  [string] $TechnicalUserEmail = "",

  [string] $DllPath = "",

  [switch] $Apply,

  [switch] $DeviceCode
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
      if ($attempt -eq 4) { break }
      Write-Step "$Method $Path falhou tentativa $attempt/4: $($_.Exception.Message)"
      Start-Sleep -Seconds ($attempt * 2)
    }
  }
  throw "Dataverse $Method $Path falhou apos 4 tentativas. $($lastError.Exception.Message)"
}

function Get-DataverseRows([string] $EntitySet, [string] $Select, [string] $Filter) {
  $path = "${EntitySet}?`$select=$Select"
  if ($Filter) { $path += "&`$filter=$([uri]::EscapeDataString($Filter))" }
  $response = Invoke-DataverseRequest -Method "GET" -Path $path
  return @($response.value)
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

$specs = @(
  [pscustomobject]@{ Label = "Servicos Create"; Entity = "cr40f_reservadeveculos"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Servicos Update"; Entity = "cr40f_reservadeveculos"; Message = "Update"; Mode = 0; Filtering = "cr40f_motorista,cr40f_solicitante,cr40f_dataehorriodesada,cr40f_veiculo,new_origemveiculo,cr40f_ot,cr40f_status"; PreImage = @("cr40f_motorista", "cr40f_solicitante", "cr40f_dataehorriodesada", "cr40f_veiculo", "new_origemveiculo", "cr40f_ot", "cr40f_status") },
  [pscustomobject]@{ Label = "Funcionarios Create"; Entity = "cr40f_funcionarios"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Funcionarios Update"; Entity = "cr40f_funcionarios"; Message = "Update"; Mode = 0; Filtering = "cr40f_emailmicrosoft"; PreImage = @("cr40f_emailmicrosoft") },
  [pscustomobject]@{ Label = "Servicos por passageiro Create"; Entity = "cr40f_servicosporpassageiro"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Servicos por passageiro Update"; Entity = "cr40f_servicosporpassageiro"; Message = "Update"; Mode = 1; Filtering = "cr40f_geral,cr40f_bancodedados"; PreImage = @("cr40f_geral", "cr40f_bancodedados") },
  [pscustomobject]@{ Label = "Servicos por passageiro Delete"; Entity = "cr40f_servicosporpassageiro"; Message = "Delete"; Mode = 1; Filtering = ""; PreImage = @("cr40f_geral", "cr40f_bancodedados") },
  [pscustomobject]@{ Label = "Passageiros Update"; Entity = "cr40f_bancodedados"; Message = "Update"; Mode = 1; Filtering = "cr40f_nomedopassageiro,cr40f_telefone"; PreImage = @("cr40f_nomedopassageiro", "cr40f_telefone") },
  [pscustomobject]@{ Label = "Trocas de carro Create"; Entity = "cr40f_trocasdecarro"; Message = "Create"; Mode = 0; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Trocas de carro Update"; Entity = "cr40f_trocasdecarro"; Message = "Update"; Mode = 0; Filtering = "cr40f_motorista1,cr40f_motorista2,cr40f_statusdatroca,cr40f_veiculo1antesdatroca,cr40f_veiculo2antesdatroca,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,new_tipodetroca"; PreImage = @("cr40f_motorista1", "cr40f_motorista2", "cr40f_statusdatroca", "cr40f_veiculo1antesdatroca", "cr40f_veiculo2antesdatroca", "cr40f_iniciodajaneladetroca", "cr40f_fimdajaneladetroca", "new_tipodetroca") },
  [pscustomobject]@{ Label = "Posse de veiculo Create"; Entity = "new_possedeveiculo"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Posse de veiculo Update"; Entity = "new_possedeveiculo"; Message = "Update"; Mode = 1; Filtering = "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse"; PreImage = @("new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse") },
  [pscustomobject]@{ Label = "Colisoes Create"; Entity = "cr40f_colisao_v2"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Colisoes Update"; Entity = "cr40f_colisao_v2"; Message = "Update"; Mode = 1; Filtering = "cr40f_motorista"; PreImage = @("cr40f_motorista") },
  [pscustomobject]@{ Label = "Recibos Create"; Entity = "cr40f_recibos_v2"; Message = "Create"; Mode = 1; Filtering = ""; PreImage = @() },
  [pscustomobject]@{ Label = "Recibos Update"; Entity = "cr40f_recibos_v2"; Message = "Update"; Mode = 1; Filtering = "cr40f_motorista"; PreImage = @("cr40f_motorista") },
  [pscustomobject]@{ Label = "Pedido de cotacao Update"; Entity = "cr40f_pedidodecotacao"; Message = "Update"; Mode = 0; Filtering = "cr40f_origemultimasincronizacao,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_condicaocomercial,cr40f_respostaenviadacliente,cr40f_clienteempresa,cr40f_contatocliente,cr40f_telefonewhatsapp,cr40f_emailcliente,cr40f_origem,cr40f_destino,cr40f_datahoraservico,cr40f_quantidadepassageiros,cr40f_observacoespedido,cr40f_prioridade"; PreImage = @() }
)

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
  return Get-SingleRow "sdkmessagefilters" "sdkmessagefilterid,primaryobjecttypecode" "_sdkmessageid_value eq $MessageId and primaryobjecttypecode eq '$(Escape-ODataText $Entity)'" "sdkmessagefilter $Entity"
}

function Get-PluginAssembly {
  return @(Get-DataverseRows "pluginassemblies" "pluginassemblyid,name,version,isolationmode,sourcetype,content" "name eq 'Betinhos.DriverRecordSharing'")
}

function Get-PluginType {
  return @(Get-DataverseRows "plugintypes" "plugintypeid,typename,_pluginassemblyid_value" "typename eq 'Betinhos.DriverRecordSharing.ServiceDriverSharePlugin'")
}

function Get-Step($PluginTypeId, $MessageId, $FilterId) {
  return @(Get-DataverseRows "sdkmessageprocessingsteps" "sdkmessageprocessingstepid,name,mode,stage,filteringattributes,supporteddeployment,statecode,_impersonatinguserid_value" "_eventhandler_value eq $PluginTypeId and _sdkmessageid_value eq $MessageId and _sdkmessagefilterid_value eq $FilterId")
}

function Get-PreImage($StepId) {
  return @(Get-DataverseRows "sdkmessageprocessingstepimages" "sdkmessageprocessingstepimageid,entityalias,imagetype,messagepropertyname,attributes" "_sdkmessageprocessingstepid_value eq $StepId and imagetype eq 0 and entityalias eq 'pre'")
}

function Assert-Configuration {
  $assemblies = @(Get-PluginAssembly)
  if ($assemblies.Count -ne 1) { throw "Assembly Betinhos.DriverRecordSharing: esperado 1, encontrado $($assemblies.Count)." }
  $assembly = $assemblies[0]
  if ([int]$assembly.isolationmode -ne 2 -or [int]$assembly.sourcetype -ne 0) { throw "Assembly nao esta Sandbox/Database." }

  $localHash = (Get-FileHash -LiteralPath $DllPath -Algorithm SHA256).Hash
  $remoteHash = ([BitConverter]::ToString([Convert]::FromBase64String([string]$assembly.content))).Replace("-", "")
  if ($localHash -ne $remoteHash) { throw "DLL publicada diverge da DLL local. local=$localHash; remoto=$remoteHash" }

  $types = @(Get-PluginType)
  if ($types.Count -ne 1 -or [string]$types[0]._pluginassemblyid_value -ne [string]$assembly.pluginassemblyid) { throw "PluginType nao aponta para assembly correto." }
  $runAs = Get-RunAsUser
  $messages = Resolve-RegistrationContext

  foreach ($spec in $specs) {
    $filter = Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity
    $steps = @(Get-Step $types[0].plugintypeid $messages[$spec.Message].sdkmessageid $filter.sdkmessagefilterid)
    if ($steps.Count -ne 1) { throw "$($spec.Label): esperado 1 step, encontrado $($steps.Count)." }
    $step = $steps[0]
    if ([int]$step.mode -ne $spec.Mode -or [int]$step.stage -ne 40 -or [int]$step.supporteddeployment -ne 0 -or [int]$step.statecode -ne 0) { throw "$($spec.Label): modo, estagio, deployment ou estado divergente." }
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

if (-not $DllPath) {
  $DllPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll"
}
if (-not (Test-Path -LiteralPath $DllPath)) { throw "DLL nao encontrada: $DllPath" }

$messages = Resolve-RegistrationContext
foreach ($spec in $specs) { [void](Get-MessageFilter $messages[$spec.Message].sdkmessageid $spec.Entity) }

if (-not $Apply) {
  Write-Step "DRY RUN OK. Metadados dos $($specs.Count) steps conferidos; use -Apply para publicar."
  return
}

$assemblyBytes = [IO.File]::ReadAllBytes((Resolve-Path $DllPath))
$assemblyName = [Reflection.AssemblyName]::GetAssemblyName((Resolve-Path $DllPath))
$publicKeyTokenBytes = $assemblyName.GetPublicKeyToken()
$publicKeyToken = if ($publicKeyTokenBytes) { ([BitConverter]::ToString($publicKeyTokenBytes)).Replace("-", "").ToLowerInvariant() } else { "" }
$assemblyRows = @(Get-PluginAssembly)
if ($assemblyRows.Count -gt 1) { throw "Assembly Betinhos.DriverRecordSharing duplicado." }
if ($assemblyRows.Count -eq 1) {
  $assemblyId = [string]$assemblyRows[0].pluginassemblyid
  Write-Step "atualizando assembly"
  Invoke-DataverseRequest "PATCH" "pluginassemblies($assemblyId)" @{ content = [Convert]::ToBase64String($assemblyBytes) } | Out-Null
}
else {
  Write-Step "criando assembly"
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

$runAs = Get-RunAsUser
foreach ($spec in $specs) {
  $messageId = [string]$messages[$spec.Message].sdkmessageid
  $filterId = [string](Get-MessageFilter $messageId $spec.Entity).sdkmessagefilterid
  $stepRows = @(Get-Step $pluginTypeId $messageId $filterId)
  if ($stepRows.Count -gt 1) { throw "$($spec.Label): steps duplicados." }
  $payload = @{ name = "DriverRecordSharing - $($spec.Label)"; description = "Criado pelo script register-driver-record-sharing-plugin-webapi.ps1"; "eventhandler_plugintype@odata.bind" = (New-Bind "plugintypes" $pluginTypeId); "sdkmessageid@odata.bind" = (New-Bind "sdkmessages" $messageId); "sdkmessagefilterid@odata.bind" = (New-Bind "sdkmessagefilters" $filterId); stage = 40; mode = $spec.Mode; rank = 1; supporteddeployment = 0 }
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
Write-Step "REGISTRO E VALIDACAO OK"
