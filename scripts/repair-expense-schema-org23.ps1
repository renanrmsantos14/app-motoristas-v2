param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[repair-expense-schema] $Message"
}

function Escape-ODataString([string] $Value) {
  return $Value.Replace("'", "''")
}

function Label([string] $Text) {
  return @{
    LocalizedLabels = @(
      @{
        Label = $Text
        LanguageCode = 1046
      }
    )
  }
}

function RequiredLevel([bool] $Required) {
  return @{
    Value = $(if ($Required) { "ApplicationRequired" } else { "None" })
  }
}

function Option([int] $Value, [string] $Text) {
  return @{
    Value = $Value
    Label = Label $Text
  }
}

function New-AttributePayload([hashtable] $Config) {
  $isRequired = $Config.ContainsKey("required") -and $Config.required -eq $true
  $base = @{
    SchemaName = $Config.schema
    DisplayName = Label $Config.label
    RequiredLevel = RequiredLevel ([bool]$isRequired)
  }

  switch ($Config.type) {
    "string" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "Text" }
      }
    }
    "memo" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
        MaxLength = $Config.maxLength
        FormatName = @{ Value = "TextArea" }
      }
    }
    "integer" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        MinValue = $Config.min
        MaxValue = $Config.max
      }
    }
    "money" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MoneyAttributeMetadata"
        Precision = 2
        MinValue = 0
        MaxValue = 100000000000
      }
    }
    "decimal" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.DecimalAttributeMetadata"
        Precision = $Config.precision
        MinValue = $Config.min
        MaxValue = $Config.max
      }
    }
    "boolean" {
      $defaultValue = $Config.ContainsKey("defaultValue") -and $Config.defaultValue -eq $true
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        DefaultValue = ([bool]$defaultValue)
        OptionSet = @{
          TrueOption = Option 1 "Sim"
          FalseOption = Option 0 "Não"
        }
      }
    }
    "datetime" {
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
        Format = "DateAndTime"
        DateTimeBehavior = @{ Value = "UserLocal" }
      }
    }
    "picklist" {
      $options = @()
      foreach ($item in $Config.options) {
        $options += Option ([int]$item[0]) ([string]$item[1])
      }
      return $base + @{
        "@odata.type" = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        OptionSet = @{
          IsGlobal = $false
          OptionSetType = "Picklist"
          Options = $options
        }
      }
    }
    default {
      throw "Tipo de campo nao suportado: $($Config.type)"
    }
  }
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

try {
  $tokenResult = Get-MsalToken `
    -PublicClientApplication $clientApplication `
    -Scopes $scope `
    -Silent
}
catch {
  $tokenResult = Get-MsalToken `
    -PublicClientApplication $clientApplication `
    -Scopes $scope `
    -Interactive
}

$headers = @{
  "Authorization" = "Bearer $($tokenResult.AccessToken)"
  "Accept" = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}
$jsonHeaders = $headers + @{
  "Content-Type" = "application/json; charset=utf-8"
}
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $Path, $Body = $null, [bool] $AllowNotFound = $false) {
  $uri = "$apiBaseUrl$Path"
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    $json = $Body | ConvertTo-Json -Depth 20
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
    if ($AllowNotFound -and ($responseText -match "Could not find|not found|0x80040217")) {
      return $null
    }
    if ($AllowNotFound -and ($_.Exception.Response.StatusCode.value__ -in @(400, 404))) {
      return $null
    }
    $statusCode = ""
    $statusDescription = ""
    try {
      $statusCode = [string]$_.Exception.Response.StatusCode.value__
      $statusDescription = [string]$_.Exception.Response.StatusDescription
    }
    catch {}
    $errorDetails = ""
    try {
      $errorDetails = [string]$_.ErrorDetails.Message
    }
    catch {}
    throw "$Method $Path falhou: status=$statusCode $statusDescription body=$responseText details=$errorDetails"
  }
}

function Test-Attribute([string] $Table, [string] $LogicalName) {
  $escapedTable = Escape-ODataString $Table
  $escapedAttr = Escape-ODataString $LogicalName
  $result = Invoke-Dataverse "GET" "/EntityDefinitions(LogicalName='$escapedTable')/Attributes(LogicalName='$escapedAttr')?`$select=LogicalName" $null $true
  return $null -ne $result
}

