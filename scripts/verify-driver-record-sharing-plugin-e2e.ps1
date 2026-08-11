param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [Parameter(Mandatory = $true)]
  [string] $ExchangeBusinessId,
  [string] $TechnicalUserEmail = "noreply@betinhos.onmicrosoft.com",
  [switch] $DeviceCode,
  [switch] $GenerateOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[driver-sharing-plugin-e2e] $Message"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$structuralValidator = Join-Path $PSScriptRoot "validate-driver-record-sharing-plugin.ps1"
$workDir = Join-Path $root "scripts\.driver-record-sharing-runners\e2e"
$projectFile = Join-Path $workDir "VerifyDriverRecordSharingPluginE2E.csproj"
$programFile = Join-Path $workDir "Program.cs"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$csproj = @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <UseAppHost>false</UseAppHost>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.PowerPlatform.Dataverse.Client" Version="1.2.10" />
    <PackageReference Include="System.ServiceModel.Primitives" Version="8.1.2" />
  </ItemGroup>
</Project>
'@

$program = @'
using Microsoft.Crm.Sdk.Messages;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using System.ServiceModel;

const string ExchangeTable = "cr40f_trocasdecarro";
const string ExchangeIdField = "cr40f_trocasdecarroid";
const string ExchangeBusinessIdField = "cr40f_id";
const string ExchangeStatus = "cr40f_statusdatroca";
const string ExchangeType = "new_tipodetroca";
const string ExchangeDriver = "cr40f_motorista1";
const string ExchangeVehicle = "cr40f_veiculo1antesdatroca";
const string ExchangeDriverCompleted = "new_concluidomotorista1";
const int StatusProgrammed = 202410000;
const int StatusConfirmed = 100000001;
const int TypeReturnToBase = 100000001;
const string PossessionTable = "new_possedeveiculo";
const string PossessionDriver = "new_motorista";
const string PossessionVehicle = "new_veiculo";
const string PossessionEndedAt = "new_fimdaposse";
const string CompletionTrace = "ExchangePossessionFinalizer completed";

var environmentUrl = args.ElementAtOrDefault(0) ?? throw new ArgumentException("EnvironmentUrl ausente.");
var businessId = args.ElementAtOrDefault(1)?.Trim() ?? throw new ArgumentException("ExchangeBusinessId ausente.");
using var service = CreateServiceClient(environmentUrl);
if (!service.IsReady) throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");

Log($"ambiente={environmentUrl} troca={businessId}");
var exchange = FindExchange(service, businessId);
var statusBefore = exchange.GetAttributeValue<OptionSetValue>(ExchangeStatus)?.Value;
var type = exchange.GetAttributeValue<OptionSetValue>(ExchangeType)?.Value;
var completedBefore = exchange.GetAttributeValue<bool?>(ExchangeDriverCompleted) == true;
var driver = RequireReference(exchange, ExchangeDriver);
var vehicle = RequireReference(exchange, ExchangeVehicle);

Require(type == TypeReturnToBase, $"A troca deve ser Devolucao a base ({TypeReturnToBase}); atual={type}.");
Require(statusBefore is StatusProgrammed or StatusConfirmed, $"A troca deve estar Programada/Confirmada; status atual={statusBefore}.");
Require(!completedBefore, "O motorista 1 ja esta marcado como concluido; teste recusado.");

var openPossessionsBefore = FindOpenPossessions(service, driver.Id);
Require(openPossessionsBefore.Count == 1, $"Esperada exatamente 1 posse aberta do motorista; atual={openPossessionsBefore.Count}.");
var possessionVehicle = RequireReference(openPossessionsBefore[0], PossessionVehicle);
Require(possessionVehicle.Id == vehicle.Id, $"Veiculo da posse {possessionVehicle.Id} diverge da devolucao {vehicle.Id}.");
var possessionId = openPossessionsBefore[0].Id;
Ok($"Pre-condicoes: troca={exchange.Id} motorista={driver.Id} veiculo={vehicle.Id} posse={possessionId}");

var organization = service.RetrieveMultiple(new QueryExpression("organization")
{
  ColumnSet = new ColumnSet("organizationid", "plugintracelogsetting"),
  TopCount = 1
}).Entities.Single();
var originalTraceSetting = organization.GetAttributeValue<OptionSetValue>("plugintracelogsetting")?.Value ?? 0;
var startedAt = DateTime.UtcNow.AddSeconds(-2);

