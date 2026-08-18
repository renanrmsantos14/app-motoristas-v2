[CmdletBinding()]
param(
  [string] $EnvironmentUrl = "https://org23b93544.crm2.dynamics.com/"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module MSAL.PS -ErrorAction Stop
$baseUrl = $EnvironmentUrl.TrimEnd("/")
$api = "$baseUrl/api/data/v9.2"
$client = New-MsalClientApplication -ClientId "51f81489-12ee-4a9e-aaae-a2591f45987d" -TenantId "organizations" -RedirectUri ([Uri]"http://localhost")
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
$token = Get-MsalToken -PublicClientApplication $client -Scopes "$baseUrl/user_impersonation" -Silent
$headers = @{ Authorization = "Bearer $($token.AccessToken)"; Accept = "application/json"; "Content-Type" = "application/json" }

function Write-Case([string] $Name) { Write-Host "[exchange-operational-e2e] $Name OK" }
function Version($Record) { ([string]$Record.'@odata.etag').Replace('W/', '').Replace('"', '') }
function Get-ErrorDetail($ErrorRecord) { ([string]$ErrorRecord.ErrorDetails.Message + " " + [string]$ErrorRecord.Exception.Message) }
function Assert-Fails([string] $Name, [string] $Pattern, [scriptblock] $Action) {
  try { & $Action; throw "$Name foi aceito indevidamente." }
  catch {
    $detail = Get-ErrorDetail $_
    if ($detail -notmatch $Pattern) { throw "$Name falhou de forma inesperada. esperado=$Pattern; detalhe=$detail" }
    Write-Case $Name
  }
}
function Invoke-Get([string] $Path) { Invoke-RestMethod -Method Get -Uri "$api/$Path" -Headers $headers }
function Invoke-Bound([guid] $Id, [string] $Action, [hashtable] $Payload, [hashtable] $RequestHeaders = $headers) {
  Invoke-RestMethod -Method Post -Uri "$api/cr40f_trocasdecarros($Id)/Microsoft.Dynamics.CRM.$Action" -Headers $RequestHeaders -Body ($Payload | ConvertTo-Json -Depth 8)
}
function Get-Exchange([guid] $Id) {
  Invoke-Get "cr40f_trocasdecarros($Id)?`$select=cr40f_id,cr40f_statusdatroca,new_tipodetroca,new_concluidomotorista1,new_concluidomotorista2,new_revertida,_cr40f_motorista1_value,_cr40f_motorista2_value,_cr40f_veiculo1antesdatroca_value,_cr40f_veiculo2antesdatroca_value,cr40f_iniciodajaneladetroca,cr40f_fimdajaneladetroca"
}
function Get-OpenPossessions {
  @((Invoke-Get "new_possedeveiculos?`$select=new_possedeveiculoid,_new_motorista_value,_new_veiculo_value,new_iniciodaposse&`$filter=new_fimdaposse eq null").value)
}
function New-Reference([string] $Type, [string] $IdName, [guid] $Id) {
  @{ '@odata.type' = "Microsoft.Dynamics.CRM.$Type"; $IdName = [string]$Id }
}
function New-RegisterPayload(
  [int] $Type,
  [guid] $Driver1,
  [Nullable[guid]] $Driver2,
  [Nullable[guid]] $Vehicle1,
  [Nullable[guid]] $Vehicle2,
  [bool] $Programmed = $false,
  [bool] $CompleteImmediately = $false,
  [string] $Reason = "Matriz operacional E2E"
) {
  $start = [DateTime]::UtcNow.AddSeconds(-3)
  @{
    new_Motivo = $Reason
    new_DataEfetiva = $null
    new_Inicio = $start.ToString('o')
    new_Fim = $start.AddHours(1).ToString('o')
    new_Tipo = $Type
    new_Motorista1 = New-Reference 'cr40f_funcionarios' 'cr40f_funcionariosid' $Driver1
    new_Motorista2 = if ($null -ne $Driver2) { New-Reference 'cr40f_funcionarios' 'cr40f_funcionariosid' ([guid]$Driver2) } else { $null }
    new_Veiculo1 = if ($null -ne $Vehicle1) { New-Reference 'cr40f_veiculos' 'cr40f_veiculosid' ([guid]$Vehicle1) } else { $null }
    new_Veiculo2 = if ($null -ne $Vehicle2) { New-Reference 'cr40f_veiculos' 'cr40f_veiculosid' ([guid]$Vehicle2) } else { $null }
    new_Observacao = "Teste descartável de operação"
    new_ConcluirImediatamente = $CompleteImmediately
    new_ProgramarAutomaticamente = $Programmed
    new_IdempotencyKey = "operational-e2e-" + [guid]::NewGuid().ToString('N')
  }
}
function Register([hashtable] $Payload) {
  $result = Invoke-RestMethod -Method Post -Uri "$api/new_RegistrarTrocaDeCarro" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 8)
  [guid]$result.new_TrocaId
}
function Complete([guid] $Id, [Nullable[DateTime]] $EffectiveAt = $null) {
  $record = Get-Exchange $Id
  $payload = @{ new_Motivo = "Conclusão manual E2E"; new_VersaoEsperada = Version $record; new_DataEfetiva = if ($null -ne $EffectiveAt) { ([DateTime]$EffectiveAt).ToUniversalTime().ToString('o') } else { $null } }
  Invoke-Bound $Id 'new_ConcluirTrocaDeCarro' $payload | Out-Null
}
function Cancel([guid] $Id) {
  $record = Get-Exchange $Id
  Invoke-Bound $Id 'new_CancelarTrocaDeCarro' @{ new_Motivo = "Cancelamento de limpeza E2E"; new_VersaoEsperada = Version $record } | Out-Null
}
function Revert([guid] $Id) {
  Start-Sleep -Milliseconds 1100
  $record = Get-Exchange $Id
  Invoke-Bound $Id 'new_ReverterTrocaDeCarro' @{ new_Motivo = "Reversão E2E"; new_VersaoEsperada = Version $record; new_DataEfetiva = [DateTime]::UtcNow.ToString('o') }
}
function Assert-OpenPair([guid] $Driver, [guid] $Vehicle, [string] $Name) {
  $matches = @(Get-OpenPossessions | Where-Object { $_._new_motorista_value -eq $Driver -and $_._new_veiculo_value -eq $Vehicle })
  if ($matches.Count -ne 1) { throw "${Name}: esperado exatamente um vínculo aberto motorista/veículo; atual=$($matches.Count)." }
}
function Assert-BaseVehicle([guid] $Vehicle, [string] $Name) {
  $matches = @(Get-OpenPossessions | Where-Object { -not $_._new_motorista_value -and $_._new_veiculo_value -eq $Vehicle })
  if ($matches.Count -ne 1) { throw "${Name}: esperado exatamente uma posse-base aberta; atual=$($matches.Count)." }
}

