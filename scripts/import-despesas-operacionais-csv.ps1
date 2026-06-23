param(
  [string] $CsvPath = "",
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TenantId = "organizations",
  [string] $ClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d",
  [int] $StartAt = 1,
  [int] $MaxRows = 0,
  [int] $ThrottleEvery = 50,
  [int] $ThrottleMs = 1200,
  [switch] $SyncReferenceData,
  [switch] $SkipReferenceSync,
  [switch] $DryRun,
  [string] $ReportPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[import-despesas-csv] $Message"
}

function Text($Value) {
  if ($null -eq $Value) { return "" }
  return [string]$Value
}

function Get-RowValue($Row, [string] $ColumnName) {
  if ($null -eq $Row) { return "" }
  $property = $Row.PSObject.Properties[$ColumnName]
  if ($null -eq $property) { return "" }
  return Text $property.Value
}

function Normalize-Text([string] $Value) {
  $text = Text $Value
  if (-not $text) { return "" }
  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return (($builder.ToString().Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()) -replace "[^a-z0-9]+", " ").Trim()
}

function Escape-ODataString([string] $Value) {
  return (Text $Value).Replace("'", "''")
}

function Parse-BrlDecimal([string] $Value) {
  $text = (Text $Value).Replace("R$", "").Trim()
  if (-not $text) { return [decimal]0 }
  $text = $text -replace "\.", ""
  $text = $text.Replace(",", ".")
  return [decimal]::Parse($text, [Globalization.CultureInfo]::InvariantCulture)
}