$attributes = @(
  @{ table = "cr40f_despesaoperacional"; type = "datetime"; schema = "cr40f_DataGasto"; logical = "cr40f_datagasto"; label = "Data do gasto"; required = $true },
  @{ table = "cr40f_despesaoperacional"; type = "money"; schema = "cr40f_Valor"; logical = "cr40f_valor"; label = "Valor"; required = $true },
  @{ table = "cr40f_despesaoperacional"; type = "integer"; schema = "cr40f_KMInformado"; logical = "cr40f_kminformado"; label = "KM informado"; min = 0; max = 2000000 },
  @{ table = "cr40f_despesaoperacional"; type = "decimal"; schema = "cr40f_Litros"; logical = "cr40f_litros"; label = "Litros"; min = 0; max = 100000; precision = 2 },
  @{ table = "cr40f_despesaoperacional"; type = "string"; schema = "cr40f_Estabelecimento"; logical = "cr40f_estabelecimento"; label = "Estabelecimento"; maxLength = 200 },
  @{ table = "cr40f_despesaoperacional"; type = "memo"; schema = "cr40f_Observacao"; logical = "cr40f_observacao"; label = "Observação do motorista"; maxLength = 4000 },
  @{ table = "cr40f_despesaoperacional"; type = "picklist"; schema = "cr40f_StatusOperacional"; logical = "cr40f_statusoperacional"; label = "Status operacional"; required = $true; options = @(@(100000000, "Enviado"), @(100000001, "Precisa corrigir"), @(100000002, "Validado"), @(100000003, "Recusado"), @(100000004, "Cancelado")) },
  @{ table = "cr40f_despesaoperacional"; type = "picklist"; schema = "cr40f_StatusFinanceiro"; logical = "cr40f_statusfinanceiro"; label = "Status financeiro"; required = $true; options = @(@(100000000, "Não reembolsável"), @(100000001, "Aguardando pagamento"), @(100000002, "Pago"), @(100000003, "Cancelado")) },
  @{ table = "cr40f_despesaoperacional"; type = "picklist"; schema = "cr40f_StatusAnexo"; logical = "cr40f_statusanexo"; label = "Status dos anexos"; options = @(@(100000000, "Sem anexo"), @(100000001, "Enviando"), @(100000002, "Completo"), @(100000003, "Falhou"), @(100000004, "Parcial")) },
  @{ table = "cr40f_despesaoperacional"; type = "picklist"; schema = "cr40f_Origem"; logical = "cr40f_origem"; label = "Origem"; required = $true; options = @(@(100000000, "App Motoristas"), @(100000001, "Model-driven"), @(100000002, "Flow"), @(100000003, "Importação")) },
  @{ table = "cr40f_categoriadespesaoperacional"; type = "boolean"; schema = "cr40f_ExigeLitros"; logical = "cr40f_exigelitros"; label = "Exige litros" },
  @{ table = "cr40f_anexodespesaoperacional"; type = "string"; schema = "cr40f_NomeArquivo"; logical = "cr40f_nomearquivo"; label = "Nome do arquivo"; maxLength = 255; required = $true },
  @{ table = "cr40f_anexodespesaoperacional"; type = "string"; schema = "cr40f_UrlSharePoint"; logical = "cr40f_urlsharepoint"; label = "URL SharePoint/OneDrive"; maxLength = 1000; required = $true },
  @{ table = "cr40f_anexodespesaoperacional"; type = "string"; schema = "cr40f_ShareLink"; logical = "cr40f_sharelink"; label = "Share link"; maxLength = 1000 },
  @{ table = "cr40f_anexodespesaoperacional"; type = "integer"; schema = "cr40f_Ordem"; logical = "cr40f_ordem"; label = "Ordem"; min = 0; max = 9999 },
  @{ table = "cr40f_anexodespesaoperacional"; type = "datetime"; schema = "cr40f_DataEnvio"; logical = "cr40f_dataenvio"; label = "Data de envio" },
  @{ table = "cr40f_anexodespesaoperacional"; type = "picklist"; schema = "cr40f_Status"; logical = "cr40f_status"; label = "Status"; required = $true; options = @(@(100000000, "Pendente"), @(100000001, "Enviado"), @(100000002, "Falhou"), @(100000003, "Inválido")) },
  @{ table = "cr40f_anexodespesaoperacional"; type = "picklist"; schema = "cr40f_Tipo"; logical = "cr40f_tipo"; label = "Tipo"; required = $true; options = @(@(100000000, "Comprovante"), @(100000001, "Foto complementar"), @(100000002, "Outros")) }
)