# Recupera execuções anteriores interrompidas sem tocar em trocas que não pertencem a esta matriz.
$orphans = @((Invoke-Get "cr40f_trocasdecarros?`$select=cr40f_trocasdecarroid&`$filter=startswith(new_idempotencykey,'operational-e2e-') and (cr40f_statusdatroca eq 202410000 or cr40f_statusdatroca eq 100000001)").value)
foreach ($orphan in $orphans) {
  Cancel ([guid]$orphan.cr40f_trocasdecarroid)
}
if ($orphans.Count -gt 0) { Write-Case "LIMPEZA DE $($orphans.Count) EXECUÇÃO(ÕES) INTERROMPIDA(S)" }

# Descobre dois pares íntegros que também possuem identidade ativa para confirmar como motoristas.
$activeUsers = @((Invoke-Get "systemusers?`$select=systemuserid,internalemailaddress&`$filter=isdisabled eq false and internalemailaddress ne null").value)
$pairs = @()
foreach ($possession in @(Get-OpenPossessions | Where-Object { $_._new_motorista_value })) {
  $driverId = [guid]$possession._new_motorista_value
  $employee = Invoke-Get "cr40f_funcionarioses($driverId)?`$select=cr40f_emailmicrosoft"
  $matches = @($activeUsers | Where-Object { [string]::Equals([string]$_.internalemailaddress, [string]$employee.cr40f_emailmicrosoft, [StringComparison]::OrdinalIgnoreCase) })
  if ($matches.Count -eq 1) {
    $pairs += [pscustomobject]@{ Driver = $driverId; Vehicle = [guid]$possession._new_veiculo_value; User = [guid]$matches[0].systemuserid }
  }
}
if ($pairs.Count -lt 2) { throw "Matriz bloqueada: são necessários dois pares de posse com systemuser ativo e único." }
$pair1 = $pairs[0]
$pair2 = @($pairs | Where-Object { $_.Driver -ne $pair1.Driver -and $_.Vehicle -ne $pair1.Vehicle })[0]
if ($null -eq $pair2) { throw "Matriz bloqueada: não existem dois pares distintos de motorista/veículo." }
$occupiedDrivers = @(Get-OpenPossessions | Where-Object { $_._new_motorista_value } | ForEach-Object { [guid]$_._new_motorista_value })
$activeEmployees = @((Invoke-Get "cr40f_funcionarioses?`$select=cr40f_funcionariosid&`$filter=statecode eq 0 and cr40f_datadedemissao eq null&`$top=200").value)
$transferReceiver = @($activeEmployees | Where-Object { [guid]$_.cr40f_funcionariosid -notin $occupiedDrivers -and [guid]$_.cr40f_funcionariosid -ne $pair1.Driver })[0]
if ($null -eq $transferReceiver) { throw "Matriz bloqueada: não existe funcionário ativo sem posse para testar transferência." }
$transferReceiverId = [guid]$transferReceiver.cr40f_funcionariosid