try
{
  if (originalTraceSetting != 2)
  {
    var tracePatch = new Entity("organization", organization.Id);
    tracePatch["plugintracelogsetting"] = new OptionSetValue(2);
    service.Update(tracePatch);
    Ok($"Plugin Trace temporariamente em All; valor anterior={originalTraceSetting}");
  }

  var requests = new OrganizationRequestCollection
  {
    new UpdateRequest
    {
      Target = new Entity(ExchangeTable, exchange.Id)
      {
        [ExchangeDriverCompleted] = true
      }
    },
    new UpdateRequest
    {
      Target = new Entity(ExchangeTable, Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"))
      {
        [ExchangeDriverCompleted] = true
      }
    }
  };

  try
  {
    service.Execute(new ExecuteTransactionRequest
    {
      Requests = requests,
      ReturnResponses = true
    });
    throw new InvalidOperationException("A sentinela de rollback nao falhou. Resultado inseguro.");
  }
  catch (FaultException<OrganizationServiceFault> ex)
  {
    var requestIndex = ReadRequestIndex(ex.Detail);
    Require(requestIndex == 1,
      $"A transacao falhou na operacao {requestIndex}, mas deveria falhar somente na sentinela 1. Plugin nao comprovado. Erro: {ex.Detail.Message}");
    Ok("Plugin concluiu a operacao 0; sentinela falhou na operacao 1 e acionou rollback atomico");
  }

  var exchangeAfter = service.Retrieve(ExchangeTable, exchange.Id, new ColumnSet(ExchangeStatus, ExchangeDriverCompleted));
  Require(exchangeAfter.GetAttributeValue<OptionSetValue>(ExchangeStatus)?.Value == statusBefore, "Rollback falhou: status da troca foi alterado.");
  Require((exchangeAfter.GetAttributeValue<bool?>(ExchangeDriverCompleted) == true) == completedBefore, "Rollback falhou: confirmacao do motorista foi alterada.");

  var openPossessionsAfter = FindOpenPossessions(service, driver.Id);
  Require(openPossessionsAfter.Count == 1 && openPossessionsAfter[0].Id == possessionId, "Rollback falhou: posse aberta original nao foi restaurada.");
  Ok("Rollback confirmado: troca e posse permaneceram exatamente no estado anterior");

  var trace = WaitForCompletionTrace(service, exchange.Id, startedAt);
  Require(trace != null, $"Rastro de conclusao nao encontrado para exchangeId={exchange.Id}.");
  Require(trace!.GetAttributeValue<string>("messageblock")?.Contains($"exchangeId={exchange.Id}", StringComparison.OrdinalIgnoreCase) == true,
    "Rastro encontrado nao identifica a troca esperada.");
  Ok($"Rastro funcional comprovado plugintracelogid={trace.Id}");
  Console.WriteLine("[driver-sharing-plugin-e2e] VALIDACAO FUNCIONAL OK");
}
finally
{
  if (originalTraceSetting != 2)
  {
    var restore = new Entity("organization", organization.Id);
    restore["plugintracelogsetting"] = new OptionSetValue(originalTraceSetting);
    service.Update(restore);
    Ok($"Plugin Trace restaurado para {originalTraceSetting}");
  }
}

static int ReadRequestIndex(OrganizationServiceFault fault)
{
  if (fault.ErrorDetails.TryGetValue("RequestIndex", out var value) && value != null)
    return Convert.ToInt32(value);
  var details = string.Join(
    Environment.NewLine,
    fault.ErrorDetails.Select(pair => $"{pair.Key}={pair.Value}"));
  throw new InvalidOperationException(
    $"A operacao 0 falhou antes da sentinela. Causa do plugin:{Environment.NewLine}{details}{Environment.NewLine}Erro: {fault.Message}");
}

static Entity FindExchange(ServiceClient service, string businessId)
{
  var query = new QueryExpression(ExchangeTable)
  {
    ColumnSet = new ColumnSet(ExchangeIdField, ExchangeBusinessIdField, ExchangeStatus, ExchangeType, ExchangeDriver, ExchangeVehicle, ExchangeDriverCompleted),
    TopCount = 2
  };
  query.Criteria.AddCondition(ExchangeBusinessIdField, ConditionOperator.Equal, businessId);
  var rows = service.RetrieveMultiple(query).Entities;
  Require(rows.Count == 1, $"Troca '{businessId}': esperado 1 registro, encontrado {rows.Count}.");
  return rows[0];
}

static List<Entity> FindOpenPossessions(ServiceClient service, Guid driverId)
{
  var query = new QueryExpression(PossessionTable)
  {
    ColumnSet = new ColumnSet(PossessionDriver, PossessionVehicle, PossessionEndedAt),
    TopCount = 2
  };
  query.Criteria.AddCondition(PossessionDriver, ConditionOperator.Equal, driverId);
  query.Criteria.AddCondition(PossessionEndedAt, ConditionOperator.Null);
  return service.RetrieveMultiple(query).Entities.ToList();
}

static Entity? WaitForCompletionTrace(ServiceClient service, Guid exchangeId, DateTime startedAt)
{
  for (var attempt = 1; attempt <= 10; attempt++)
  {
    var query = new QueryExpression("plugintracelog")
    {
      ColumnSet = new ColumnSet("plugintracelogid", "messageblock", "createdon", "typename"),
      TopCount = 20
    };
    query.Criteria.AddCondition("createdon", ConditionOperator.OnOrAfter, startedAt);
    query.Criteria.AddCondition("typename", ConditionOperator.Equal, "Betinhos.DriverRecordSharing.ServiceDriverSharePlugin");
    query.Orders.Add(new OrderExpression("createdon", OrderType.Descending));
    var trace = service.RetrieveMultiple(query).Entities.FirstOrDefault(row =>
    {
      var message = row.GetAttributeValue<string>("messageblock") ?? "";
      return message.Contains(CompletionTrace, StringComparison.Ordinal) &&
        message.Contains($"exchangeId={exchangeId}", StringComparison.OrdinalIgnoreCase);
    });
    if (trace != null) return trace;
    Thread.Sleep(1500);
  }
  return null;
}

static EntityReference RequireReference(Entity entity, string attribute)
{
  var reference = entity.GetAttributeValue<EntityReference>(attribute);
  if (reference == null || reference.Id == Guid.Empty) throw new InvalidOperationException($"Lookup obrigatorio ausente: {attribute}.");
  return reference;
}

static void Require(bool condition, string message)
{
  if (!condition) throw new InvalidOperationException(message);
}

static void Log(string message) => Console.WriteLine($"[driver-sharing-plugin-e2e] {message}");
static void Ok(string message) => Console.WriteLine($"[OK] {message}");

static ServiceClient CreateServiceClient(string environmentUrl)
{
  var accessToken = Environment.GetEnvironmentVariable("DRIVER_RECORD_SHARING_ACCESS_TOKEN");
  if (!string.IsNullOrWhiteSpace(accessToken))
    return new ServiceClient(new Uri(environmentUrl.TrimEnd('/')), _ => Task.FromResult(accessToken), true);

  var connectionString = $"AuthType=OAuth;Url={environmentUrl.TrimEnd('/')};AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;RedirectUri=http://localhost;LoginPrompt=Auto";
  return new ServiceClient(connectionString);
}
'@

Set-Content -LiteralPath $projectFile -Value $csproj -Encoding UTF8
Set-Content -LiteralPath $programFile -Value $program -Encoding UTF8

if ($GenerateOnly) {
  Write-Step "runner gerado em $workDir"
  return
}

Write-Step "validacao estrutural antes do smoke test"
$validatorArgs = @{
  EnvironmentUrl = $EnvironmentUrl
  TechnicalUserEmail = $TechnicalUserEmail
  SkipBuild = $true
}
if ($DeviceCode) { $validatorArgs.DeviceCode = $true }
& $structuralValidator @validatorArgs
if ($LASTEXITCODE -ne 0) { throw "Validacao estrutural falhou; smoke test cancelado." }

if ($DeviceCode) {
  if (-not (Get-Module -ListAvailable MSAL.PS)) {
    throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
  }
  Import-Module MSAL.PS -ErrorAction Stop
  Write-Step "auth DeviceCode"
  $environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
  $clientApplication = New-MsalClientApplication `
    -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" `
    -TenantId "organizations" `
    -RedirectUri ([Uri] "http://localhost")
  Enable-MsalTokenCacheOnDisk -PublicClientApplication $clientApplication
  try {
    $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes "$environmentBaseUrl/user_impersonation" -Silent
  }
  catch {
    $tokenResult = Get-MsalToken -PublicClientApplication $clientApplication -Scopes "$environmentBaseUrl/user_impersonation" -DeviceCode
  }
  if ([string]::IsNullOrWhiteSpace($tokenResult.AccessToken)) { throw "Falha ao obter token MSAL." }
  $env:DRIVER_RECORD_SHARING_ACCESS_TOKEN = $tokenResult.AccessToken
}

try {
  Write-Step "build runner"
  dotnet build $projectFile
  if ($LASTEXITCODE -ne 0) { throw "Build do runner E2E falhou." }
  $runnerDll = Join-Path $workDir "bin\Debug\net8.0\VerifyDriverRecordSharingPluginE2E.dll"
  Write-Step "executando smoke test transacional com rollback"
  dotnet $runnerDll $EnvironmentUrl $ExchangeBusinessId
  if ($LASTEXITCODE -ne 0) { throw "Validacao funcional E2E falhou." }
}
finally {
  if ($DeviceCode) { Remove-Item Env:\DRIVER_RECORD_SHARING_ACCESS_TOKEN -ErrorAction SilentlyContinue }
}
