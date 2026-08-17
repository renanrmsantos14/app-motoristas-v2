using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ExchangeLifecycleCommandHandler
    {
        private readonly IOrganizationService _callerService;
        private readonly IOrganizationService _systemService;
        private readonly ITracingService _tracing;
        private readonly IPluginExecutionContext _context;

        public ExchangeLifecycleCommandHandler(
            IOrganizationService callerService,
            IOrganizationService systemService,
            ITracingService tracing,
            IPluginExecutionContext context)
        {
            _callerService = callerService ?? throw new ArgumentNullException(nameof(callerService));
            _systemService = systemService ?? throw new ArgumentNullException(nameof(systemService));
            _tracing = tracing;
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public void Execute()
        {
            if (_context.MessageName == "new_RegistrarTrocaDeCarro")
            {
                Register();
                return;
            }
            var target = _context.InputParameters[PluginConfig.TargetParameterName] as EntityReference;
            if (target == null || target.LogicalName != PluginConfig.ExchangeTable || target.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException("Troca alvo nao informada.");
            }

            var reason = ReadReason();
            switch (_context.MessageName)
            {
                case "new_ConcluirTrocaDeCarro":
                    Complete(target.Id, reason);
                    return;
                case "new_CancelarTrocaDeCarro":
                    Cancel(target.Id, reason);
                    return;
                case "new_ConfirmarTrocaMotorista":
                    ConfirmDriver(target.Id, reason);
                    return;
                case "new_AtualizarTrocaDeCarro":
                    UpdateExchange(target.Id, reason);
                    return;
                case "new_ReverterTrocaDeCarro":
                    Revert(target.Id, reason);
                    return;
                default:
                    throw new InvalidPluginExecutionException("Comando de troca nao reconhecido.");
            }
        }

        private void UpdateExchange(Guid exchangeId, string reason)
        {
            var current = RetrieveExchange(exchangeId);
            ValidateExpectedVersion(current);
            var status = GetStatus(current);
            if (status != PluginConfig.ExchangeStatusProgrammed && status != PluginConfig.ExchangeStatusConfirmed)
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Somente troca aberta pode ser editada.");
            var start = ReadRequiredDate("new_Inicio");
            var end = ReadRequiredDate("new_Fim");
            if (end <= start) throw new InvalidPluginExecutionException("[EXCHANGE_INVALID_WINDOW] O fim da troca deve ser posterior ao início.");
            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId)
            {
                [PluginConfig.ExchangeStartDate] = start,
                [PluginConfig.ExchangeEndDate] = end,
                [PluginConfig.ExchangeObservation] = ReadOptionalString("new_Observacao")
            };
            UpdateWithConcurrency(_systemService, patch, current);
            _tracing?.Trace("Exchange update accepted exchangeId={0} reasonLength={1}.", exchangeId, reason.Length);
        }

        private void Register()
        {
            var reason = ReadReason();
            var start = ReadRequiredDate("new_Inicio");
            var end = ReadRequiredDate("new_Fim");
            if (end <= start) throw new InvalidPluginExecutionException("[EXCHANGE_INVALID_WINDOW] O fim da troca deve ser posterior ao início.");
            var type = ReadRequiredInt("new_Tipo");
            var driver1 = ReadRequiredReference("new_Motorista1", PluginConfig.EmployeeTable);
            var driver2 = ReadOptionalReference("new_Motorista2", PluginConfig.EmployeeTable);
            var vehicle1 = ReadOptionalReference("new_Veiculo1", PluginConfig.VehicleTable);
            var vehicle2 = ReadOptionalReference("new_Veiculo2", PluginConfig.VehicleTable);
            var observation = ReadOptionalString("new_Observacao");
            var idempotencyKey = ReadOptionalString("new_IdempotencyKey");
            if (string.IsNullOrWhiteSpace(idempotencyKey)) throw new InvalidPluginExecutionException("Informe a chave de idempotência.");
            if (idempotencyKey.Length > 100) throw new InvalidPluginExecutionException("Chave de idempotência inválida.");
            var requestHash = HashRequest(start, end, type, driver1, driver2, vehicle1, vehicle2, observation);
            var existing = FindByIdempotencyKey(idempotencyKey);
            if (existing != null)
            {
                if (!string.Equals(existing.GetAttributeValue<string>(PluginConfig.ExchangeRequestHash), requestHash, StringComparison.Ordinal))
                    throw new InvalidPluginExecutionException("[IDEMPOTENCY_KEY_REUSED] A chave já foi usada com outro conteúdo.");
                _context.OutputParameters["new_TrocaId"] = existing.Id;
                return;
            }

            var exchange = new Entity(PluginConfig.ExchangeTable)
            {
                [PluginConfig.ExchangeStartDate] = start,
                [PluginConfig.ExchangeEndDate] = end,
                [PluginConfig.ExchangeStatus] = new OptionSetValue(ReadOptionalBool("new_ProgramarAutomaticamente")
                    ? PluginConfig.ExchangeStatusProgrammed
                    : PluginConfig.ExchangeStatusConfirmed),
                [PluginConfig.ExchangeType] = new OptionSetValue(type),
                [PluginConfig.ExchangeDriver1Lookup] = driver1,
                [PluginConfig.ExchangeDriver2Lookup] = driver2,
                [PluginConfig.ExchangeVehicle1Lookup] = vehicle1,
                [PluginConfig.ExchangeVehicle2Lookup] = vehicle2,
                [PluginConfig.ExchangeObservation] = observation,
                [PluginConfig.ExchangeIdempotencyKey] = idempotencyKey,
                [PluginConfig.ExchangeRequestHash] = requestHash
            };
            var exchangeId = _systemService.Create(exchange);
            if (ReadOptionalBool("new_ConcluirImediatamente")) Complete(exchangeId, reason);
            _context.OutputParameters["new_TrocaId"] = exchangeId;
        }

        private Entity FindByIdempotencyKey(string key)
        {
            var query = new QueryExpression(PluginConfig.ExchangeTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ExchangePrimaryId, PluginConfig.ExchangeRequestHash),
                TopCount = 2,
                NoLock = false
            };
            query.Criteria.AddCondition(PluginConfig.ExchangeIdempotencyKey, ConditionOperator.Equal, key);
            var rows = _systemService.RetrieveMultiple(query).Entities;
            if (rows.Count > 1) throw new InvalidPluginExecutionException("[IDEMPOTENCY_CORRUPTION] Chave duplicada no servidor.");
            return rows.Count == 1 ? rows[0] : null;
        }

        private static string HashRequest(DateTime start, DateTime end, int type, params object[] values)
        {
            var canonical = string.Join("|", new[] { start.ToUniversalTime().Ticks.ToString(), end.ToUniversalTime().Ticks.ToString(), type.ToString() }
                .Concat(values.Select(value => value is EntityReference reference ? reference.Id.ToString("D") : Convert.ToString(value) ?? string.Empty)));
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical))).Replace("-", string.Empty).ToLowerInvariant();
        }

        private DateTime ReadRequiredDate(string name)
        {
            if (!_context.InputParameters.Contains(name) || !(_context.InputParameters[name] is DateTime value))
                throw new InvalidPluginExecutionException("Parâmetro obrigatório ausente: " + name + ".");
            if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
            return value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
                : value;
        }

        private int ReadRequiredInt(string name)
        {
            if (!_context.InputParameters.Contains(name)) throw new InvalidPluginExecutionException("Parâmetro obrigatório ausente: " + name + ".");
            var option = _context.InputParameters[name] as OptionSetValue;
            return option?.Value ?? Convert.ToInt32(_context.InputParameters[name]);
        }

        private EntityReference ReadRequiredReference(string name, string logicalName)
        {
            var value = ReadOptionalReference(name, logicalName);
            if (value == null) throw new InvalidPluginExecutionException("Parâmetro obrigatório ausente: " + name + ".");
            return value;
        }

        private EntityReference ReadOptionalReference(string name, string logicalName)
        {
            var value = _context.InputParameters.Contains(name) ? _context.InputParameters[name] as EntityReference : null;
            if (value != null && value.LogicalName != logicalName) throw new InvalidPluginExecutionException("Referência inválida: " + name + ".");
            return value;
        }

        private string ReadOptionalString(string name) => _context.InputParameters.Contains(name) ? Convert.ToString(_context.InputParameters[name])?.Trim() : null;
        private bool ReadOptionalBool(string name) => _context.InputParameters.Contains(name) && Convert.ToBoolean(_context.InputParameters[name]);

        private void ConfirmDriver(Guid exchangeId, string observation)
        {
            var exchange = RetrieveExchange(exchangeId);
            ValidateExpectedVersion(exchange);
            var status = GetStatus(exchange);
            if (status != PluginConfig.ExchangeStatusProgrammed && status != PluginConfig.ExchangeStatusConfirmed)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Esta troca não aceita confirmação.");
            }

            var resolver = new DriverResolver(_systemService, _tracing);
            var driver = resolver.ResolveFromUser(new EntityReference(PluginConfig.UserTable, _context.InitiatingUserId));
            if (driver?.EmployeeReference == null)
            {
                throw new InvalidPluginExecutionException("[IDENTITY_NOT_MAPPED] Usuário sem funcionário ativo vinculado.");
            }

            var driver1 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup);
            var driver2 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup);
            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId);
            if (driver1 != null && driver1.Id == driver.EmployeeReference.Id)
            {
                patch[PluginConfig.ExchangeDriver1Completed] = true;
                patch[PluginConfig.ExchangeDriver1Observation] = observation;
            }
            else if (driver2 != null && driver2.Id == driver.EmployeeReference.Id)
            {
                patch[PluginConfig.ExchangeDriver2Completed] = true;
                patch[PluginConfig.ExchangeDriver2Observation] = observation;
            }
            else
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Motorista não participa desta troca.");
            }

            UpdateWithConcurrency(_systemService, patch, exchange);
            _tracing?.Trace("Driver exchange confirmation accepted exchangeId={0}.", exchangeId);
        }

        private void Complete(Guid exchangeId, string reason)
        {
            var exchange = RetrieveExchange(exchangeId);
            ValidateExpectedVersion(exchange);
            var status = GetStatus(exchange);
            if (status == PluginConfig.ExchangeStatusCompleted)
            {
                throw new InvalidPluginExecutionException("Troca ja esta concluida.");
            }
            if (status == PluginConfig.ExchangeStatusCanceled)
            {
                throw new InvalidPluginExecutionException("Troca cancelada nao pode ser concluida.");
            }
            if (status != PluginConfig.ExchangeStatusProgrammed &&
                status != PluginConfig.ExchangeStatusConfirmed)
            {
                throw new InvalidPluginExecutionException("Somente trocas Programadas ou Confirmadas podem ser concluidas manualmente.");
            }

            var general = RetrieveSingleGeneral(exchangeId);
            var requestedEffectiveAt = ReadEffectiveAt();
            var effectiveAt = requestedEffectiveAt ??
                general.GetAttributeValue<DateTime?>(PluginConfig.ServiceFinalizedAt) ?? DateTime.UtcNow;
            if (effectiveAt > DateTime.UtcNow.AddMinutes(1))
            {
                throw new InvalidPluginExecutionException(
                    "Horário efetivo da troca não pode estar no futuro. Informe quando a entrega física realmente aconteceu.");
            }

            var generalPatch = new Entity(PluginConfig.ServiceTable, general.Id)
            {
                [PluginConfig.ServiceFinalizedAt] = effectiveAt
            };
            _callerService.Update(generalPatch);

            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId)
            {
                [PluginConfig.ExchangeStatus] = new OptionSetValue(PluginConfig.ExchangeStatusCompleted),
                [PluginConfig.ExchangeManualCompletionReason] = reason
            };
            UpdateWithConcurrency(_callerService, patch, exchange);
            _tracing?.Trace("Manual exchange completion requested exchangeId={0}.", exchangeId);
        }

        private Entity RetrieveSingleGeneral(Guid exchangeId)
        {
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ServicePrimaryId, PluginConfig.ServiceFinalizedAt),
                TopCount = 2,
                NoLock = false
            };
            query.Criteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Equal, exchangeId);
            var rows = _callerService.RetrieveMultiple(query).Entities;
            if (rows.Count != 1)
            {
                throw new InvalidPluginExecutionException(
                    rows.Count == 0
                        ? "Troca não possui uma Geral vinculada. Nenhuma alteração foi aplicada."
                        : "Troca possui mais de uma Geral vinculada. Nenhuma alteração foi aplicada.");
            }
            return rows[0];
        }

        private void Cancel(Guid exchangeId, string reason)
        {
            var exchange = RetrieveExchange(exchangeId);
            ValidateExpectedVersion(exchange);
            var status = GetStatus(exchange);
            if (status == PluginConfig.ExchangeStatusCanceled)
            {
                _tracing?.Trace("Cancel command idempotent exchangeId={0}.", exchangeId);
                return;
            }
            if (status == PluginConfig.ExchangeStatusCompleted)
            {
                throw new InvalidPluginExecutionException("Troca concluida nao pode ser cancelada. Use Reverter troca.");
            }
            if (status != PluginConfig.ExchangeStatusProgrammed &&
                status != PluginConfig.ExchangeStatusConfirmed)
            {
                throw new InvalidPluginExecutionException("Somente trocas Programadas ou Confirmadas podem ser canceladas.");
            }

            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId)
            {
                [PluginConfig.ExchangeStatus] = new OptionSetValue(PluginConfig.ExchangeStatusCanceled),
                [PluginConfig.ExchangeCancellationReason] = reason,
                [PluginConfig.ExchangeDriver1Completed] = false,
                [PluginConfig.ExchangeDriver2Completed] = false,
                [PluginConfig.ExchangeDriver1Observation] = null,
                [PluginConfig.ExchangeDriver2Observation] = null
            };
            UpdateWithConcurrency(_callerService, patch, exchange);
            _tracing?.Trace("Exchange cancellation requested exchangeId={0}.", exchangeId);
        }

        private void Revert(Guid exchangeId, string reason)
        {
            var original = RetrieveExchange(exchangeId);
            ValidateExpectedVersion(original);
            var status = GetStatus(original);
            if (status != PluginConfig.ExchangeStatusCompleted)
            {
                throw new InvalidPluginExecutionException("Somente troca concluida pode ser revertida.");
            }

            var existing = FindCompensation(exchangeId);
            if (existing != null)
            {
                _context.OutputParameters[PluginConfig.RevertCompensationOutput] = existing.Id;
                return;
            }

            var effectiveAt = ReadEffectiveAt() ?? DateTime.UtcNow;
            if (effectiveAt > DateTime.UtcNow.AddMinutes(1))
            {
                throw new InvalidPluginExecutionException("Data efetiva da reversão não pode estar no futuro.");
            }
            var compensation = BuildCompensation(original, reason, effectiveAt);
            var compensationId = _systemService.Create(compensation);

            var originalPatch = new Entity(PluginConfig.ExchangeTable, original.Id)
            {
                [PluginConfig.ExchangeRevertedFlag] = true,
                [PluginConfig.ExchangeReversalReason] = reason
            };
            UpdateWithConcurrency(_callerService, originalPatch, original);
            _context.OutputParameters[PluginConfig.RevertCompensationOutput] = compensationId;
            _tracing?.Trace("Exchange reversed originalId={0} compensationId={1}.", exchangeId, compensationId);
        }

        private Entity BuildCompensation(Entity original, string reason, DateTime now)
        {
            var type = original.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value;
            var driver1 = original.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup);
            var driver2 = original.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup);
            var vehicle1 = original.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle1Lookup);
            var vehicle2 = original.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle2Lookup);

            if (type == PluginConfig.ExchangeTypeReturnToBase)
            {
                type = PluginConfig.ExchangeTypeTakeFromBase;
                vehicle2 = vehicle1;
                vehicle1 = null;
            }
            else if (type == PluginConfig.ExchangeTypeTakeFromBase)
            {
                type = PluginConfig.ExchangeTypeReturnToBase;
                vehicle1 = vehicle2;
                vehicle2 = null;
            }
            else if (type == PluginConfig.ExchangeTypeSwap && (vehicle2 == null || vehicle2.Id == Guid.Empty))
            {
                var originalDriver1 = driver1;
                driver1 = driver2;
                driver2 = originalDriver1;
            }
            else if (type == PluginConfig.ExchangeTypeSwap)
            {
                var originalVehicle1 = vehicle1;
                vehicle1 = vehicle2;
                vehicle2 = originalVehicle1;
            }
            else
            {
                throw new InvalidPluginExecutionException("Tipo de troca nao permite reversao.");
            }

            var compensation = new Entity(PluginConfig.ExchangeTable)
            {
                [PluginConfig.ExchangeBusinessId] = "REV-" + original.Id.ToString("N"),
                [PluginConfig.ExchangeDriver1Lookup] = driver1,
                [PluginConfig.ExchangeDriver2Lookup] = driver2,
                [PluginConfig.ExchangeVehicle1Lookup] = vehicle1,
                [PluginConfig.ExchangeVehicle2Lookup] = vehicle2,
                [PluginConfig.ExchangeStartDate] = now,
                [PluginConfig.ExchangeEndDate] = now,
                [PluginConfig.ExchangeStatus] = new OptionSetValue(PluginConfig.ExchangeStatusCompleted),
                [PluginConfig.ExchangeType] = new OptionSetValue(type.Value),
                [PluginConfig.ExchangeObservation] = "Evento compensatorio da troca " + original.Id.ToString("D"),
                [PluginConfig.ExchangeDriver1Completed] = true,
                [PluginConfig.ExchangeDriver2Completed] = true,
                [PluginConfig.ExchangeReversalReason] = reason,
                [PluginConfig.ExchangeOriginalReversalLookup] = original.ToEntityReference(),
                [PluginConfig.ExchangeActionExecutorLookup] = new EntityReference(PluginConfig.UserTable, _context.InitiatingUserId)
            };
            return compensation;
        }

        private Entity FindCompensation(Guid originalId)
        {
            var query = new QueryExpression(PluginConfig.ExchangeTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ExchangePrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(PluginConfig.ExchangeOriginalReversalLookup, ConditionOperator.Equal, originalId);
            var rows = _systemService.RetrieveMultiple(query).Entities;
            return rows.Count == 0 ? null : rows[0];
        }

        private Entity RetrieveExchange(Guid exchangeId)
        {
            return _callerService.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeId,
                new ColumnSet(
                    PluginConfig.ExchangePrimaryId,
                    PluginConfig.ExchangeBusinessId,
                    PluginConfig.ExchangeStatus,
                    PluginConfig.ExchangeType,
                    PluginConfig.ExchangeDriver1Lookup,
                    PluginConfig.ExchangeDriver2Lookup,
                    PluginConfig.ExchangeVehicle1Lookup,
                    PluginConfig.ExchangeVehicle2Lookup,
                    PluginConfig.ExchangeStartDate,
                    PluginConfig.ExchangeEndDate,
                    PluginConfig.VersionNumber));
        }

        private void ValidateExpectedVersion(Entity exchange)
        {
            if (!_context.InputParameters.Contains(PluginConfig.ExchangeExpectedVersionParameter))
                throw new InvalidPluginExecutionException("[EXCHANGE_VERSION_REQUIRED] Atualize a troca antes de executar esta ação.");
            var expected = Convert.ToString(_context.InputParameters[PluginConfig.ExchangeExpectedVersionParameter])?.Trim();
            if (string.IsNullOrWhiteSpace(expected))
                throw new InvalidPluginExecutionException("[EXCHANGE_VERSION_REQUIRED] Atualize a troca antes de executar esta ação.");
            if (!string.Equals(expected, exchange.RowVersion, StringComparison.Ordinal))
            {
                throw new InvalidPluginExecutionException("[EXCHANGE_CONCURRENCY_CONFLICT] A troca foi alterada por outra pessoa. Atualize os dados.");
            }
        }

        private string ReadReason()
        {
            var reason = _context.InputParameters.Contains(PluginConfig.ExchangeLifecycleReasonParameter)
                ? _context.InputParameters[PluginConfig.ExchangeLifecycleReasonParameter] as string
                : null;
            reason = reason?.Trim();
            if (string.IsNullOrWhiteSpace(reason))
            {
                throw new InvalidPluginExecutionException("Informe o motivo da acao.");
            }
            if (reason.Length > 2000)
            {
                throw new InvalidPluginExecutionException("O motivo deve ter no maximo 2.000 caracteres.");
            }
            return reason;
        }

        private DateTime? ReadEffectiveAt()
        {
            if (!_context.InputParameters.Contains(PluginConfig.ExchangeLifecycleEffectiveAtParameter) ||
                _context.InputParameters[PluginConfig.ExchangeLifecycleEffectiveAtParameter] == null)
            {
                return null;
            }

            var value = _context.InputParameters[PluginConfig.ExchangeLifecycleEffectiveAtParameter];
            DateTime parsed;
            if (value is DateTime dateTime)
            {
                parsed = dateTime;
            }
            else if (value is DateTimeOffset dateTimeOffset)
            {
                parsed = dateTimeOffset.UtcDateTime;
            }
            else if (!DateTime.TryParse(value.ToString(), out parsed))
            {
                throw new InvalidPluginExecutionException("Data efetiva inválida. Informe uma data e hora válidas.");
            }

            if (parsed.Kind == DateTimeKind.Local) parsed = parsed.ToUniversalTime();
            if (parsed.Kind == DateTimeKind.Unspecified) parsed = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            return parsed;
        }

        private static int? GetStatus(Entity exchange)
        {
            return exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
        }

        private static void UpdateWithConcurrency(IOrganizationService service, Entity patch, Entity current)
        {
            if (string.IsNullOrWhiteSpace(current.RowVersion))
            {
                throw new InvalidPluginExecutionException("Nao foi possivel proteger a acao contra concorrencia: RowVersion nao retornado.");
            }

            patch.RowVersion = current.RowVersion;
            service.Execute(new UpdateRequest
            {
                Target = patch,
                ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
            });
        }
    }
}