# Entradas obrigatórias e erros de usuário antes de qualquer mutação.
$valid = New-RegisterPayload 100000001 $pair1.Driver $null $pair1.Vehicle $null
$missingReason = $valid.Clone(); $missingReason.new_Motivo = " "
Assert-Fails 'MOTIVO VAZIO NO REGISTRO' 'Informe o motivo' { Register $missingReason | Out-Null }
$longReason = $valid.Clone(); $longReason.new_Motivo = 'x' * 2001
Assert-Fails 'MOTIVO ACIMA DE 2000' '2.000' { Register $longReason | Out-Null }
$missingKey = $valid.Clone(); $missingKey.new_IdempotencyKey = " "
Assert-Fails 'IDEMPOTÊNCIA AUSENTE' 'chave de idempot' { Register $missingKey | Out-Null }
$longKey = $valid.Clone(); $longKey.new_IdempotencyKey = 'k' * 101
Assert-Fails 'IDEMPOTÊNCIA ACIMA DE 100' 'Chave de idempot' { Register $longKey | Out-Null }

# Troca aberta: versão obrigatória, janela inválida, reversão indevida e cancelamento após confirmação parcial.
$openId = Register (New-RegisterPayload 100000000 $pair1.Driver $pair2.Driver $pair1.Vehicle $pair2.Vehicle $true)
$open = Get-Exchange $openId
$driver1Headers = $headers.Clone(); $driver1Headers['MSCRMCallerID'] = [string]$pair1.User
Assert-Fails 'UPDATE SEM ROWVERSION' 'EXCHANGE_VERSION_REQUIRED' { Invoke-Bound $openId 'new_AtualizarTrocaDeCarro' @{ new_Motivo='erro'; new_Inicio=[DateTime]::UtcNow.ToString('o'); new_Fim=[DateTime]::UtcNow.AddHours(1).ToString('o'); new_Observacao='x' } | Out-Null }
Assert-Fails 'CONFIRMAR SEM ROWVERSION' 'EXCHANGE_VERSION_REQUIRED' { Invoke-Bound $openId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='erro' } $driver1Headers | Out-Null }
Assert-Fails 'CONCLUIR SEM ROWVERSION' 'EXCHANGE_VERSION_REQUIRED' { Invoke-Bound $openId 'new_ConcluirTrocaDeCarro' @{ new_Motivo='erro'; new_DataEfetiva=$null } | Out-Null }
Assert-Fails 'CANCELAR SEM ROWVERSION' 'EXCHANGE_VERSION_REQUIRED' { Invoke-Bound $openId 'new_CancelarTrocaDeCarro' @{ new_Motivo='erro' } | Out-Null }
Assert-Fails 'UPDATE SEM MOTIVO' 'Informe o motivo' { Invoke-Bound $openId 'new_AtualizarTrocaDeCarro' @{ new_Motivo=' '; new_VersaoEsperada=Version $open; new_Inicio=[DateTime]::UtcNow.ToString('o'); new_Fim=[DateTime]::UtcNow.AddHours(1).ToString('o'); new_Observacao='x' } | Out-Null }
Assert-Fails 'CONFIRMAR SEM MOTIVO' 'Informe o motivo' { Invoke-Bound $openId 'new_ConfirmarTrocaMotorista' @{ new_Motivo=' '; new_VersaoEsperada=Version $open } $driver1Headers | Out-Null }
Assert-Fails 'CONCLUIR SEM MOTIVO' 'Informe o motivo' { Invoke-Bound $openId 'new_ConcluirTrocaDeCarro' @{ new_Motivo=' '; new_VersaoEsperada=Version $open; new_DataEfetiva=$null } | Out-Null }
Assert-Fails 'CANCELAR SEM MOTIVO' 'Informe o motivo' { Invoke-Bound $openId 'new_CancelarTrocaDeCarro' @{ new_Motivo=' '; new_VersaoEsperada=Version $open } | Out-Null }
Assert-Fails 'REVERTER SEM MOTIVO' 'Informe o motivo' { Invoke-Bound $openId 'new_ReverterTrocaDeCarro' @{ new_Motivo=' '; new_VersaoEsperada=Version $open; new_DataEfetiva=$null } | Out-Null }
Assert-Fails 'UPDATE JANELA ZERO' 'EXCHANGE_INVALID_WINDOW' { Invoke-Bound $openId 'new_AtualizarTrocaDeCarro' @{ new_Motivo='erro'; new_VersaoEsperada=Version $open; new_Inicio=[DateTime]::UtcNow.ToString('o'); new_Fim=[DateTime]::UtcNow.ToString('o'); new_Observacao='x' } | Out-Null }
Assert-Fails 'REVERTER TROCA ABERTA' 'Somente troca concluida' { Invoke-Bound $openId 'new_ReverterTrocaDeCarro' @{ new_Motivo='erro'; new_VersaoEsperada=Version $open; new_DataEfetiva=$null } | Out-Null }
Invoke-Bound $openId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='confirmação parcial'; new_VersaoEsperada=Version $open } $driver1Headers | Out-Null
$partial = Get-Exchange $openId
if (-not [bool]$partial.new_concluidomotorista1 -or [bool]$partial.new_concluidomotorista2) { throw 'Confirmação parcial não preservou somente o motorista 1.' }
Write-Case 'CONFIRMAÇÃO PARCIAL'
Invoke-Bound $openId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='confirmação repetida'; new_VersaoEsperada=Version $partial } $driver1Headers | Out-Null
$partialRepeated = Get-Exchange $openId
if ([int]$partialRepeated.cr40f_statusdatroca -eq 202410001 -or -not [bool]$partialRepeated.new_concluidomotorista1 -or [bool]$partialRepeated.new_concluidomotorista2) { throw 'Confirmação repetida alterou indevidamente o ciclo.' }
Write-Case 'CONFIRMAÇÃO REPETIDA DO MESMO MOTORISTA'
Cancel $openId
$canceled = Get-Exchange $openId
if ([int]$canceled.cr40f_statusdatroca -ne 202410002 -or [bool]$canceled.new_concluidomotorista1 -or [bool]$canceled.new_concluidomotorista2) { throw 'Cancelamento não limpou confirmações parciais.' }
Write-Case 'CANCELAR APÓS CONFIRMAÇÃO PARCIAL'
Invoke-Bound $openId 'new_CancelarTrocaDeCarro' @{ new_Motivo='cancelamento repetido'; new_VersaoEsperada=Version $canceled } | Out-Null
Write-Case 'CANCELAMENTO REPETIDO COM VERSÃO ATUAL'
Assert-Fails 'CONCLUIR CANCELADA' 'Troca cancelada' { Complete $openId }
Assert-Fails 'REVERTER CANCELADA' 'Somente troca concluida' { Revert $openId | Out-Null }