$attributesToDelete = @(
  @{ table = "cr40f_categoriadespesaoperacional"; logical = "cr40f_exigecomprovante" },
  @{ table = "cr40f_categoriadespesaoperacional"; logical = "cr40f_exigeobservacao" },
  @{ table = "cr40f_categoriadespesaoperacional"; logical = "cr40f_reembolsavelpadrao" },
  @{ table = "cr40f_formapagamentodespesa"; logical = "cr40f_exigecomprovante" },
  @{ table = "cr40f_formapagamentodespesa"; logical = "cr40f_reembolsavelpadrao" },
  @{ table = "cr40f_despesaoperacional"; logical = "cr40f_reembolsavel" }
)

$created = @()
foreach ($config in $attributes) {
  if (Test-Attribute $config.table $config.logical) {
    Write-Step "OK campo: $($config.table).$($config.logical)"
    continue
  }
  Write-Step "Criando campo: $($config.table).$($config.logical)"
  Invoke-Dataverse "POST" "/EntityDefinitions(LogicalName='$($config.table)')/Attributes" (New-AttributePayload $config) | Out-Null
  $created += "$($config.table).$($config.logical)"
}

$deleted = @()
foreach ($item in $attributesToDelete) {
  if (-not (Test-Attribute $item.table $item.logical)) {
    Write-Step "OK campo removido/ausente: $($item.table).$($item.logical)"
    continue
  }
  Write-Step "Apagando campo: $($item.table).$($item.logical)"
  Invoke-Dataverse "DELETE" "/EntityDefinitions(LogicalName='$($item.table)')/Attributes(LogicalName='$($item.logical)')" | Out-Null
  $deleted += "$($item.table).$($item.logical)"
}

Write-Step "Atualizando categorias: combustivel exige litros; demais nao"
$categoryResult = Invoke-Dataverse "GET" "/cr40f_categoriadespesaoperacionals?`$select=cr40f_categoriadespesaoperacionalid,cr40f_nome,cr40f_exigelitros&`$top=500"
$updatedCategories = @()
foreach ($category in @($categoryResult.value)) {
  $name = [string]$category.cr40f_nome
  $normalizedName = $name.ToLowerInvariant() -replace "[áàâãä]", "a" -replace "[éèêë]", "e" -replace "[íìîï]", "i" -replace "[óòôõö]", "o" -replace "[úùûü]", "u" -replace "ç", "c"
  $requiresLiters = $normalizedName -like "*combust*"
  if ([bool]$category.cr40f_exigelitros -eq $requiresLiters) {
    continue
  }
  Invoke-Dataverse "PATCH" "/cr40f_categoriadespesaoperacionals($($category.cr40f_categoriadespesaoperacionalid))" @{ cr40f_exigelitros = $requiresLiters } | Out-Null
  $updatedCategories += "$name=$requiresLiters"
}

if ($created.Count -gt 0 -or $deleted.Count -gt 0) {
  Write-Step "PublishAllXml"
  Invoke-Dataverse "POST" "/PublishAllXml" @{} | Out-Null
  Start-Sleep -Seconds 20
}

Write-Step "Verificando selects finais"
Invoke-Dataverse "GET" "/cr40f_despesaoperacionals?`$select=cr40f_nome,cr40f_datagasto,cr40f_valor,cr40f_statusoperacional,cr40f_statusfinanceiro,cr40f_statusanexo,cr40f_origem,cr40f_observacao,cr40f_estabelecimento,cr40f_kminformado,cr40f_litros&`$top=1" | Out-Null
Invoke-Dataverse "GET" "/cr40f_anexodespesaoperacionals?`$select=cr40f_nome,cr40f_nomearquivo,cr40f_urlsharepoint,cr40f_sharelink,cr40f_dataenvio,cr40f_ordem,cr40f_status,cr40f_tipo&`$top=1" | Out-Null
Invoke-Dataverse "GET" "/cr40f_categoriadespesaoperacionals?`$select=cr40f_nome,cr40f_ativa,cr40f_exigeveiculo,cr40f_exigereserva,cr40f_exigekm,cr40f_exigelitros,cr40f_ordem&`$top=1" | Out-Null
Invoke-Dataverse "GET" "/cr40f_formapagamentodespesas?`$select=cr40f_nome,cr40f_ativa,cr40f_tipo,cr40f_ordem&`$top=1" | Out-Null

Write-Step "Concluido. Criados: $($created -join ', ')"
Write-Step "Concluido. Apagados: $($deleted -join ', ')"
Write-Step "Concluido. Categorias atualizadas: $($updatedCategories -join ', ')"
