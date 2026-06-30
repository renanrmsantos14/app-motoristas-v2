param(
  [string] $EnvironmentUrl = "https://orgf261ae8e.crm2.dynamics.com/",

  [string] $TechnicalUserEmail = "",

  [switch] $GenerateOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[driver-sharing-plugin-validate] $Message"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workDir = Join-Path $root ".tmp\validate-driver-record-sharing-plugin"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$projectFile = Join-Path $workDir "ValidateDriverRecordSharingPlugin.csproj"
$programFile = Join-Path $workDir "Program.cs"

$csproj = @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.PowerPlatform.Dataverse.Client" Version="1.2.10" />
  </ItemGroup>
</Project>
'@

$program = @'
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

const string AssemblyName = "Betinhos.DriverRecordSharing";
const string PluginTypeName = "Betinhos.DriverRecordSharing.ServiceDriverSharePlugin";
const string PreImageAlias = "pre";

var environmentUrl = args.ElementAtOrDefault(0) ?? "https://orgf261ae8e.crm2.dynamics.com/";
var technicalUserEmail = args.ElementAtOrDefault(1) ?? "";
var failures = new List<string>();

var specs = new[]
{
  new StepSpec("Servicos Create", "cr40f_reservadeveculos", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Servicos Update", "cr40f_reservadeveculos", "Update", 0, "cr40f_motorista,cr40f_solicitante", new[] { "cr40f_motorista", "cr40f_solicitante" }),
  new StepSpec("Funcionarios Create", "cr40f_funcionarios", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Funcionarios Update", "cr40f_funcionarios", "Update", 0, "cr40f_emailmicrosoft", new[] { "cr40f_emailmicrosoft" }),
  new StepSpec("Servicos por passageiro Create", "cr40f_servicosporpassageiro", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Servicos por passageiro Update", "cr40f_servicosporpassageiro", "Update", 1, "cr40f_geral,cr40f_bancodedados", new[] { "cr40f_geral", "cr40f_bancodedados" }),
  new StepSpec("Trocas de carro Create", "cr40f_trocasdecarro", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Trocas de carro Update", "cr40f_trocasdecarro", "Update", 0, "cr40f_motorista1,cr40f_motorista2,cr40f_statusdatroca", new[] { "cr40f_motorista1", "cr40f_motorista2", "cr40f_statusdatroca" }),
  new StepSpec("Posse de veiculo Create", "new_possedeveiculo", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Posse de veiculo Update", "new_possedeveiculo", "Update", 1, "new_motorista", new[] { "new_motorista" }),
  new StepSpec("Colisoes Create", "cr40f_colisao_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Colisoes Update", "cr40f_colisao_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" }),
  new StepSpec("Recibos Create", "cr40f_recibos_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Recibos Update", "cr40f_recibos_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" })
};

static void Log(string message) => Console.WriteLine($"[driver-sharing-plugin-validate] {message}");
static void Ok(string message) => Console.WriteLine($"[OK] {message}");
static void Fail(List<string> failures, string message)
{
  failures.Add(message);
  Console.WriteLine($"[ERRO] {message}");
}

static T ExecuteWithRetry<T>(Func<T> action, string label, int maxAttempts = 4)
{
  Exception? lastError = null;
  for (var attempt = 1; attempt <= maxAttempts; attempt++)
  {
    try
    {
      return action();
    }
    catch (Exception ex) when (attempt < maxAttempts)
    {
      lastError = ex;
      var delayMs = attempt * 2000;
      Log($"{label} falhou tentativa {attempt}/{maxAttempts}: {ex.Message}");
      Thread.Sleep(delayMs);
    }
    catch (Exception ex)
    {
      lastError = ex;
      break;
    }
  }

  throw new InvalidOperationException($"{label} falhou apos {maxAttempts} tentativas.", lastError);
}

var connectionString =
  $"AuthType=OAuth;" +
  $"Url={environmentUrl.TrimEnd('/')};" +
  "AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;" +
  "RedirectUri=http://localhost;" +
  "LoginPrompt=Auto";

Log($"auth {environmentUrl}");
using var service = new ServiceClient(connectionString);
if (!service.IsReady)
{
  throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");
}

Log("checando assembly");
var assemblyRows = FindMany(service, "pluginassembly", new ColumnSet("pluginassemblyid", "name", "version", "isolationmode", "sourcetype"), ("name", AssemblyName));
if (assemblyRows.Count != 1)
{
  Fail(failures, $"Assembly {AssemblyName}: esperado 1, encontrado {assemblyRows.Count}.");
  PrintAndExit(failures);
}

var assembly = assemblyRows[0];
var isolationMode = assembly.GetAttributeValue<OptionSetValue>("isolationmode")?.Value;
var sourceType = assembly.GetAttributeValue<OptionSetValue>("sourcetype")?.Value;
if (isolationMode != 2) Fail(failures, $"Assembly isolationmode esperado Sandbox(2), atual {isolationMode}.");
else Ok("Assembly isolationmode Sandbox");
if (sourceType != 0) Fail(failures, $"Assembly sourcetype esperado Database(0), atual {sourceType}.");
else Ok("Assembly source Database");
Ok($"Assembly encontrado version={assembly.GetAttributeValue<string>("version") ?? "<sem-versao>"} id={assembly.Id}");

Log("checando plugintype");
var typeRows = FindMany(service, "plugintype", new ColumnSet("plugintypeid", "typename", "pluginassemblyid"), ("typename", PluginTypeName));
if (typeRows.Count != 1)
{
  Fail(failures, $"PluginType {PluginTypeName}: esperado 1, encontrado {typeRows.Count}.");
  PrintAndExit(failures);
}

var pluginType = typeRows[0];
var typeAssembly = pluginType.GetAttributeValue<EntityReference>("pluginassemblyid");
if (typeAssembly == null || typeAssembly.Id != assembly.Id)
{
  Fail(failures, $"PluginType nao aponta para assembly correto. atual={typeAssembly?.Id}");
}
else
{
  Ok($"PluginType encontrado id={pluginType.Id}");
}

EntityReference? expectedRunAs = null;
if (!string.IsNullOrWhiteSpace(technicalUserEmail))
{
  var users = FindMany(
    service,
    "systemuser",
    new ColumnSet("systemuserid", "fullname", "internalemailaddress"),
    ("internalemailaddress", technicalUserEmail.Trim()),
    ("isdisabled", false));
  if (users.Count != 1)
  {
    Fail(failures, $"Usuario tecnico {technicalUserEmail}: esperado 1 ativo, encontrado {users.Count}.");
  }
  else
  {
    expectedRunAs = users[0].ToEntityReference();
    Ok($"Usuario tecnico encontrado: {users[0].GetAttributeValue<string>("fullname")} <{technicalUserEmail}>");
  }
}

Log("checando steps e images");
foreach (var spec in specs)
{
  var messageRows = FindMany(service, "sdkmessage", new ColumnSet("sdkmessageid", "name"), ("name", spec.Message));
  if (messageRows.Count != 1)
  {
    Fail(failures, $"{spec.Label}: sdkmessage {spec.Message} esperado 1, encontrado {messageRows.Count}.");
    continue;
  }

  var messageId = messageRows[0].Id;
  var filterRows = FindMany(
    service,
    "sdkmessagefilter",
    new ColumnSet("sdkmessagefilterid", "primaryobjecttypecode"),
    ("sdkmessageid", messageId),
    ("primaryobjecttypecode", spec.PrimaryEntity));
  if (filterRows.Count != 1)
  {
    Fail(failures, $"{spec.Label}: sdkmessagefilter {spec.PrimaryEntity} esperado 1, encontrado {filterRows.Count}.");
    continue;
  }

  var stepRows = FindMany(
    service,
    "sdkmessageprocessingstep",
    new ColumnSet("sdkmessageprocessingstepid", "name", "mode", "stage", "filteringattributes", "supporteddeployment", "impersonatinguserid", "statecode", "statuscode"),
    ("eventhandler", pluginType.Id),
    ("sdkmessageid", messageId),
    ("sdkmessagefilterid", filterRows[0].Id));

  if (stepRows.Count != 1)
  {
    Fail(failures, $"{spec.Label}: step esperado 1, encontrado {stepRows.Count}.");
    continue;
  }

  var step = stepRows[0];
  var mode = step.GetAttributeValue<OptionSetValue>("mode")?.Value;
  var stage = step.GetAttributeValue<OptionSetValue>("stage")?.Value;
  var deployment = step.GetAttributeValue<OptionSetValue>("supporteddeployment")?.Value;
  var filtering = step.GetAttributeValue<string>("filteringattributes") ?? "";
  var state = step.GetAttributeValue<OptionSetValue>("statecode")?.Value;
  var runAs = step.GetAttributeValue<EntityReference>("impersonatinguserid");

  if (mode != spec.Mode) Fail(failures, $"{spec.Label}: mode esperado {ModeLabel(spec.Mode)}, atual {ModeLabel(mode)}.");
  if (stage != 40) Fail(failures, $"{spec.Label}: stage esperado PostOperation(40), atual {stage}.");
  if (deployment != 0) Fail(failures, $"{spec.Label}: deployment esperado Server(0), atual {deployment}.");
  if (state != 0) Fail(failures, $"{spec.Label}: step nao esta ativo. statecode={state}.");
  if (!SameCsv(filtering, spec.FilteringAttributes)) Fail(failures, $"{spec.Label}: filtering esperado '{spec.FilteringAttributes}', atual '{filtering}'.");
  if (expectedRunAs != null && (runAs == null || runAs.Id != expectedRunAs.Id)) Fail(failures, $"{spec.Label}: Run As esperado {expectedRunAs.Id}, atual {runAs?.Id}.");

  var imageRows = FindMany(
    service,
    "sdkmessageprocessingstepimage",
    new ColumnSet("sdkmessageprocessingstepimageid", "name", "entityalias", "imagetype", "messagepropertyname", "attributes"),
    ("sdkmessageprocessingstepid", step.Id),
    ("imagetype", 0),
    ("entityalias", PreImageAlias));

  if (spec.PreImageAttributes.Length == 0)
  {
    if (imageRows.Count > 0) Fail(failures, $"{spec.Label}: Create nao deveria ter Pre Image alias '{PreImageAlias}', encontrado {imageRows.Count}.");
    else Ok($"{spec.Label}: {ModeLabel(mode)} sem Pre Image");
    continue;
  }

  if (imageRows.Count != 1)
  {
    Fail(failures, $"{spec.Label}: Pre Image alias '{PreImageAlias}' esperado 1, encontrado {imageRows.Count}.");
    continue;
  }

  var image = imageRows[0];
  var alias = image.GetAttributeValue<string>("entityalias") ?? "";
  var property = image.GetAttributeValue<string>("messagepropertyname") ?? "";
  var attrs = image.GetAttributeValue<string>("attributes") ?? "";
  if (!string.Equals(alias, PreImageAlias, StringComparison.OrdinalIgnoreCase)) Fail(failures, $"{spec.Label}: image alias esperado '{PreImageAlias}', atual '{alias}'.");
  if (!string.Equals(property, "Target", StringComparison.OrdinalIgnoreCase)) Fail(failures, $"{spec.Label}: image messagepropertyname esperado Target, atual '{property}'.");
  if (!SameCsv(attrs, string.Join(",", spec.PreImageAttributes))) Fail(failures, $"{spec.Label}: image attrs esperado '{string.Join(",", spec.PreImageAttributes)}', atual '{attrs}'.");

  Ok($"{spec.Label}: {ModeLabel(mode)} PostOperation filtro='{filtering}' PreImage='{attrs}'");
}

PrintAndExit(failures);

static void PrintAndExit(List<string> failures)
{
  if (failures.Count == 0)
  {
    Console.WriteLine("[driver-sharing-plugin-validate] VALIDACAO OK");
    return;
  }

  Console.WriteLine($"[driver-sharing-plugin-validate] VALIDACAO FALHOU: {failures.Count} problema(s)");
  foreach (var failure in failures)
  {
    Console.WriteLine($" - {failure}");
  }
  Environment.Exit(1);
}

static List<Entity> FindMany(ServiceClient service, string logicalName, ColumnSet columns, params (string Attribute, object Value)[] conditions)
{
  var query = new QueryExpression(logicalName)
  {
    ColumnSet = columns
  };
  foreach (var condition in conditions)
  {
    query.Criteria.AddCondition(condition.Attribute, ConditionOperator.Equal, condition.Value);
  }
  return ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities.ToList(), $"RetrieveMultiple {logicalName}");
}

static bool SameCsv(string left, string right)
{
  static string Normalize(string value) => string.Join(",", value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
  return string.Equals(Normalize(left ?? ""), Normalize(right ?? ""), StringComparison.OrdinalIgnoreCase);
}

static string ModeLabel(int? mode) => mode switch
{
  0 => "Synchronous",
  1 => "Asynchronous",
  null => "<null>",
  _ => mode.Value.ToString()
};

internal sealed record StepSpec(string Label, string PrimaryEntity, string Message, int Mode, string FilteringAttributes, string[] PreImageAttributes);
'@

Set-Content -LiteralPath $projectFile -Value $csproj -Encoding UTF8
Set-Content -LiteralPath $programFile -Value $program -Encoding UTF8

if ($GenerateOnly) {
  Write-Step "runner gerado em $workDir"
  return
}

$argsList = @($EnvironmentUrl, $TechnicalUserEmail)

Write-Step "run validation runner"
dotnet run --project $projectFile -- @argsList