# Erros estruturais que só podem aparecer no momento da efetivação; cada tentativa deve fazer rollback integral.
$sameDriverId = Register (New-RegisterPayload 100000000 $pair1.Driver $pair1.Driver $pair1.Vehicle $pair2.Vehicle)
Assert-Fails 'TROCA COM MESMO MOTORISTA' 'EXCHANGE_VALIDATION_ERROR' { Complete $sameDriverId }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback mesmo motorista'
Cancel $sameDriverId
$sameVehicleId = Register (New-RegisterPayload 100000000 $pair1.Driver $pair2.Driver $pair1.Vehicle $pair1.Vehicle)
Assert-Fails 'TROCA COM MESMO VEÍCULO' 'EXCHANGE_VALIDATION_ERROR' { Complete $sameVehicleId }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback mesmo veículo motorista1'
Assert-OpenPair $pair2.Driver $pair2.Vehicle 'rollback mesmo veículo motorista2'
Cancel $sameVehicleId
$wrongVehicleId = Register (New-RegisterPayload 100000001 $pair1.Driver $null $pair2.Vehicle $null)
Assert-Fails 'DEVOLUÇÃO DE VEÍCULO DIVERGENTE' 'EXCHANGE_VALIDATION_ERROR' { Complete $wrongVehicleId }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback veículo divergente'
Cancel $wrongVehicleId
$takeWhileAssignedId = Register (New-RegisterPayload 100000002 $pair1.Driver $null $null $pair2.Vehicle)
Assert-Fails 'RETIRADA PARA MOTORISTA QUE JÁ POSSUI VEÍCULO' 'EXCHANGE_VALIDATION_ERROR' { Complete $takeWhileAssignedId }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback retirada inválida'
Cancel $takeWhileAssignedId
$futureId = Register (New-RegisterPayload 100000001 $pair1.Driver $null $pair1.Vehicle $null)
Assert-Fails 'CONCLUSÃO COM HORÁRIO FUTURO' 'no futuro' { Complete $futureId ([DateTime]::UtcNow.AddMinutes(5)) }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback data futura'
Cancel $futureId
Assert-Fails 'TIPO DE TROCA INVÁLIDO' 'EXCHANGE_VALIDATION_ERROR' { Register (New-RegisterPayload 999999999 $pair1.Driver $null $pair1.Vehicle $null) | Out-Null }
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'rollback tipo inválido'

