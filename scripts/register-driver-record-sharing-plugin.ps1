param(
  [Parameter(Mandatory = $true)]
  [string] $EnvironmentUrl,

  [string] $TechnicalUserEmail = "",

  [string] $DllPath = "",

  [switch] $DryRun,

  [switch] $GenerateOnly,

  [switch] $SkipBuild,

  [switch] $DeviceCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[driver-sharing-plugin] $Message"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pluginProject = Join-Path $root "plugins\DriverRecordSharing\DriverRecordSharing.csproj"

if (-not $DllPath) {
  $DllPath = Join-Path $root "plugins\DriverRecordSharing\bin\Release\net462\Betinhos.DriverRecordSharing.dll"
}

if (-not $SkipBuild) {
  Write-Step "build plugin"
  dotnet build $pluginProject -c Release
}

if (-not (Test-Path -LiteralPath $DllPath)) {
  throw "DLL nao encontrada: $DllPath"
}

$workDir = Join-Path $root "scripts\.driver-record-sharing-runners\register"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$projectFile = Join-Path $workDir "RegisterDriverRecordSharingPlugin.csproj"
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
using System.Reflection;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

const string AssemblyName = "Betinhos.DriverRecordSharing";
const string PluginTypeName = "Betinhos.DriverRecordSharing.ServiceDriverSharePlugin";
const string PreImageAlias = "pre";

var environmentUrl = args.ElementAtOrDefault(0) ?? throw new InvalidOperationException("EnvironmentUrl obrigatorio.");
var dllPath = args.ElementAtOrDefault(1) ?? throw new InvalidOperationException("DllPath obrigatorio.");
var technicalUserEmail = args.ElementAtOrDefault(2) ?? "";
var dryRun = args.Any(arg => string.Equals(arg, "--dry-run", StringComparison.OrdinalIgnoreCase));

static void Log(string message) => Console.WriteLine($"[driver-sharing-plugin] {message}");
static EntityReference Ref(string logicalName, Guid id) => new(logicalName, id);

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

static void ExecuteActionWithRetry(Action action, string label, int maxAttempts = 4)
{
  ExecuteWithRetry(
    () =>
    {
      action();
      return true;
    },
    label,
    maxAttempts);
}

var specs = new[]
{
  new StepSpec("Servicos Create", "cr40f_reservadeveculos", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Servicos Update", "cr40f_reservadeveculos", "Update", 0, "cr40f_motorista,cr40f_solicitante,cr40f_dataehorriodesada,cr40f_veiculo,new_origemveiculo,cr40f_ot,cr40f_status", new[] { "cr40f_motorista", "cr40f_solicitante", "cr40f_dataehorriodesada", "cr40f_veiculo", "new_origemveiculo", "cr40f_ot", "cr40f_status" }),
  new StepSpec("Funcionarios Create", "cr40f_funcionarios", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Funcionarios Update", "cr40f_funcionarios", "Update", 0, "cr40f_emailmicrosoft", new[] { "cr40f_emailmicrosoft" }),
  new StepSpec("Servicos por passageiro Create", "cr40f_servicosporpassageiro", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Servicos por passageiro Update", "cr40f_servicosporpassageiro", "Update", 1, "cr40f_geral,cr40f_bancodedados", new[] { "cr40f_geral", "cr40f_bancodedados" }),
  new StepSpec("Servicos por passageiro Delete", "cr40f_servicosporpassageiro", "Delete", 1, "", new[] { "cr40f_geral", "cr40f_bancodedados" }),
  new StepSpec("Passageiros Update", "cr40f_bancodedados", "Update", 1, "cr40f_nomedopassageiro,cr40f_telefone", new[] { "cr40f_nomedopassageiro", "cr40f_telefone" }),
  new StepSpec("Trocas de carro Create", "cr40f_trocasdecarro", "Create", 0, "", Array.Empty<string>()),
  new StepSpec("Trocas de carro Update", "cr40f_trocasdecarro", "Update", 0, "cr40f_motorista1,cr40f_motorista2,cr40f_statusdatroca,cr40f_veiculo1antesdatroca,cr40f_veiculo2antesdatroca,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca,new_tipodetroca", new[] { "cr40f_motorista1", "cr40f_motorista2", "cr40f_statusdatroca", "cr40f_veiculo1antesdatroca", "cr40f_veiculo2antesdatroca", "cr40f_iniciodajaneladetroca", "cr40f_fimdajaneladetroca", "new_tipodetroca" }),
  new StepSpec("Posse de veiculo Create", "new_possedeveiculo", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Posse de veiculo Update", "new_possedeveiculo", "Update", 1, "new_motorista,new_veiculo,new_iniciodaposse,new_fimdaposse", new[] { "new_motorista", "new_veiculo", "new_iniciodaposse", "new_fimdaposse" }),
  new StepSpec("Colisoes Create", "cr40f_colisao_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Colisoes Update", "cr40f_colisao_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" }),
  new StepSpec("Recibos Create", "cr40f_recibos_v2", "Create", 1, "", Array.Empty<string>()),
  new StepSpec("Recibos Update", "cr40f_recibos_v2", "Update", 1, "cr40f_motorista", new[] { "cr40f_motorista" }),
  new StepSpec("Pedido de cotacao Update", "cr40f_pedidodecotacao", "Update", 0, "cr40f_origemultimasincronizacao,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_condicaocomercial,cr40f_respostaenviadacliente,cr40f_clienteempresa,cr40f_contatocliente,cr40f_telefonewhatsapp,cr40f_emailcliente,cr40f_origem,cr40f_destino,cr40f_datahoraservico,cr40f_quantidadepassageiros,cr40f_observacoespedido,cr40f_prioridade", Array.Empty<string>())
};

Log("auth");
using var service = CreateServiceClient(environmentUrl);
if (!service.IsReady)
{
  throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");
}

var assemblyBytes = File.ReadAllBytes(dllPath);
var assemblyContent = Convert.ToBase64String(assemblyBytes);
var assemblyInfo = AssemblyNameParser.Read(dllPath);
var runAsUser = string.IsNullOrWhiteSpace(technicalUserEmail) ? null : ResolveActiveUserByEmail(service, technicalUserEmail);

if (dryRun)
{
  Log("DRY RUN ativo. Nada sera alterado.");
}

var assemblyId = UpsertPluginAssembly(service, assemblyContent, assemblyInfo, dryRun);
var pluginTypeId = UpsertPluginType(service, assemblyId, dryRun);

foreach (var spec in specs)
{
  var messageId = RequireSingleId(service, "sdkmessage", new ColumnSet("sdkmessageid"), ("name", spec.Message));
  var filterId = RequireMessageFilter(service, messageId, spec.PrimaryEntity);
  var stepId = UpsertStep(service, spec, pluginTypeId, messageId, filterId, runAsUser, dryRun);
  UpsertPreImage(service, spec, stepId, dryRun);
}

if (dryRun)
{
  Log("dry-run concluido. Nenhuma alteracao aplicada.");
  return;
}

Log("validando configuracao final");
foreach (var spec in specs)
{
  var messageId = RequireSingleId(service, "sdkmessage", new ColumnSet("sdkmessageid"), ("name", spec.Message));
  var filterId = RequireMessageFilter(service, messageId, spec.PrimaryEntity);
  var step = FindStep(service, pluginTypeId, messageId, filterId);
  if (step == null)
  {
    throw new InvalidOperationException($"Step ausente: {spec.Label}");
  }

  var mode = step.GetAttributeValue<OptionSetValue>("mode")?.Value;
  var stage = step.GetAttributeValue<OptionSetValue>("stage")?.Value;
  var filtering = step.GetAttributeValue<string>("filteringattributes") ?? "";
  if (mode != spec.Mode || stage != 40 || !SameCsv(filtering, spec.FilteringAttributes))
  {
    throw new InvalidOperationException($"Step divergente: {spec.Label}. mode={mode}, stage={stage}, filtering={filtering}");
  }

  var image = FindPreImage(service, step.Id);
  if (spec.PreImageAttributes.Length == 0)
  {
    Log($"OK {spec.Label}: {(spec.Mode == 0 ? "Synchronous" : "Asynchronous")} sem Pre Image obrigatoria");
    continue;
  }

  if (image == null)
  {
    throw new InvalidOperationException($"Pre Image ausente: {spec.Label}");
  }

  var alias = image.GetAttributeValue<string>("entityalias") ?? "";
  var attrs = image.GetAttributeValue<string>("attributes") ?? "";
  if (!string.Equals(alias, PreImageAlias, StringComparison.OrdinalIgnoreCase) || !SameCsv(attrs, string.Join(",", spec.PreImageAttributes)))
  {
    throw new InvalidOperationException($"Pre Image divergente: {spec.Label}. alias={alias}, attrs={attrs}");
  }

  Log($"OK {spec.Label}: {(spec.Mode == 0 ? "Synchronous" : "Asynchronous")} Pre Image={attrs}");
}

Log("pronto");

static Guid UpsertPluginAssembly(ServiceClient service, string content, AssemblyInfo assemblyInfo, bool dryRun)
{
  var existing = FindFirst(service, "pluginassembly", new ColumnSet("pluginassemblyid"), ("name", AssemblyName));
  var record = new Entity("pluginassembly")
  {
    ["name"] = AssemblyName,
    ["content"] = content,
    ["isolationmode"] = new OptionSetValue(2),
    ["sourcetype"] = new OptionSetValue(0),
    ["version"] = assemblyInfo.Version,
    ["culture"] = assemblyInfo.Culture,
    ["publickeytoken"] = assemblyInfo.PublicKeyToken
  };

  if (existing != null)
  {
    record = new Entity("pluginassembly")
    {
      Id = existing.Id,
      ["content"] = content
    };
    record.Id = existing.Id;
    Log($"update assembly {AssemblyName}");
    if (!dryRun) ExecuteActionWithRetry(() => service.Update(record), $"Update pluginassembly {AssemblyName}");
    return existing.Id;
  }

  Log($"create assembly {AssemblyName}");
  return dryRun ? Guid.Empty : ExecuteWithRetry(() => service.Create(record), $"Create pluginassembly {AssemblyName}");
}

static Guid UpsertPluginType(ServiceClient service, Guid assemblyId, bool dryRun)
{
  var existing = FindFirst(service, "plugintype", new ColumnSet("plugintypeid"), ("typename", PluginTypeName));
  var record = new Entity("plugintype")
  {
    ["name"] = "ServiceDriverSharePlugin",
    ["friendlyname"] = "ServiceDriverSharePlugin",
    ["typename"] = PluginTypeName,
    ["pluginassemblyid"] = Ref("pluginassembly", assemblyId)
  };

  if (existing != null)
  {
    Log($"found plugintype {PluginTypeName}");
    return existing.Id;
  }

  Log($"create plugintype {PluginTypeName}");
  return dryRun ? Guid.Empty : ExecuteWithRetry(() => service.Create(record), $"Create plugintype {PluginTypeName}");
}

static Guid UpsertStep(ServiceClient service, StepSpec spec, Guid pluginTypeId, Guid messageId, Guid filterId, EntityReference? runAsUser, bool dryRun)
{
  var existing = FindStep(service, pluginTypeId, messageId, filterId);
  var name = $"DriverRecordSharing - {spec.Label}";
  var record = new Entity("sdkmessageprocessingstep")
  {
    ["name"] = name,
    ["description"] = "Criado pelo script register-driver-record-sharing-plugin.ps1",
    ["eventhandler"] = Ref("plugintype", pluginTypeId),
    ["sdkmessageid"] = Ref("sdkmessage", messageId),
    ["sdkmessagefilterid"] = Ref("sdkmessagefilter", filterId),
    ["stage"] = new OptionSetValue(40),
    ["mode"] = new OptionSetValue(spec.Mode),
    ["rank"] = 1,
    ["supporteddeployment"] = new OptionSetValue(0)
  };

  if (spec.Message == "Update")
  {
    record["filteringattributes"] = spec.FilteringAttributes;
  }

  if (runAsUser != null)
  {
    record["impersonatinguserid"] = runAsUser;
  }

  if (existing != null)
  {
    record.Id = existing.Id;
    Log($"update step {name}");
    if (!dryRun) ExecuteActionWithRetry(() => service.Update(record), $"Update step {name}");
    return existing.Id;
  }

  Log($"create step {name}");
  return dryRun ? Guid.Empty : ExecuteWithRetry(() => service.Create(record), $"Create step {name}");
}

static void UpsertPreImage(ServiceClient service, StepSpec spec, Guid stepId, bool dryRun)
{
  if (spec.PreImageAttributes.Length == 0)
  {
    return;
  }

  var attrs = string.Join(",", spec.PreImageAttributes);
  var existing = FindPreImage(service, stepId);
  var record = new Entity("sdkmessageprocessingstepimage")
  {
    ["name"] = PreImageAlias,
    ["entityalias"] = PreImageAlias,
    ["imagetype"] = new OptionSetValue(0),
    ["messagepropertyname"] = "Target",
    ["attributes"] = attrs,
    ["sdkmessageprocessingstepid"] = Ref("sdkmessageprocessingstep", stepId)
  };

  if (existing != null)
  {
    record.Id = existing.Id;
    Log($"update pre image {spec.Label}: {attrs}");
    if (!dryRun) ExecuteActionWithRetry(() => service.Update(record), $"Update pre image {spec.Label}");
    return;
  }

  Log($"create pre image {spec.Label}: {attrs}");
  if (!dryRun) ExecuteWithRetry(() => service.Create(record), $"Create pre image {spec.Label}");
}

static EntityReference? ResolveActiveUserByEmail(ServiceClient service, string email)
{
  var query = new QueryExpression("systemuser")
  {
    ColumnSet = new ColumnSet("systemuserid", "fullname", "internalemailaddress"),
    TopCount = 2
  };
  query.Criteria.AddCondition("internalemailaddress", ConditionOperator.Equal, email.Trim());
  query.Criteria.AddCondition("isdisabled", ConditionOperator.Equal, false);
  var users = ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities, $"RetrieveMultiple systemuser {email}");
  if (users.Count != 1)
  {
    throw new InvalidOperationException($"Usuario tecnico nao encontrado ou duplicado: {email}. Ativos encontrados={users.Count}");
  }
  Log($"run as {users[0].GetAttributeValue<string>("fullname")} <{email}>");
  return users[0].ToEntityReference();
}

static Guid RequireMessageFilter(ServiceClient service, Guid messageId, string primaryEntity)
{
  var query = new QueryExpression("sdkmessagefilter")
  {
    ColumnSet = new ColumnSet("sdkmessagefilterid"),
    TopCount = 2
  };
  query.Criteria.AddCondition("sdkmessageid", ConditionOperator.Equal, messageId);
  query.Criteria.AddCondition("primaryobjecttypecode", ConditionOperator.Equal, primaryEntity);
  var rows = ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities, $"RetrieveMultiple sdkmessagefilter {primaryEntity}");
  if (rows.Count != 1)
  {
    throw new InvalidOperationException($"sdkmessagefilter invalido para {primaryEntity}. encontrados={rows.Count}");
  }
  return rows[0].Id;
}

static Guid RequireSingleId(ServiceClient service, string logicalName, ColumnSet columns, params (string Attribute, object Value)[] conditions)
{
  var row = FindFirst(service, logicalName, columns, conditions);
  if (row == null)
  {
    throw new InvalidOperationException($"Registro nao encontrado: {logicalName}");
  }
  return row.Id;
}

static Entity? FindStep(ServiceClient service, Guid pluginTypeId, Guid messageId, Guid filterId)
{
  if (pluginTypeId == Guid.Empty || messageId == Guid.Empty || filterId == Guid.Empty)
  {
    return null;
  }

  var query = new QueryExpression("sdkmessageprocessingstep")
  {
    ColumnSet = new ColumnSet("sdkmessageprocessingstepid", "name", "mode", "stage", "filteringattributes"),
    TopCount = 2
  };
  query.Criteria.AddCondition("eventhandler", ConditionOperator.Equal, pluginTypeId);
  query.Criteria.AddCondition("sdkmessageid", ConditionOperator.Equal, messageId);
  query.Criteria.AddCondition("sdkmessagefilterid", ConditionOperator.Equal, filterId);
  var rows = ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities, "RetrieveMultiple sdkmessageprocessingstep");
  if (rows.Count > 1)
  {
    throw new InvalidOperationException($"Steps duplicados para message={messageId} filter={filterId}");
  }
  return rows.FirstOrDefault();
}

static Entity? FindPreImage(ServiceClient service, Guid stepId)
{
  if (stepId == Guid.Empty)
  {
    return null;
  }

  var query = new QueryExpression("sdkmessageprocessingstepimage")
  {
    ColumnSet = new ColumnSet("sdkmessageprocessingstepimageid", "name", "entityalias", "imagetype", "attributes"),
    TopCount = 2
  };
  query.Criteria.AddCondition("sdkmessageprocessingstepid", ConditionOperator.Equal, stepId);
  query.Criteria.AddCondition("imagetype", ConditionOperator.Equal, 0);
  query.Criteria.AddCondition("entityalias", ConditionOperator.Equal, PreImageAlias);
  var rows = ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities, "RetrieveMultiple sdkmessageprocessingstepimage");
  if (rows.Count > 1)
  {
    throw new InvalidOperationException($"Pre Images duplicadas no step {stepId}");
  }
  return rows.FirstOrDefault();
}

