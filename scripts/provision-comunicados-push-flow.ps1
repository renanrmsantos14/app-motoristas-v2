param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/",
  [switch] $Apply
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$api = "$baseUrl/api/data/v9.2"
$flowName = "Flow Push Comunicados | Motoristas"
$solutionName = "AppBetinhos"
Import-Module MSAL.PS -ErrorAction Stop
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = (Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent).AccessToken
if (-not $token) { throw "Token DEV indisponivel." }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; "MSCRM.SolutionUniqueName" = $solutionName }
function Read-Dv([string] $Path) { return Invoke-RestMethod -Method Get -Uri "$api/$Path" -Headers $headers }
function Write-Dv([string] $Method, [string] $Path, $Payload) {
  $body = $Payload | ConvertTo-Json -Depth 80 -Compress
  $writeHeaders = $headers.Clone()
  if ($Method -eq "PATCH") { $writeHeaders["If-Match"] = "*" }
  try { return Invoke-RestMethod -Method $Method -Uri "$api/$Path" -Headers $writeHeaders -ContentType "application/json; charset=utf-8" -Body $body }
  catch {
    $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    throw "Dataverse $Method $Path falhou: $detail"
  }
}

$existing = @((Read-Dv "workflows?`$select=workflowid,name,statecode,clientdata&`$filter=name eq '$flowName' and category eq 5").value)
if ($existing.Count -gt 1) { throw "Flow de comunicados duplicado." }
$source = @((Read-Dv "workflows?`$select=name,clientdata&`$filter=contains(name,'Novo Servi') and contains(name,'Motoristas') and category eq 5").value)
if ($source.Count -ne 1) { throw "Flow de push de motorista existente nao encontrado de forma unica." }
$sourceData = $source[0].clientdata | ConvertFrom-Json
$dvReference = $sourceData.properties.connectionReferences.shared_commondataserviceforapps
$pushReference = $sourceData.properties.connectionReferences.'shared_powerappsnotificationv2-1'
if (-not $dvReference.connection.connectionReferenceLogicalName -or -not $pushReference.connection.connectionReferenceLogicalName) { throw "Referencias de conexao ausentes." }
$app = @((Read-Dv "appmodules?`$select=appmoduleid,name&`$filter=uniquename eq 'new_AppMotoristasv2'").value)
if ($app.Count -ne 1) { throw "App Motoristas v2 ausente ou duplicado." }
$solution = @((Read-Dv "solutions?`$select=solutionid,ismanaged&`$filter=uniquename eq '$solutionName'").value)
if ($solution.Count -ne 1 -or $solution[0].ismanaged) { throw "Solucao AppBetinhos ausente ou gerenciada." }

