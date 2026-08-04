param(
  [string] $EnvironmentUrl = "https://orgf261ae8e.crm2.dynamics.com/",

  [string] $TechnicalUserEmail = "",

  [string] $DllPath = "",

  [switch] $SkipBuild,

  [switch] $GenerateOnly,

  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[driver-sharing-plugin-validate] $Message"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pluginProject = Join-Path $root "plugins\DriverRecordSharing\DriverRecordSharing.csproj"

if (-not $DllPath) {
  $DllPath = Join-Path $root "plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll"
}

if (-not $SkipBuild -and -not $GenerateOnly) {
  Write-Step "build plugin"
  dotnet build $pluginProject -c Release
}

if (-not $GenerateOnly -and -not (Test-Path -LiteralPath $DllPath)) {
  throw "DLL nao encontrada: $DllPath"
}

$workDir = Join-Path $root "scripts\.driver-record-sharing-runners\validate"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$projectFile = Join-Path $workDir "ValidateDriverRecordSharingPlugin.csproj"
$programFile = Join-Path $workDir "Program.cs"

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
var dllPath = args.ElementAtOrDefault(1) ?? "";
var technicalUserEmail = args.ElementAtOrDefault(2) ?? "";
var failures = new List<string>();

var specs = new[]
{
  new StepSpec("Servicos Create", "cr40f_reservadeveculos", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Servicos Update", "cr40f_reservadeveculos", "Update", 0, "cr40f_motorista,cr40f_solicitante,cr40f_dataehorriodesada,cr40f_horrioprevistoderetorno,cr40f_veiculo,new_origemveiculo,cr40f_ot,cr40f_status,new_datadefinalizacao", new[] { "cr40f_motorista", "cr40f_solicitante", "cr40f_dataehorriodesada", "cr40f_horrioprevistoderetorno", "cr40f_veiculo", "new_origemveiculo", "cr40f_ot", "cr40f_status", "new_datadefinalizacao" }),
  new StepSpec("Funcionarios Create", "cr40f_funcionarios", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Funcionarios Update", "cr40f_funcionarios", "Update", 0, "cr40f_emailmicrosoft", new[] { "cr40f_emailmicrosoft" }),
  new StepSpec("Servicos por passageiro Create", "cr40f_servicosporpassageiro", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Servicos por passageiro Update", "cr40f_servicosporpassageiro", "Update", 1, "cr40f_geral,cr40f_bancodedados", new[] { "cr40f_geral", "cr40f_bancodedados" }),
  new StepSpec("Servicos por passageiro Delete", "cr40f_servicosporpassageiro", "Delete", 1, "", new[] { "cr40f_geral", "cr40f_bancodedados" }),
  new StepSpec("Passageiros Update", "cr40f_bancodedados", "Update", 1, "cr40f_nomedopassageiro,cr40f_telefone", new[] { "cr40f_nomedopassageiro", "cr40f_telefone" }),
  new StepSpec("Trocas de carro Create", "cr40f_trocasdecarro", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Trocas de carro Update", "cr40f_trocasdecarro", "Update", 0, "cr40f_motorista1,cr40f_motorista2,cr40f_statusdatroca,cr40f_veiculo1antesdatroca,cr40f_veiculo2antesdatroca,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,new_tipodetroca,new_concluidomotorista1,new_concluidomotorista2,new_observacaodomotorista1,new_observacaodomotorista2", new[] { "cr40f_motorista1", "cr40f_motorista2", "cr40f_statusdatroca", "cr40f_veiculo1antesdatroca", "cr40f_veiculo2antesdatroca", "cr40f_iniciodajaneladetroca", "cr40f_fimdajaneladetroca", "new_tipodetroca", "new_concluidomotorista1", "new_concluidomotorista2", "new_observacaodomotorista1", "new_observacaodomotorista2" }),
  new StepSpec("Posse de veiculo Create PreOperation", "new_possedeveiculo", "Create", 0, "", Array.Empty<string>(), 20),
  new StepSpec("Posse de veiculo Update PreOperation", "new_possedeveiculo", "Update", 0, "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse", new[] { "new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse" }, 20),
  new StepSpec("Posse de veiculo Create", "new_possedeveiculo", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Posse de veiculo Update", "new_possedeveiculo", "Update", 0, "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse", new[] { "new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse" }),
  new StepSpec("Colisoes Create", "cr40f_colisao_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Colisoes Update", "cr40f_colisao_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" }),
  new StepSpec("Recibos Create", "cr40f_recibos_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Recibos Update", "cr40f_recibos_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" }),
  new StepSpec("Pedido de cotacao Update", "cr40f_pedidodecotacao", "Update", 0, "cr40f_origemultimasincronizacao,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_condicaocomercial,cr40f_respostaenviadacliente,cr40f_clienteempresa,cr40f_contatocliente,cr40f_telefonewhatsapp,cr40f_emailcliente,cr40f_origem,cr40f_destino,cr40f_datahoraservico,cr40f_quantidadepassageiros,cr40f_observacoespedido,cr40f_prioridade", Array.Empty<string>())
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

Log($"auth {environmentUrl}");
using var service = CreateServiceClient(environmentUrl);
if (!service.IsReady)
{
  throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");
}

Log("checando assembly");
var assemblyRows = FindMany(service, "pluginassembly", new ColumnSet("pluginassemblyid", "name", "version", "isolationmode", "sourcetype", "content"), ("name", AssemblyName));
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

if (!string.IsNullOrWhiteSpace(dllPath))
{
  if (!File.Exists(dllPath))
  {
    Fail(failures, $"DLL local nao encontrada para comparar conteudo: {dllPath}");
  }
  else
  {
    var localHash = Sha256Hex(File.ReadAllBytes(dllPath));
    var remoteContent = assembly.GetAttributeValue<string>("content") ?? "";
    if (string.IsNullOrWhiteSpace(remoteContent))
    {
      Fail(failures, "Assembly publicado esta sem campo content para comparar SHA-256.");
    }
    else
    {
      byte[] remoteBytes;
      try
      {
        remoteBytes = Convert.FromBase64String(remoteContent);
      }
      catch (FormatException ex)
      {
        Fail(failures, $"Assembly publicado tem content Base64 invalido: {ex.Message}");
        remoteBytes = Array.Empty<byte>();
      }

      if (remoteBytes.Length > 0)
      {
        var remoteHash = Sha256Hex(remoteBytes);
        if (!string.Equals(localHash, remoteHash, StringComparison.OrdinalIgnoreCase))
        {
          Fail(failures, $"Assembly content divergente. local sha256={localHash}; prod sha256={remoteHash}. Rode o registro novamente.");
        }
        else
        {
          Ok($"Assembly content confere com DLL local sha256={localHash}");
        }
      }
    }
  }
}

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
    new ColumnSet("sdkmessageprocessingstepid", "name", "mode", "stage", "asyncautodelete", "filteringattributes", "supporteddeployment", "impersonatinguserid", "statecode", "statuscode"),
    ("eventhandler", pluginType.Id),
    ("sdkmessageid", messageId),
    ("sdkmessagefilterid", filterRows[0].Id),
    ("stage", spec.Stage));

  if (stepRows.Count != 1)
  {
    Fail(failures, $"{spec.Label}: step esperado 1, encontrado {stepRows.Count}.");
    continue;
  }

  var step = stepRows[0];
  var mode = step.GetAttributeValue<OptionSetValue>("mode")?.Value;
  var stage = step.GetAttributeValue<OptionSetValue>("stage")?.Value;
  var deployment = step.GetAttributeValue<OptionSetValue>("supporteddeployment")?.Value;
  var asyncAutoDelete = step.GetAttributeValue<bool>("asyncautodelete");
  var filtering = step.GetAttributeValue<string>("filteringattributes") ?? "";
  var state = step.GetAttributeValue<OptionSetValue>("statecode")?.Value;
  var runAs = step.GetAttributeValue<EntityReference>("impersonatinguserid");

  if (mode != spec.Mode) Fail(failures, $"{spec.Label}: mode esperado {ModeLabel(spec.Mode)}, atual {ModeLabel(mode)}.");
  if (stage != spec.Stage) Fail(failures, $"{spec.Label}: stage esperado {spec.Stage}, atual {stage}.");
  if (deployment != 0) Fail(failures, $"{spec.Label}: deployment esperado Server(0), atual {deployment}.");
  if (asyncAutoDelete != (spec.Mode == 1)) Fail(failures, $"{spec.Label}: asyncautodelete esperado {spec.Mode == 1}, atual {asyncAutoDelete}.");
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

static string Sha256Hex(byte[] bytes)
{
  var hash = System.Security.Cryptography.SHA256.HashData(bytes);
  return Convert.ToHexString(hash).ToLowerInvariant();
}

static ServiceClient CreateServiceClient(string environmentUrl)
{
  var accessToken = Environment.GetEnvironmentVariable("DRIVER_RECORD_SHARING_ACCESS_TOKEN");
  if (!string.IsNullOrWhiteSpace(accessToken))
  {
    return new ServiceClient(new Uri(environmentUrl.TrimEnd('/')), _ => Task.FromResult(accessToken), true);
  }

  var connectionString =
    $"AuthType=OAuth;" +
    $"Url={environmentUrl.TrimEnd('/')};" +
    "AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;" +
    "RedirectUri=http://localhost;" +
    "LoginPrompt=Auto";

  return new ServiceClient(connectionString);
}

internal sealed record StepSpec(string Label, string PrimaryEntity, string Message, int Mode, string FilteringAttributes, string[] PreImageAttributes, int Stage = 40);
'@

Set-Content -LiteralPath $projectFile -Value $csproj -Encoding UTF8
Set-Content -LiteralPath $programFile -Value $program -Encoding UTF8

if ($GenerateOnly) {
  Write-Step "runner gerado em $workDir"
  return
}

if ($DeviceCode) {
  if (-not (Get-Module -ListAvailable MSAL.PS)) {
    throw "Modulo MSAL.PS nao encontrado. Instale com: Install-Module MSAL.PS -Scope CurrentUser"
  }

  Import-Module MSAL.PS -ErrorAction Stop
  Write-Step "auth DeviceCode"
  $environmentBaseUrl = $EnvironmentUrl.TrimEnd("/")
  $scope = "$environmentBaseUrl/user_impersonation"
  $redirectUri = [Uri] "http://localhost"
  $clientApplication = New-MsalClientApplication `
    -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" `
    -TenantId "organizations" `
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
      -DeviceCode
  }

  if ([string]::IsNullOrWhiteSpace($tokenResult.AccessToken)) {
    throw "Falha ao obter token MSAL para $scope"
  }

  $env:DRIVER_RECORD_SHARING_ACCESS_TOKEN = $tokenResult.AccessToken
}

$argsList = @($EnvironmentUrl, $DllPath, $TechnicalUserEmail)

try {
  Write-Step "run validation runner"
  dotnet build $projectFile
  $runnerDll = Join-Path $workDir "bin\Debug\net8.0\ValidateDriverRecordSharingPlugin.dll"
  dotnet $runnerDll @argsList
}
finally {
  if ($DeviceCode) {
    Remove-Item Env:\DRIVER_RECORD_SHARING_ACCESS_TOKEN -ErrorAction SilentlyContinue
  }
}