function Parse-PositiveNumberOrNull([string] $Value) {
  $text = (Text $Value).Trim()
  if (-not $text -or $text -match "^[oO0]+$") { return $null }
  $text = $text -replace "\.", ""
  $text = $text.Replace(",", ".")
  $number = 0.0
  if (-not [double]::TryParse($text, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $null
  }
  if ($number -le 0) { return $null }
  return $number
}

function Convert-DateToDataverseIso([string] $Value) {
  $text = (Text $Value).Trim()
  $date = $null
  try {
    $date = [datetime]::ParseExact($text, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  }
  catch {
    try {
      $date = [datetime]::ParseExact($text, "dd/MM/yyyy", [Globalization.CultureInfo]::InvariantCulture)
    }
    catch {
      throw "Data invalida: $text"
    }
  }
  return ([datetime]::SpecifyKind([datetime]::new($date.Year, $date.Month, $date.Day, 12, 0, 0), [DateTimeKind]::Utc)).ToString("o")
}

function Format-DateLabel([string] $Value) {
  $date = [datetime](Convert-DateToDataverseIso $Value)
  return $date.ToString("dd/MM/yyyy")
}

function Extract-Plate([string] $Value) {
  $compact = ((Text $Value).ToUpperInvariant()) -replace "[^A-Z0-9]", ""
  $match = [regex]::Match($compact, "[A-Z]{3}[0-9][A-Z0-9][0-9]{2}")
  if ($match.Success) { return $match.Value }
  return ""
}

function Build-ImportKey([string] $DateKey, [decimal] $Value, [string] $MotoristaId, [string] $CategoriaId, [string] $FormaPagamentoId, [string] $VeiculoId, [string] $CidadeId) {
  return @(
    (Text $DateKey).Trim().ToLowerInvariant(),
    ([decimal]::Round($Value, 2)).ToString([Globalization.CultureInfo]::InvariantCulture),
    (Text $MotoristaId).Trim().ToLowerInvariant(),
    (Text $CategoriaId).Trim().ToLowerInvariant(),
    (Text $FormaPagamentoId).Trim().ToLowerInvariant(),
    (Text $VeiculoId).Trim().ToLowerInvariant(),
    (Text $CidadeId).Trim().ToLowerInvariant()
  ) -join "|"
}

function Join-NonEmptyLines([string[]] $Values) {
  return (($Values | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n").Trim()
}

function Resolve-CanonicalLabel([hashtable] $AliasMap, [string] $RawValue, [string] $Fallback = "") {
  $trimmed = (Text $RawValue).Trim()
  if (-not $trimmed) { return $Fallback }
  $normalized = Normalize-Text $trimmed
  if ($AliasMap.ContainsKey($normalized)) {
    return [string]$AliasMap[$normalized]
  }
  return $Fallback
}

function Pt([int[]] $CodePoints) {
  return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$almoco = Pt @(65,108,109,111,231,111)
$cafe = Pt @(67,97,102,233)
$locacaoCarro = Pt @(76,111,99,97,231,227,111,32,100,101,32,99,97,114,114,111)
$manutencao = Pt @(77,97,110,117,116,101,110,231,227,111)
$pedagio = Pt @(80,101,100,225,103,105,111)
$cartaoCredito = Pt @(67,97,114,116,227,111,32,100,101,32,99,114,233,100,105,116,111)
$cartao = Pt @(67,97,114,116,227,111)

$categoryConfigs = @(
  @{ name = "Abastecimento"; ordem = 10; grupo = "Frota"; exigeVeiculo = $true; exigeReserva = $false; exigeKm = $true; exigeLitros = $true; aliases = @("Abastecimento") },
  @{ name = $almoco; ordem = 20; grupo = "Equipe"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @($almoco) },
  @{ name = "Aplicativos"; ordem = 30; grupo = "Operacional"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Aplicativos") },
  @{ name = $cafe; ordem = 40; grupo = "Equipe"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @($cafe) },
  @{ name = "Estacionamento"; ordem = 50; grupo = "Operacional"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Estacionamento", "Estacionamento ") },
  @{ name = "Gastos a pedido do cliente"; ordem = 60; grupo = "Cliente"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Gastos a pedido do cliente") },
  @{ name = "Hospedagem"; ordem = 70; grupo = "Equipe"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Hospedagem") },
  @{ name = "Jantar"; ordem = 80; grupo = "Equipe"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Jantar") },
  @{ name = "Lanche"; ordem = 90; grupo = "Equipe"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Lanche") },
  @{ name = "Lavagem"; ordem = 100; grupo = "Frota"; exigeVeiculo = $true; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Lavagem") },
  @{ name = $locacaoCarro; ordem = 110; grupo = "Operacional"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @($locacaoCarro) },
  @{ name = $manutencao; ordem = 120; grupo = "Frota"; exigeVeiculo = $true; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @($manutencao) },
  @{ name = "Outros"; ordem = 130; grupo = "Outros"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @("Outros", "Outros (Escreva no item 9)", "Pindamonhangaba", "Pindamonhangaba ", "sjc") },
  @{ name = $pedagio; ordem = 140; grupo = "Operacional"; exigeVeiculo = $false; exigeReserva = $false; exigeKm = $false; exigeLitros = $false; aliases = @($pedagio, "$pedagio ") }
)

$paymentMethodConfigs = @(
  @{ name = $cartaoCredito; ordem = 10; tipo = $cartao; aliases = @($cartaoCredito) },
  @{ name = "CTF (Sem parar)"; ordem = 20; tipo = "Tag"; aliases = @("CTF (Sem parar)") },
  @{ name = "TicketLog"; ordem = 30; tipo = $cartao; aliases = @("TicketLog") },
  @{ name = "Particular (Reembolso)"; ordem = 40; tipo = "Reembolso"; aliases = @("Particular (Reembolso)") },
  @{ name = "Dinheiro (Corporativo)"; ordem = 50; tipo = "Dinheiro"; aliases = @("Dinheiro (Corporativo)") },
  @{ name = "Faturado (Plano mensal)"; ordem = 60; tipo = "Faturado"; aliases = @("Faturado (Plano mensal)") }
)


$categoryAliasMap = @{}
foreach ($config in $categoryConfigs) {
  foreach ($alias in @($config.aliases)) {
    $categoryAliasMap[(Normalize-Text $alias)] = [string]$config.name
  }
}

$paymentAliasMap = @{}
foreach ($config in $paymentMethodConfigs) {
  foreach ($alias in @($config.aliases)) {
    $paymentAliasMap[(Normalize-Text $alias)] = [string]$config.name
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $CsvPath) {
  $autoCsv = Get-ChildItem -Path (Join-Path $env:USERPROFILE "Documents") -Filter "*.csv" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "Relat*rio de despesas*" } |
    Select-Object -First 1
  if ($autoCsv) {
    $CsvPath = $autoCsv.FullName
  }
}

if (-not (Test-Path -LiteralPath $CsvPath)) {
  throw "CSV nao encontrado: $CsvPath"
}

if (-not $ReportPath) {
  $reportDir = Join-Path $root "tmp"
  if (-not (Test-Path -LiteralPath $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
  }
  $ReportPath = Join-Path $reportDir ("import-despesas-operacionais-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json")
}

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
  $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $scope -Silent
}
catch {
  $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes $scope -Interactive
}

$headers = @{
  "Authorization" = "Bearer $($tokenResult.AccessToken)"
  "Accept" = "application/json"
  "OData-MaxVersion" = "4.0"
  "OData-Version" = "4.0"
}
$jsonHeaders = $headers.Clone()
$jsonHeaders["Content-Type"] = "application/json; charset=utf-8"
$jsonHeaders["Prefer"] = "return=representation"
$apiBaseUrl = "$environmentBaseUrl/api/data/v9.2"

function Invoke-Dataverse([string] $Method, [string] $Path, $Body = $null) {
  $uri = "$apiBaseUrl$Path"
  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    $json = $Body | ConvertTo-Json -Depth 20
    $utf8Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $jsonHeaders -Body $utf8Body
  }
  catch {
    $responseText = ""
    $statusCode = ""
    if ($_.Exception.Response) {
      try { $statusCode = [string]$_.Exception.Response.StatusCode.value__ } catch {}
      try {
        $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseText = $reader.ReadToEnd()
      }
      catch {}
    }
    throw "$Method $Path falhou: status=$statusCode body=$responseText"
  }
}

function Get-AllDataverseRows([string] $Path) {
  $rows = @()
  $nextLink = "$apiBaseUrl$Path"
  while ($nextLink) {
    $page = Invoke-RestMethod -Method GET -Uri $nextLink -Headers $headers
    if ($page.value) {
      $rows += @($page.value)
    }
    $nextLink = $null
    if ($page.PSObject.Properties["@odata.nextLink"]) {
      $nextLink = Text $page.PSObject.Properties["@odata.nextLink"].Value
    }
  }
  return $rows
}

function Resolve-LookupNavigationNames() {
  $relationships = Invoke-Dataverse "GET" "/EntityDefinitions(LogicalName='cr40f_despesaoperacional')/ManyToOneRelationships?`$select=ReferencedEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName"
  $items = @($relationships.value)
  $result = @{}
  $needed = @(
    @{ key = "motorista"; referencedEntity = "cr40f_funcionarios"; referencingAttribute = "cr40f_motorista" },
    @{ key = "categoria"; referencedEntity = "cr40f_categoriadespesaoperacional"; referencingAttribute = "cr40f_categoria" },
    @{ key = "formaPagamento"; referencedEntity = "cr40f_formapagamentodespesa"; referencingAttribute = "cr40f_formapagamento" },
    @{ key = "cidade"; referencedEntity = "cr40f_cidade"; referencingAttribute = "cr40f_cidade" },
    @{ key = "veiculo"; referencedEntity = "cr40f_veiculos"; referencingAttribute = "cr40f_veiculo" }
  )
  foreach ($item in $needed) {
    $match = $items | Where-Object {
      (Normalize-Text (Text $_.ReferencedEntity)) -eq (Normalize-Text $item.referencedEntity) -and
      (Normalize-Text (Text $_.ReferencingAttribute)) -eq (Normalize-Text $item.referencingAttribute)
    } | Select-Object -First 1
    if (-not $match) {
      throw "Navigation property nao resolvida para $($item.key)."
    }
    $result[$item.key] = Text $match.ReferencingEntityNavigationPropertyName
  }
  return $result
}

function Sync-ExpenseReferenceData() {
  Write-Step "Sincronizando referencias."
  $existingCategories = @{}
  $existingCategoriesByOrder = @{}
  foreach ($item in Get-AllDataverseRows "/cr40f_categoriadespesaoperacionals?`$select=cr40f_categoriadespesaoperacionalid,cr40f_nome,cr40f_ordem&`$top=5000") {
    $existingCategories[(Normalize-Text (Text $item.cr40f_nome))] = $item
    if ($null -ne $item.cr40f_ordem -and -not $existingCategoriesByOrder.ContainsKey([int]$item.cr40f_ordem)) {
      $existingCategoriesByOrder[[int]$item.cr40f_ordem] = $item
    }
  }
  foreach ($config in $categoryConfigs) {
    $payload = @{
      cr40f_nome = [string]$config.name
      cr40f_ativa = $true
      cr40f_exigeveiculo = [bool]$config.exigeVeiculo
      cr40f_exigereserva = [bool]$config.exigeReserva
      cr40f_exigekm = [bool]$config.exigeKm
      cr40f_exigelitros = [bool]$config.exigeLitros
      cr40f_ordem = [int]$config.ordem
      cr40f_grupodre = [string]$config.grupo
    }
    $key = Normalize-Text ([string]$config.name)
    if ($existingCategories.ContainsKey($key)) {
      Invoke-Dataverse "PATCH" "/cr40f_categoriadespesaoperacionals($($existingCategories[$key].cr40f_categoriadespesaoperacionalid))" $payload | Out-Null
    } elseif ($existingCategoriesByOrder.ContainsKey([int]$config.ordem)) {
      Invoke-Dataverse "PATCH" "/cr40f_categoriadespesaoperacionals($($existingCategoriesByOrder[[int]$config.ordem].cr40f_categoriadespesaoperacionalid))" $payload | Out-Null
    } else {
      Invoke-Dataverse "POST" "/cr40f_categoriadespesaoperacionals" $payload | Out-Null
    }
  }

  $existingPayments = @{}
  $existingPaymentsByOrder = @{}
  foreach ($item in Get-AllDataverseRows "/cr40f_formapagamentodespesas?`$select=cr40f_formapagamentodespesaid,cr40f_nome,cr40f_ordem&`$top=5000") {
    $existingPayments[(Normalize-Text (Text $item.cr40f_nome))] = $item
    if ($null -ne $item.cr40f_ordem -and -not $existingPaymentsByOrder.ContainsKey([int]$item.cr40f_ordem)) {
      $existingPaymentsByOrder[[int]$item.cr40f_ordem] = $item
    }
  }
  foreach ($config in $paymentMethodConfigs) {
    $payload = @{
      cr40f_nome = [string]$config.name
      cr40f_ativa = $true
      cr40f_tipo = [string]$config.tipo
      cr40f_ordem = [int]$config.ordem
    }
    $key = Normalize-Text ([string]$config.name)
    if ($existingPayments.ContainsKey($key)) {
      Invoke-Dataverse "PATCH" "/cr40f_formapagamentodespesas($($existingPayments[$key].cr40f_formapagamentodespesaid))" $payload | Out-Null
    } elseif ($existingPaymentsByOrder.ContainsKey([int]$config.ordem)) {
      Invoke-Dataverse "PATCH" "/cr40f_formapagamentodespesas($($existingPaymentsByOrder[[int]$config.ordem].cr40f_formapagamentodespesaid))" $payload | Out-Null
    } else {
      Invoke-Dataverse "POST" "/cr40f_formapagamentodespesas" $payload | Out-Null
    }
  }
}

function Build-DriverIndexes($Drivers) {
  $index = @{
    byMicrosoftEmail = @{}
    byName = @{}
  }
  foreach ($driver in $Drivers) {
    $email = Normalize-Text (Text $driver.cr40f_emailmicrosoft)
    if ($email) { $index.byMicrosoftEmail[$email] = $driver }
    $nameKey = Normalize-Text (Text $driver.cr40f_nomecompleto)
    if ($nameKey) {
      if (-not $index.byName.ContainsKey($nameKey)) { $index.byName[$nameKey] = @() }
      $index.byName[$nameKey] += $driver
    }
  }
  return $index
}

function Resolve-Driver($Row, $DriverIndexes) {
  $email = Normalize-Text (Get-RowValue $Row "Email")
  if ($email -and $DriverIndexes.byMicrosoftEmail.ContainsKey($email)) {
    return $DriverIndexes.byMicrosoftEmail[$email]
  }
  $nameKey = Normalize-Text (Get-RowValue $Row "Nome")
  if ($nameKey -and $DriverIndexes.byName.ContainsKey($nameKey)) {
    $matches = @($DriverIndexes.byName[$nameKey])
    if ($matches.Count -eq 1) { return $matches[0] }
  }
  return $null
}

function Build-VehicleIndex($Vehicles) {
  $index = @{
    byPlate = @{}
    byComposite = @{}
  }
  foreach ($vehicle in $Vehicles) {
    $plate = Extract-Plate (Text $vehicle.cr40f_placa)
    if ($plate) { $index.byPlate[$plate] = $vehicle }
    $composite = Normalize-Text ((Text $vehicle.cr40f_modelo) + " " + (Text $vehicle.cr40f_placa))
    if ($composite) { $index.byComposite[$composite] = $vehicle }
  }
  return $index
}

function Resolve-Vehicle($Row, $VehicleIndex) {
  $rawVehicle = Get-RowValue $Row (Pt @(86,101,237,99,117,108,111))
  $plate = Extract-Plate $rawVehicle
  if ($plate -and $VehicleIndex.byPlate.ContainsKey($plate)) {
    return $VehicleIndex.byPlate[$plate]
  }
  $composite = Normalize-Text $rawVehicle
  if ($composite -and $VehicleIndex.byComposite.ContainsKey($composite)) {
    return $VehicleIndex.byComposite[$composite]
  }
  return $null
}

function Build-CityIndex($Cities) {
  $index = @{}
  foreach ($city in $Cities) {
    $keys = @(
      Normalize-Text (Text $city.cr40f_nome),
      Normalize-Text (Text $city.cr40f_name)
    ) | Where-Object { $_ }
    foreach ($key in $keys) {
      if (-not $index.ContainsKey($key)) { $index[$key] = @() }
      $index[$key] += $city
    }
  }
  return $index
}

function Resolve-City($Row, $CityIndex) {
  $key = Normalize-Text (Get-RowValue $Row "Cidade")
  if (-not $key -or -not $CityIndex.ContainsKey($key)) { return $null }
  $matches = @($CityIndex[$key])
  if ($matches.Count -eq 1) { return $matches[0] }
  $sp = $matches | Where-Object { (Text $_.cr40f_uf).Trim().ToUpperInvariant() -eq "SP" } | Select-Object -First 1
  if ($sp) { return $sp }
  return $matches[0]
}

$rows = @(Import-Csv -LiteralPath $CsvPath -Delimiter ';')
if (-not $rows.Count) {
  throw "CSV vazio: $CsvPath"
}

$selectedRows = @($rows)
if ($StartAt -gt 1) {
  $selectedRows = @($selectedRows | Select-Object -Skip ($StartAt - 1))
}
if ($MaxRows -gt 0) {
  $selectedRows = @($selectedRows | Select-Object -First $MaxRows)
}

Write-Step "CSV carregado: total=$($rows.Count) selecionado=$($selectedRows.Count)"

if ($SyncReferenceData -and -not $SkipReferenceSync) {
  Sync-ExpenseReferenceData
} else {
  Write-Step "Referencias: leitura apenas. Use -SyncReferenceData para atualizar categorias/formas."
}

$lookupNames = Resolve-LookupNavigationNames
$categories = Get-AllDataverseRows "/cr40f_categoriadespesaoperacionals?`$select=cr40f_categoriadespesaoperacionalid,cr40f_nome,cr40f_ordem&`$top=5000"
$paymentMethods = Get-AllDataverseRows "/cr40f_formapagamentodespesas?`$select=cr40f_formapagamentodespesaid,cr40f_nome,cr40f_ordem&`$top=5000"
$drivers = Get-AllDataverseRows "/cr40f_funcionarioses?`$select=cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailmicrosoft&`$top=5000"
$vehicles = Get-AllDataverseRows "/cr40f_veiculoses?`$select=cr40f_veiculosid,cr40f_placa,cr40f_modelo,cr40f_marca&`$top=5000"
$cities = Get-AllDataverseRows "/cr40f_cidades?`$select=cr40f_cidadeid,cr40f_name,cr40f_nome,cr40f_uf,cr40f_pais&`$top=5000"

$categoryByName = @{}
$categoryConfigByOrder = @{}
foreach ($config in $categoryConfigs) { $categoryConfigByOrder[[int]$config.ordem] = [string]$config.name }
foreach ($category in $categories) {
  $categoryByName[(Normalize-Text (Text $category.cr40f_nome))] = $category
  if ($null -ne $category.cr40f_ordem -and $categoryConfigByOrder.ContainsKey([int]$category.cr40f_ordem)) {
    $categoryByName[(Normalize-Text $categoryConfigByOrder[[int]$category.cr40f_ordem])] = $category
  }
}
$paymentByName = @{}
$paymentConfigByOrder = @{}
foreach ($config in $paymentMethodConfigs) { $paymentConfigByOrder[[int]$config.ordem] = [string]$config.name }
foreach ($payment in $paymentMethods) {
  $paymentByName[(Normalize-Text (Text $payment.cr40f_nome))] = $payment
  if ($null -ne $payment.cr40f_ordem -and $paymentConfigByOrder.ContainsKey([int]$payment.cr40f_ordem)) {
    $paymentByName[(Normalize-Text $paymentConfigByOrder[[int]$payment.cr40f_ordem])] = $payment
  }
}
$driverIndexes = Build-DriverIndexes $drivers
$vehicleIndex = Build-VehicleIndex $vehicles
$cityIndex = Build-CityIndex $cities

$parsedDates = @()
foreach ($row in $selectedRows) {
  try {
    $dateSource = Text $row.DATA2
    if (-not $dateSource) { $dateSource = Text $row.Data }
    $parsedDates += [datetime](Convert-DateToDataverseIso $dateSource)
  }
  catch {}
}

$existingExpenseKeys = @{}
$existingCsvIds = @{}
if ($parsedDates.Count) {
  $minDate = ($parsedDates | Sort-Object | Select-Object -First 1).ToString("yyyy-MM-ddTHH:mm:ssZ")
  $maxDate = ($parsedDates | Sort-Object | Select-Object -Last 1).ToString("yyyy-MM-ddTHH:mm:ssZ")
  $existingExpenses = Get-AllDataverseRows "/cr40f_despesaoperacionals?`$select=cr40f_datagasto,cr40f_valor,cr40f_observacao,_cr40f_motorista_value,_cr40f_categoria_value,_cr40f_formapagamento_value,_cr40f_veiculo_value,_cr40f_cidade_value&`$filter=cr40f_datagasto ge $minDate and cr40f_datagasto le $maxDate&`$top=5000"
  foreach ($expense in $existingExpenses) {
    $datePart = ""
    try { $datePart = ([datetime]$expense.cr40f_datagasto).ToString("yyyy-MM-dd") } catch {}
    $key = Build-ImportKey $datePart ([decimal]($expense.cr40f_valor)) (Text $expense._cr40f_motorista_value) (Text $expense._cr40f_categoria_value) (Text $expense._cr40f_formapagamento_value) (Text $expense._cr40f_veiculo_value) (Text $expense._cr40f_cidade_value)
    $existingExpenseKeys[$key] = $true
    $csvIdMatch = [regex]::Match((Text $expense.cr40f_observacao), "(?m)^ID CSV:\s*(.+?)\s*$")
    if ($csvIdMatch.Success) {
      $existingCsvIds[$csvIdMatch.Groups[1].Value.Trim()] = $true
    }
  }
}

$report = [ordered]@{
  csvPath = $CsvPath
  environmentUrl = $EnvironmentUrl
  dryRun = [bool]$DryRun
  startedAt = (Get-Date).ToString("o")
  selectedRowCount = $selectedRows.Count
  created = @()
  skipped = @()
  failed = @()
}

$createdCount = 0
$skippedCount = 0
$failedCount = 0
$processedCount = 0

foreach ($row in $selectedRows) {
  $processedCount += 1
  $csvId = (Get-RowValue $row "ID").Trim()
  try {
    $rawCategoryValue = Get-RowValue $row "Tipo do gasto"
    $rawPaymentValue = Get-RowValue $row "Pago com"
    $rawObservationValue = Get-RowValue $row (Pt @(79,98,115,101,114,118,97,231,227,111,32,101,109,32,103,101,114,97,108))
    $rawHospedagemValue = Get-RowValue $row "Em caso de hospedagem, envie a nota fiscal."
    $rawVehicleValue = Get-RowValue $row (Pt @(86,101,237,99,117,108,111))
    $rawNomeValue = Get-RowValue $row "Nome"
    $rawEmailValue = Get-RowValue $row "Email"
    $rawCidadeValue = Get-RowValue $row "Cidade"
    $rawKmValue = Get-RowValue $row "Km atual"
    $rawLitrosValue = Get-RowValue $row "Litros (Lts)"
    $canonicalCategory = Resolve-CanonicalLabel $categoryAliasMap $rawCategoryValue "Outros"
    $canonicalPayment = Resolve-CanonicalLabel $paymentAliasMap $rawPaymentValue
    if (-not $canonicalPayment) {
      throw "Forma de pagamento nao mapeada: $rawPaymentValue"
    }

    $categoryRecord = $categoryByName[(Normalize-Text $canonicalCategory)]
    $paymentRecord = $paymentByName[(Normalize-Text $canonicalPayment)]
    if (-not $categoryRecord) { throw "Categoria nao encontrada no Dataverse: $canonicalCategory" }
    if (-not $paymentRecord) { throw "Forma de pagamento nao encontrada no Dataverse: $canonicalPayment" }

    $driver = Resolve-Driver $row $driverIndexes
    if (-not $driver) { throw "Motorista nao resolvido por Email Microsoft ou Nome." }

    $vehicle = Resolve-Vehicle $row $vehicleIndex
    $city = Resolve-City $row $cityIndex
    $dateSource = Get-RowValue $row "DATA2"
    if (-not $dateSource) { $dateSource = Get-RowValue $row "Data" }
    $dateIso = Convert-DateToDataverseIso $dateSource
    $dateKey = ([datetime]$dateIso).ToString("yyyy-MM-dd")
    $dateLabel = Format-DateLabel $dateSource
    $value = Parse-BrlDecimal (Get-RowValue $row "VALOR AJUSTADO ")
    $km = Parse-PositiveNumberOrNull $rawKmValue
    $liters = Parse-PositiveNumberOrNull $rawLitrosValue

    if ($csvId -and $existingCsvIds.ContainsKey($csvId)) {
      $skippedCount += 1
      $report.skipped += [ordered]@{ row = $processedCount; csvId = $csvId; reason = "ID CSV ja importado." }
      continue
    }

    $vehicleId = ""
    if ($vehicle) { $vehicleId = Text $vehicle.cr40f_veiculosid }
    $cityId = ""
    if ($city) { $cityId = Text $city.cr40f_cidadeid }

    $importKey = Build-ImportKey $dateKey $value (Text $driver.cr40f_funcionariosid) (Text $categoryRecord.cr40f_categoriadespesaoperacionalid) (Text $paymentRecord.cr40f_formapagamentodespesaid) $vehicleId $cityId
    if ($existingExpenseKeys.ContainsKey($importKey)) {
      $skippedCount += 1
      $report.skipped += [ordered]@{ row = $processedCount; csvId = $csvId; reason = "Chave de importacao ja existente." }
      continue
    }

    $rawCategory = $rawCategoryValue.Trim()
    $rawPayment = $rawPaymentValue.Trim()
    $observation = Join-NonEmptyLines @(
      "Importado de Relatorio de despesas CSV.",
      $(if ($csvId) { "ID CSV: $csvId" }),
      "Motorista CSV: $rawNomeValue <$rawEmailValue>",
      "Cidade CSV: $($rawCidadeValue.Trim())",
      $(if ($rawCategory -and $rawCategory -ne $canonicalCategory) { "Tipo original CSV: $rawCategory" }),
      $(if ($rawPayment -and $rawPayment -ne $canonicalPayment) { "Pagamento original CSV: $rawPayment" }),
      $(if (-not [string]::IsNullOrWhiteSpace($rawObservationValue)) { "Observacao CSV: $($rawObservationValue.Trim())" }),
      $(if (-not [string]::IsNullOrWhiteSpace($rawHospedagemValue)) { "Hospedagem/NF CSV: $($rawHospedagemValue.Trim())" }),
      $(if ($vehicle) { "Veiculo CSV: $($rawVehicleValue.Trim())" }),
      "Forma de pagamento: $canonicalPayment",
      "Categoria: $canonicalCategory"
    )

    $payload = [ordered]@{
      cr40f_nome = "$canonicalCategory - $dateLabel - CSV $csvId"
      cr40f_datagasto = $dateIso
      cr40f_valor = $value
      cr40f_statusoperacional = 100000002
      cr40f_statusfinanceiro = $(if ($canonicalPayment -eq "Particular (Reembolso)") { 100000001 } else { 100000000 })
      cr40f_statusanexo = 100000000
      cr40f_origem = 100000003
      cr40f_observacao = $observation
    }
    $payload["$($lookupNames.motorista)@odata.bind"] = "/cr40f_funcionarioses($(Text $driver.cr40f_funcionariosid))"
    $payload["$($lookupNames.categoria)@odata.bind"] = "/cr40f_categoriadespesaoperacionals($(Text $categoryRecord.cr40f_categoriadespesaoperacionalid))"
    $payload["$($lookupNames.formaPagamento)@odata.bind"] = "/cr40f_formapagamentodespesas($(Text $paymentRecord.cr40f_formapagamentodespesaid))"

    if ($cityId) {
      $payload["$($lookupNames.cidade)@odata.bind"] = "/cr40f_cidades($cityId)"
    }
    if ($vehicleId) {
      $payload["$($lookupNames.veiculo)@odata.bind"] = "/cr40f_veiculoses($vehicleId)"
    }
    if ($null -ne $km) {
      $payload.cr40f_kminformado = [int][math]::Truncate([double]$km)
    }
    if ($null -ne $liters) {
      $payload.cr40f_litros = [math]::Round([decimal]$liters, 2)
    }

    if ($DryRun) {
      $report.created += [ordered]@{ row = $processedCount; csvId = $csvId; dryRun = $true; nome = $payload.cr40f_nome }
    } else {
      $created = Invoke-Dataverse "POST" "/cr40f_despesaoperacionals" $payload
      $report.created += [ordered]@{ row = $processedCount; csvId = $csvId; id = (Text $created.cr40f_despesaoperacionalid); nome = $payload.cr40f_nome }
      $existingExpenseKeys[$importKey] = $true
      if ($csvId) { $existingCsvIds[$csvId] = $true }
    }

    $createdCount += 1
    if (($processedCount % 25) -eq 0) {
      Write-Step "Progresso: processados=$processedCount criados=$createdCount pulados=$skippedCount falhados=$failedCount"
    }
    if (-not $DryRun -and $ThrottleEvery -gt 0 -and ($createdCount % $ThrottleEvery) -eq 0) {
      Start-Sleep -Milliseconds $ThrottleMs
    }
  }
  catch {
    $failedCount += 1
    $report.failed += [ordered]@{
      row = $processedCount
      csvId = $csvId
      nome = Get-RowValue $row "Nome"
      tipo = Get-RowValue $row "Tipo do gasto"
      pagamento = Get-RowValue $row "Pago com"
      error = $_.Exception.Message
    }
  }
}

$report.finishedAt = (Get-Date).ToString("o")
$report.summary = [ordered]@{
  created = $createdCount
  skipped = $skippedCount
  failed = $failedCount
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Step "Concluido. criados=$createdCount pulados=$skippedCount falhados=$failedCount"
Write-Step "Relatorio: $ReportPath"
