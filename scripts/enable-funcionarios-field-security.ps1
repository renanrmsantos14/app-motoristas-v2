param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [string] $TableLogicalName = "cr40f_funcionarios",
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string] $Message) {
  Write-Host "[field-security] $Message"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workDir = Join-Path $root ".tmp\enable-funcionarios-field-security"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$projectFile = Join-Path $workDir "EnableFuncionariosFieldSecurity.csproj"
$programFile = Join-Path $workDir "Program.cs"

$csproj = @"
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
"@

$program = @"
using Microsoft.Crm.Sdk.Messages;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;

var environmentUrl = args.Length > 0 ? args[0] : "https://org23b93544.crm2.dynamics.com/";
var tableLogicalName = args.Length > 1 ? args[1] : "cr40f_funcionarios";
var dryRun = args.Any(a => string.Equals(a, "--dry-run", StringComparison.OrdinalIgnoreCase));

static void Log(string message) => Console.WriteLine($"[field-security] {message}");

static T ExecuteWithRetry<T>(ServiceClient service, OrganizationRequest request, Func<OrganizationResponse, T> map, string label, int maxAttempts = 4)
{
  Exception? lastError = null;
  for (var attempt = 1; attempt <= maxAttempts; attempt++)
  {
    try
    {
      var response = service.Execute(request);
      return map(response);
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

Log("auth");
using var service = new ServiceClient(connectionString);

if (!service.IsReady)
{
  throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");
}

var retrieve = new RetrieveEntityRequest
{
  LogicalName = tableLogicalName,
  EntityFilters = EntityFilters.Attributes,
  RetrieveAsIfPublished = true
};

Log($"metadata {tableLogicalName}");
var entityResponse = ExecuteWithRetry(service, retrieve, response => (RetrieveEntityResponse)response, $"RetrieveEntity {tableLogicalName}");
var entity = entityResponse.EntityMetadata ?? throw new InvalidOperationException($"Tabela nao encontrada: {tableLogicalName}");

static bool IsSecurable(AttributeMetadata attribute)
{
  return attribute.CanBeSecuredForRead == true || attribute.CanBeSecuredForCreate == true || attribute.CanBeSecuredForUpdate == true;
}

var allAttributes = entity.Attributes?.ToList() ?? new List<AttributeMetadata>();
var securable = allAttributes
  .Where(a => !string.IsNullOrWhiteSpace(a.LogicalName))
  .Where(a => string.IsNullOrWhiteSpace(a.AttributeOf))
  .Where(IsSecurable)
  .ToList();

var pending = securable.Where(a => a.IsSecured != true).ToList();
var alreadySecured = securable.Count - pending.Count;

foreach (var attribute in securable.OrderBy(a => a.LogicalName))
{
  Console.WriteLine(
    $"{attribute.LogicalName} | Type={attribute.AttributeType} | IsSecured={attribute.IsSecured} | Read={attribute.CanBeSecuredForRead == true} | Create={attribute.CanBeSecuredForCreate == true} | Update={attribute.CanBeSecuredForUpdate == true}"
  );
}

Log($"total={allAttributes.Count} securables={securable.Count} jaSeguros={alreadySecured} faltando={pending.Count} dryRun={dryRun}");

if (dryRun || pending.Count == 0)
{
  Log("nada a aplicar");
  return;
}

var updated = new List<string>();
var failed = new List<(string LogicalName, string Message)>();
int index = 0;

foreach (var attribute in pending)
{
  index++;
  try
  {
    attribute.IsSecured = true;
    var update = new UpdateAttributeRequest
    {
      EntityName = tableLogicalName,
      Attribute = attribute,
      MergeLabels = false
    };

    ExecuteWithRetry(service, update, response => response, $"UpdateAttribute {attribute.LogicalName}");
    updated.Add(attribute.LogicalName!);
    Log($"{index}/{pending.Count} ok -> {attribute.LogicalName}");
  }
  catch (Exception ex)
  {
    failed.Add((attribute.LogicalName ?? "<sem-nome>", ex.Message));
    Log($"{index}/{pending.Count} falhou -> {attribute.LogicalName}");
  }
}

if (updated.Count > 0)
{
  Log($"publish {tableLogicalName}");
  var publish = new PublishXmlRequest
  {
    ParameterXml = $"<importexportxml><entities><entity>{tableLogicalName}</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>"
  };
  ExecuteWithRetry(service, publish, response => response, $"PublishXml {tableLogicalName}");
}

var verifyResponse = ExecuteWithRetry(service, retrieve, response => (RetrieveEntityResponse)response, $"RetrieveEntity verify {tableLogicalName}");
var verifyEntity = verifyResponse.EntityMetadata ?? throw new InvalidOperationException("Falha ao reler metadata.");
var verifyPending = (verifyEntity.Attributes ?? Array.Empty<AttributeMetadata>())
  .Where(a => !string.IsNullOrWhiteSpace(a.LogicalName))
  .Where(a => string.IsNullOrWhiteSpace(a.AttributeOf))
  .Where(IsSecurable)
  .Where(a => a.IsSecured != true)
  .Select(a => a.LogicalName!)
  .OrderBy(name => name)
  .ToList();

Console.WriteLine();
Console.WriteLine($"tabela={tableLogicalName}");
Console.WriteLine($"atualizados={updated.Count}");
Console.WriteLine($"falhas={failed.Count}");
Console.WriteLine($"restantesNaoSeguros={verifyPending.Count}");

if (failed.Count > 0)
{
  Console.WriteLine();
  Console.WriteLine("falhas:");
  foreach (var item in failed)
  {
    Console.WriteLine($"- {item.LogicalName}: {item.Message}");
  }
}

if (verifyPending.Count > 0)
{
  Console.WriteLine();
  Console.WriteLine("ainda nao securizados:");
  foreach (var logicalName in verifyPending)
  {
    Console.WriteLine($"- {logicalName}");
  }
}
else
{
  Log("feito: todos atributos securables estao com IsSecured=true");
}
"@

Set-Content -Path $projectFile -Value $csproj -Encoding UTF8
Set-Content -Path $programFile -Value $program -Encoding UTF8

$arguments = @(
  "run",
  "--project", $projectFile,
  "--", $EnvironmentUrl, $TableLogicalName
)

if ($DryRun) {
  $arguments += "--dry-run"
}

Write-Step "dotnet restore/build/run"
& dotnet @arguments

if ($LASTEXITCODE -ne 0) {
  throw "dotnet run falhou com exit code $LASTEXITCODE"
}