# A opção pública de concluir na criação deve ser atômica e deixar uma posse reversível.
$immediateId = Register (New-RegisterPayload 100000001 $pair1.Driver $null $pair1.Vehicle $null $false $true)
$immediate = Get-Exchange $immediateId
if ([int]$immediate.cr40f_statusdatroca -ne 202410001) { throw 'Conclusão imediata não criou a troca concluída.' }
Assert-BaseVehicle $pair1.Vehicle 'conclusão imediata'
Write-Case 'CONCLUSÃO IMEDIATA NA CRIAÇÃO'
Revert $immediateId | Out-Null
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'reversão conclusão imediata'
Write-Case 'REVERSÃO DA CONCLUSÃO IMEDIATA'

# Devolução e retirada manuais em sequência, seguidas das reversões em ordem inversa.
$returnId = Register (New-RegisterPayload 100000001 $pair1.Driver $null $pair1.Vehicle $null)
$nonParticipantHeaders = $headers.Clone(); $nonParticipantHeaders['MSCRMCallerID'] = [string]$pair2.User
$returnOpen = Get-Exchange $returnId
Assert-Fails 'CONFIRMAÇÃO POR USUÁRIO NÃO AUTORIZADO' '(FORBIDDEN_LIFECYCLE|IDENTITY_NOT_MAPPED)' { Invoke-Bound $returnId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='não participante'; new_VersaoEsperada=Version $returnOpen } $nonParticipantHeaders | Out-Null }
Complete $returnId
Assert-BaseVehicle $pair1.Vehicle 'devolução manual'
Write-Case 'DEVOLUÇÃO MANUAL PARA BASE'
$returnCompleted = Get-Exchange $returnId
Assert-Fails 'EDITAR TROCA CONCLUÍDA' 'FORBIDDEN_LIFECYCLE' { Invoke-Bound $returnId 'new_AtualizarTrocaDeCarro' @{ new_Motivo='erro'; new_VersaoEsperada=Version $returnCompleted; new_Inicio=[DateTime]::UtcNow.ToString('o'); new_Fim=[DateTime]::UtcNow.AddHours(1).ToString('o'); new_Observacao='x' } | Out-Null }
Assert-Fails 'CANCELAR TROCA CONCLUÍDA' 'Use Reverter' { Invoke-Bound $returnId 'new_CancelarTrocaDeCarro' @{ new_Motivo='erro'; new_VersaoEsperada=Version $returnCompleted } | Out-Null }
$takeId = Register (New-RegisterPayload 100000002 $pair1.Driver $null $null $pair1.Vehicle)
Complete $takeId
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'retirada manual'
Write-Case 'RETIRADA MANUAL DA BASE'
$firstCompensation = Revert $takeId
Assert-BaseVehicle $pair1.Vehicle 'reversão retirada'
$takeAfterRevert = Get-Exchange $takeId
$secondCompensation = Invoke-Bound $takeId 'new_ReverterTrocaDeCarro' @{ new_Motivo='repetição'; new_VersaoEsperada=Version $takeAfterRevert; new_DataEfetiva=[DateTime]::UtcNow.ToString('o') }
if ([guid]$firstCompensation.new_TrocaCompensatoriaId -ne [guid]$secondCompensation.new_TrocaCompensatoriaId) { throw 'Reversão repetida criou compensações diferentes.' }
Write-Case 'REVERSÃO IDEMPOTENTE'
Revert $returnId | Out-Null
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'restauração devolução'
Write-Case 'REVERSÃO DEVOLUÇÃO E RESTAURAÇÃO'

