param([string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/")

$ErrorActionPreference = "Stop"
$baseUrl = $EnvironmentUrl.TrimEnd("/")
Import-Module MSAL.PS -ErrorAction Stop
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri] "http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = (Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent).AccessToken
if (-not $token) { throw "Token DEV indisponivel." }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json" }
$api = "$baseUrl/api/data/v9.2"

function Read-Dv([string] $Path) { return Invoke-RestMethod -Method Get -Uri "$api/$Path" -Headers $headers }

$driver = Read-Dv "EntityDefinitions(LogicalName='cr40f_funcionarios')?`$select=LogicalName,EntitySetName,OwnershipType"
Write-Output "Driver table: $($driver.LogicalName), set=$($driver.EntitySetName), ownership=$($driver.OwnershipType)"
foreach ($name in @("cr40f_nomecompleto", "cr40f_emailmicrosoft", "cr40f_status", "cr40f_tipodevinculo")) {
  $attribute = Read-Dv "EntityDefinitions(LogicalName='cr40f_funcionarios')/Attributes(LogicalName='$name')?`$select=LogicalName,AttributeType"
  Write-Output "Driver attribute: $($attribute.LogicalName), type=$($attribute.AttributeType)"
}
foreach ($name in @("cr40f_status", "cr40f_tipodevinculo")) {
  $choice = Read-Dv "EntityDefinitions(LogicalName='cr40f_funcionarios')/Attributes(LogicalName='$name')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet(`$select=Options)"
  $options = @($choice.OptionSet.Options | ForEach-Object { "$( $_.Value ):$( ($_.Label.LocalizedLabels | Where-Object LanguageCode -eq 1046 | Select-Object -First 1).Label )" })
  Write-Output "Driver choice $name : $($options -join ', ')"
}
foreach ($name in @("new_comunicadomotorista", "new_comunicadodestinatario")) {
  $result = Read-Dv "EntityDefinitions?`$select=LogicalName,EntitySetName,OwnershipType&`$filter=LogicalName eq '$name'"
  Write-Output "New table $name : $(@($result.value).Count) existing"
}
$solution = Read-Dv "solutions?`$select=solutionid,ismanaged&`$filter=uniquename eq 'AppBetinhos'"
Write-Output "Solution AppBetinhos : $(@($solution.value).Count) existing; unmanaged=$(@($solution.value | Where-Object { -not $_.ismanaged }).Count)"
$assembly = Read-Dv "pluginassemblies?`$select=name&`$filter=name eq 'Betinhos.DriverRecordSharing'"
Write-Output "Plugin assembly Betinhos.DriverRecordSharing : $(@($assembly.value).Count) existing"
$roles = Read-Dv "roles?`$select=name,roleid&`$filter=contains(name,'Motorista') or contains(name,'motorista')"
foreach ($role in @($roles.value)) { Write-Output "Driver role: $($role.name), id=$($role.roleid)" }
$privileges = Read-Dv "privileges?`$select=name,privilegeid&`$filter=contains(name,'new_comunicado') or contains(name,'new_Comunicado')"
foreach ($privilege in @($privileges.value)) { Write-Output "Comunicado privilege: $($privilege.name), id=$($privilege.privilegeid)" }
$apis = Read-Dv "customapis?`$select=uniquename,executeprivilegename&`$filter=contains(uniquename,'Comunicado')"
foreach ($customApi in @($apis.value)) { Write-Output "Comunicado API: $($customApi.uniquename), privilege=$($customApi.executeprivilegename)" }
$apps = Read-Dv "appmodules?`$select=appmoduleid,name,uniquename&`$filter=contains(name,'Betinhos') or contains(name,'Motorista')"
foreach ($app in @($apps.value)) { Write-Output "Power App: $($app.name), unique=$($app.uniquename), id=$($app.appmoduleid)" }
$connections = Read-Dv "connectionreferences?`$select=connectionreferencedisplayname,connectorid&`$filter=contains(connectorid,'powerappsnotificationv2')"
Write-Output "Notification V2 connection references: $(@($connections.value).Count)"
foreach ($connection in @($connections.value)) { Write-Output "Notification V2 reference: $($connection.connectionreferencedisplayname)" }
$flows = Read-Dv "workflows?`$select=name,workflowid,category,statecode&`$filter=contains(name,'Comunicado')"
foreach ($flow in @($flows.value)) { Write-Output "Comunicado flow: $($flow.name), category=$($flow.category), state=$($flow.statecode)" }
$notificationFlows = Read-Dv "workflows?`$select=name,workflowid,category,statecode&`$filter=contains(name,'Push') or contains(name,'Notifica')"
foreach ($flow in @($notificationFlows.value)) { Write-Output "Notification flow: $($flow.name), category=$($flow.category), state=$($flow.statecode)" }