static Entity? FindFirst(ServiceClient service, string logicalName, ColumnSet columns, params (string Attribute, object Value)[] conditions)
{
  var query = new QueryExpression(logicalName)
  {
    ColumnSet = columns,
    TopCount = 2
  };
  foreach (var condition in conditions)
  {
    query.Criteria.AddCondition(condition.Attribute, ConditionOperator.Equal, condition.Value);
  }
  var rows = ExecuteWithRetry(() => service.RetrieveMultiple(query).Entities, $"RetrieveMultiple {logicalName}");
  if (rows.Count > 1)
  {
    throw new InvalidOperationException($"Mais de um registro encontrado: {logicalName}");
  }
  return rows.FirstOrDefault();
}

static bool SameCsv(string left, string right)
{
  static string Normalize(string value) => string.Join(",", value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
  return string.Equals(Normalize(left ?? ""), Normalize(right ?? ""), StringComparison.OrdinalIgnoreCase);
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

internal sealed record StepSpec(string Label, string PrimaryEntity, string Message, int Mode, string FilteringAttributes, string[] PreImageAttributes);

internal sealed record AssemblyInfo(string Version, string Culture, string PublicKeyToken);

internal static class AssemblyNameParser
{
  public static AssemblyInfo Read(string dllPath)
  {
    var name = System.Reflection.AssemblyName.GetAssemblyName(dllPath);
    var token = name.GetPublicKeyToken();
    var publicKeyToken = token == null || token.Length == 0
      ? ""
      : string.Concat(token.Select(b => b.ToString("x2")));
    return new AssemblyInfo(name.Version?.ToString() ?? "1.0.0.0", string.IsNullOrWhiteSpace(name.CultureName) ? "neutral" : name.CultureName!, publicKeyToken);
  }
}
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
if ($DryRun) {
  $argsList += "--dry-run"
}

try {
  Write-Step "run registration runner"
  dotnet build $projectFile
  $runnerDll = Join-Path $workDir "bin\Debug\net8.0\RegisterDriverRecordSharingPlugin.dll"
  dotnet $runnerDll @argsList
}
finally {
  if ($DeviceCode) {
    Remove-Item Env:\DRIVER_RECORD_SHARING_ACCESS_TOKEN -ErrorAction SilentlyContinue
  }
}