# Troca real entre dois motoristas: duas confirmações, efetivação automática, inversão e restauração.
$swapId = Register (New-RegisterPayload 100000000 $pair1.Driver $pair2.Driver $pair1.Vehicle $pair2.Vehicle $true)
$swap = Get-Exchange $swapId
$h1 = $headers.Clone(); $h1['MSCRMCallerID'] = [string]$pair1.User
$h2 = $headers.Clone(); $h2['MSCRMCallerID'] = [string]$pair2.User
Invoke-Bound $swapId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='motorista 1'; new_VersaoEsperada=Version $swap } $h1 | Out-Null
$afterFirst = Get-Exchange $swapId
if ([int]$afterFirst.cr40f_statusdatroca -eq 202410001) { throw 'Troca concluiu antes da segunda confirmação.' }
Invoke-Bound $swapId 'new_ConfirmarTrocaMotorista' @{ new_Motivo='motorista 2'; new_VersaoEsperada=Version $afterFirst } $h2 | Out-Null
$afterSecond = Get-Exchange $swapId
if ([int]$afterSecond.cr40f_statusdatroca -ne 202410001) { throw 'Troca não concluiu após as duas confirmações.' }
Assert-OpenPair $pair1.Driver $pair2.Vehicle 'troca motorista1'
Assert-OpenPair $pair2.Driver $pair1.Vehicle 'troca motorista2'
Write-Case 'TROCA COM DUAS CONFIRMAÇÕES'
Revert $swapId | Out-Null
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'reversão troca motorista1'
Assert-OpenPair $pair2.Driver $pair2.Vehicle 'reversão troca motorista2'
Write-Case 'REVERSÃO DA TROCA ENTRE MOTORISTAS'

# Transferência de um veículo para motorista sem posse e compensação de volta ao titular original.
$transferId = Register (New-RegisterPayload 100000000 $pair1.Driver $transferReceiverId $pair1.Vehicle $null)
Complete $transferId
Assert-OpenPair $transferReceiverId $pair1.Vehicle 'transferência sem veículo anterior'
Write-Case 'TRANSFERÊNCIA PARA MOTORISTA SEM VEÍCULO'
Revert $transferId | Out-Null
Assert-OpenPair $pair1.Driver $pair1.Vehicle 'reversão transferência'
$receiverPossessions = @(Get-OpenPossessions | Where-Object { $_._new_motorista_value -eq $transferReceiverId })
if ($receiverPossessions.Count -ne 0) { throw 'Reversão da transferência deixou posse aberta no recebedor.' }
Write-Case 'REVERSÃO DA TRANSFERÊNCIA'

Write-Host "[exchange-operational-e2e] MATRIZ OPERACIONAL COMPLETA OK"