$dvHost = @{ apiId = "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps"; connectionName = "shared_commondataserviceforapps" }
$pushHost = @{ apiId = "/providers/Microsoft.PowerApps/apis/shared_powerappsnotificationv2"; connectionName = "shared_powerappsnotificationv2-1"; operationId = "SendPushNotificationV2" }
$auth = '@parameters(''$authentication'')'
$triggerName = if ($existing.Count -eq 1 -and $existing[0].clientdata) {
  $previous = $existing[0].clientdata | ConvertFrom-Json
  [string]$previous.properties.definition.triggers.When_recipient_is_added_or_retried.inputs.parameters.'subscriptionRequest/name'
} else { "$( [guid]::NewGuid() ):MTA" }
if (-not $triggerName) { $triggerName = "$( [guid]::NewGuid() ):MTA" }
$trigger = @{
  type = "OpenApiConnectionWebhook"
  inputs = @{
    host = $dvHost + @{ operationId = "SubscribeWebhookTrigger" }
    parameters = @{
      "subscriptionRequest/message" = 4
      "subscriptionRequest/entityname" = "new_comunicadodestinatario"
      "subscriptionRequest/scope" = 4
      "subscriptionRequest/filteringattributes" = "new_pushstatus"
      "subscriptionRequest/filterexpression" = "new_pushstatus eq 100000000"
      "subscriptionRequest/name" = $triggerName
    }
    authentication = $auth
  }
}
$getOwner = @{
  type = "OpenApiConnection"
  runAfter = @{}
  inputs = @{
    host = $dvHost + @{ operationId = "GetItem" }
    parameters = @{ entityName = "systemusers"; recordId = "@triggerOutputs()?['body/_ownerid_value']" }
    authentication = $auth
  }
}
$push = @{
  type = "OpenApiConnection"
  runAfter = @{ Get_owner = @("Succeeded") }
  inputs = @{
    host = $pushHost
    parameters = @{
      "payload/playerType" = "PowerApps"
      "payload/app" = (@{ appIdentifier = [string]$app[0].appmoduleid; displayName = "App Motoristas v2"; type = "AppModule" } | ConvertTo-Json -Compress)
      "payload/recipients" = @("@outputs('Get_owner')?['body/internalemailaddress']")
      "payload/message" = "Novo comunicado da operacao: @{triggerOutputs()?['body/new_titulo']}"
      "payload/openApp" = $true
      "payload/dynamicParams" = @{ entityLogicalName = "new_comunicadodestinatario" }
    }
    authentication = $auth
  }
}
function UpdateStatus([int] $Status, [string] $ErrorMessage, [string[]] $RunStates) {
  return @{
    type = "OpenApiConnection"
    runAfter = @{ Send_push = $RunStates }
    inputs = @{
      host = $dvHost + @{ operationId = "UpdateRecord" }
      parameters = @{
        entityName = "new_comunicadodestinatarios"
        recordId = "@triggerOutputs()?['body/new_comunicadodestinatarioid']"
        "item/new_pushstatus" = $Status
        "item/new_pusherro" = $ErrorMessage
      }
      authentication = $auth
    }
  }
}
$definition = @{
  '$schema' = "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#"
  contentVersion = "1.0.0.0"
  parameters = @{ '$connections' = @{ defaultValue = @{}; type = "Object" }; '$authentication' = @{ defaultValue = @{}; type = "SecureObject" } }
  triggers = @{ When_recipient_is_added_or_retried = $trigger }
  actions = @{
    Get_owner = $getOwner
    Send_push = $push
    Mark_sent = (UpdateStatus 100000001 "" @("Succeeded"))
    Mark_failed = (UpdateStatus 100000002 "Falha no conector. Consulte o historico do Flow." @("Failed", "TimedOut"))
    Mark_owner_failed = @{
      type = "OpenApiConnection"
      runAfter = @{ Get_owner = @("Failed", "TimedOut") }
      inputs = @{
        host = $dvHost + @{ operationId = "UpdateRecord" }
        parameters = @{
          entityName = "new_comunicadodestinatarios"
          recordId = "@triggerOutputs()?['body/new_comunicadodestinatarioid']"
          "item/new_pushstatus" = 100000002
          "item/new_pusherro" = "Nao foi possivel localizar o usuario destinatario."
        }
        authentication = $auth
      }
    }
  }
  outputs = @{}
}
$clientData = @{ properties = @{ connectionReferences = @{ shared_commondataserviceforapps = $dvReference; 'shared_powerappsnotificationv2-1' = $pushReference }; definition = $definition }; schemaVersion = "1.0.0.0" } | ConvertTo-Json -Depth 80 -Compress
if (-not $Apply) {
  Write-Output "DRY RUN: criaria/atualizaria $flowName para App Motoristas v2, com push e resultado por destinatario."
  return
}
if ($existing.Count -eq 0) {
  Write-Dv "POST" "workflows" @{ name = $flowName; category = 5; type = 1; primaryentity = "none"; description = "Push dos comunicados dos motoristas; cada destinatario registra sucesso ou falha."; clientdata = $clientData } | Out-Null
  $existing = @((Read-Dv "workflows?`$select=workflowid,name,statecode&`$filter=name eq '$flowName' and category eq 5").value)
} else {
  Write-Dv "PATCH" "workflows($($existing[0].workflowid))" @{ clientdata = $clientData } | Out-Null
}
if ($existing.Count -ne 1) { throw "Flow nao confirmado apos escrita." }
$id = [guid]$existing[0].workflowid
$component = @((Read-Dv "solutioncomponents?`$select=solutioncomponentid&`$filter=_solutionid_value eq $($solution[0].solutionid) and componenttype eq 29 and objectid eq $id").value)
if ($component.Count -eq 0) { Write-Dv "POST" "AddSolutionComponent" @{ ComponentId = $id; ComponentType = 29; SolutionUniqueName = $solutionName; AddRequiredComponents = $false } | Out-Null }
Write-Dv "PATCH" "workflows($id)" @{ statecode = 1 } | Out-Null
$verified = Read-Dv "workflows($id)?`$select=name,statecode,clientdata"
$verifiedDefinition = ($verified.clientdata | ConvertFrom-Json).properties.definition
if ($verified.statecode -ne 1 -or $verifiedDefinition.triggers.When_recipient_is_added_or_retried.inputs.parameters.'subscriptionRequest/entityname' -ne "new_comunicadodestinatario" -or $verifiedDefinition.actions.Send_push.inputs.host.operationId -ne "SendPushNotificationV2") { throw "Flow criado, mas ativacao ou configuracao divergente." }
Write-Output "Flow de push ativo no DEV e adicionado a solucao: $flowName"
