using System;
using System.Collections.Generic;
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
                case "new_ReverterTrocaDeCarro":
                    Revert(target.Id, reason);
                    return;
                default:
                    throw new InvalidPluginExecutionException("Comando de troca nao reconhecido.");
            }
        }

        private void Complete(Guid exchangeId, string reason)
        {
            var exchange = RetrieveExchange(exchangeId);
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

            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId)
            {
                [PluginConfig.ExchangeStatus] = new OptionSetValue(PluginConfig.ExchangeStatusCompleted),
                [PluginConfig.ExchangeManualCompletionReason] = reason
            };
            UpdateWithConcurrency(_callerService, patch, exchange);
            _tracing?.Trace("Manual exchange completion requested exchangeId={0}.", exchangeId);
        }

        private void Cancel(Guid exchangeId, string reason)
        {
            var exchange = RetrieveExchange(exchangeId);
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

            var now = DateTime.UtcNow;
            var compensation = BuildCompensation(original, reason, now);
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
