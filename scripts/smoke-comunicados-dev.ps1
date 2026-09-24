param([string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/")
$ErrorActionPreference = "Stop"
$baseUrl = $EnvironmentUrl.TrimEnd("/")
Import-Module MSAL.PS -ErrorAction Stop
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = (Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent).AccessToken
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0" }
$api = "$baseUrl/api/data/v9.2"
foreach ($case in @(
  @{ Name = "new_DispararComunicadoMotorista"; Key = "new_ComunicadoId" },
  @{ Name = "new_AbrirComunicadoMotorista"; Key = "new_DestinatarioId" },
  @{ Name = "new_RegistrarCienciaComunicado"; Key = "new_DestinatarioId" },
  @{ Name = "new_ReenviarPushComunicado"; Key = "new_DestinatarioId" }
)) {
  $payload = @{}
  $payload[$case.Key] = [guid]::Empty.ToString("D")
  if ($case.Name -eq "new_RegistrarCienciaComunicado") { $payload.new_AssinaturaJson = "[]" }
  try {
    Invoke-RestMethod -Method Post -Uri "$api/$($case.Name)" -Headers $headers -ContentType "application/json; charset=utf-8" -Body ($payload | ConvertTo-Json) | Out-Null
    throw "API $($case.Name) aceitou identificador vazio."
  } catch {
    if ($_.Exception.Message -match "aceitou identificador vazio") { throw }
    $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    if ($detail -notmatch "Identificador do comunicado inv") { throw "API $($case.Name) nao retornou validacao do plugin: $detail" }
    Write-Output "API com plugin ativo: $($case.Name)"
  }
}
$flowName = "Flow Push Comunicados | Motoristas"
$flow = Invoke-RestMethod -Method Get -Uri "$api/workflows?`$select=name,statecode,clientdata&`$filter=name eq '$flowName' and category eq 5" -Headers $headers
if (@($flow.value).Count -ne 1 -or [int]$flow.value[0].statecode -ne 1) { throw "Flow de push ausente, duplicado ou inativo." }
$definition = ($flow.value[0].clientdata | ConvertFrom-Json).properties.definition
if ($definition.triggers.When_recipient_is_added_or_retried.inputs.parameters.'subscriptionRequest/entityname' -ne "new_comunicadodestinatario" -or $definition.actions.Send_push.inputs.host.operationId -ne "SendPushNotificationV2") { throw "Flow de push com contrato inesperado." }
Write-Output "Flow de push ativo: $flowName"
