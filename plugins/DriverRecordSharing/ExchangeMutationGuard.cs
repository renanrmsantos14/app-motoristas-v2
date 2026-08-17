using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal static class ExchangeMutationGuard
    {
        private static readonly string[] ProtectedExchangeAttributes =
        {
            PluginConfig.ExchangeDriver1Lookup,
            PluginConfig.ExchangeDriver2Lookup,
            PluginConfig.ExchangeVehicle1Lookup,
            PluginConfig.ExchangeVehicle2Lookup,
            PluginConfig.ExchangeStartDate,
            PluginConfig.ExchangeEndDate,
            PluginConfig.ExchangeStatus,
            PluginConfig.ExchangeType,
            PluginConfig.ExchangeObservation,
            PluginConfig.ExchangeIdempotencyKey,
            PluginConfig.ExchangeRequestHash,
            PluginConfig.ExchangeDriver1Completed,
            PluginConfig.ExchangeDriver2Completed,
            PluginConfig.ExchangeDriver1Observation,
            PluginConfig.ExchangeDriver2Observation
        };
        private static readonly string[] ProtectedGeneralAttributes =
        {
            PluginConfig.ServiceExchangeLookup,
            PluginConfig.ServiceStatus,
            PluginConfig.ServiceProgrammedFlag,
            PluginConfig.ServiceDriverLookup,
            PluginConfig.ServiceVehicleLookup,
            PluginConfig.ServiceStartDate,
            PluginConfig.ServiceEndDate,
            PluginConfig.ServiceFinalizedAt,
            PluginConfig.ServiceCategory,
            PluginConfig.ServiceBillingStatus,
            PluginConfig.ServicePassengerViewField,
            PluginConfig.ServiceAddressViewField,
            PluginConfig.ServiceDestinationViewField,
            PluginConfig.ServiceOperationNotesField
        };

        private static readonly string[] ExchangeAuditAttributes =
        {
            PluginConfig.ExchangeManualCompletionReason,
            PluginConfig.ExchangeCancellationReason,
            PluginConfig.ExchangeReversalReason,
            PluginConfig.ExchangeOriginalReversalLookup,
            PluginConfig.ExchangeRevertedFlag,
            PluginConfig.ExchangeActionExecutorLookup
        };

        public static void Validate(
            IPluginExecutionContext context,
            IOrganizationService service,
            ITracingService tracing)
        {
            if (context == null || service == null || !IsProtectedEntity(context.PrimaryEntityName))
            {
                return;
            }

            if (LifecycleAuthorization.IsAuthorized(context))
            {
                tracing?.Trace("ExchangeMutationGuard authorized internal mutation entity={0} message={1}.", context.PrimaryEntityName, context.MessageName);
                return;
            }

            switch (context.PrimaryEntityName)
            {
                case PluginConfig.ExchangeTable:
                    ValidateExchange(context, service);
                    return;
                case PluginConfig.VehiclePossessionTable:
                    throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Posses de veiculo sao historico do sistema e nao podem ser criadas, editadas ou excluidas diretamente.");
                case PluginConfig.ServiceTable:
                    ValidateGeneral(context, service);
                    return;
            }
        }

        private static void ValidateExchange(IPluginExecutionContext context, IOrganizationService service)
        {
            var target = context.InputParameters[PluginConfig.TargetParameterName] as Entity;
            if (target != null && ExchangeAuditAttributes.Any(target.Contains))
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Campos de auditoria da troca sao controlados pelo ciclo do sistema.");
            }

            if (context.MessageName == PluginConfig.DeleteMessage)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Trocas de carro nao podem ser excluidas. Use Cancelar ou Reverter troca.");
            }

            if (context.MessageName == PluginConfig.CreateMessage)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Troca deve ser criada pela acao oficial Registrar troca.");
            }

            if (context.MessageName != PluginConfig.UpdateMessage)
            {
                return;
            }

            if (target == null)
            {
                return;
            }

            if (target.Attributes.Keys.Any(attribute =>
                ProtectedExchangeAttributes.Contains(attribute, StringComparer.OrdinalIgnoreCase)))
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Campos da troca devem ser alterados pela acao oficial.");
            }

            var current = service.Retrieve(
                PluginConfig.ExchangeTable,
                context.PrimaryEntityId,
                new ColumnSet(PluginConfig.ExchangeStatus));
            var currentStatus = current.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            var requestedStatus = target.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;

            if (requestedStatus == PluginConfig.ExchangeStatusCompleted ||
                requestedStatus == PluginConfig.ExchangeStatusCanceled)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Concluir ou cancelar troca deve ser feito pelo comando autorizado, com motivo.");
            }

            if (currentStatus == PluginConfig.ExchangeStatusCompleted ||
                currentStatus == PluginConfig.ExchangeStatusCanceled)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Troca concluida ou cancelada e imutavel. Use Reverter troca para criar um evento compensatorio.");
            }
        }

        private static void ValidateGeneral(IPluginExecutionContext context, IOrganizationService service)
        {
            var target = context.InputParameters[PluginConfig.TargetParameterName] as Entity;
            var reference = context.InputParameters[PluginConfig.TargetParameterName] as EntityReference;
            var id = context.PrimaryEntityId != Guid.Empty
                ? context.PrimaryEntityId
                : reference?.Id ?? target?.Id ?? Guid.Empty;

            Entity current = null;
            if (context.MessageName != PluginConfig.CreateMessage && id != Guid.Empty)
            {
                current = service.Retrieve(
                    PluginConfig.ServiceTable,
                    id,
                    new ColumnSet(PluginConfig.ServiceExchangeLookup));
            }

            var exchangeReference = current?.GetAttributeValue<EntityReference>(PluginConfig.ServiceExchangeLookup) ??
                target?.GetAttributeValue<EntityReference>(PluginConfig.ServiceExchangeLookup);

            if (context.MessageName == PluginConfig.DeleteMessage)
            {
                if (exchangeReference != null)
                {
                    throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] O registro Geral vinculado a uma troca nao pode ser excluido.");
                }

                return;
            }

            if (context.MessageName == PluginConfig.CreateMessage && exchangeReference != null)
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] O Geral vinculado a troca e criado somente pelo ciclo da troca.");
            }

            if (context.MessageName == PluginConfig.UpdateMessage &&
                exchangeReference != null &&
                target != null &&
                target.Attributes.Keys.Any(attribute => ProtectedGeneralAttributes.Contains(attribute, StringComparer.OrdinalIgnoreCase)))
            {
                throw new InvalidPluginExecutionException("[FORBIDDEN_LIFECYCLE] Campos do Geral vinculado a troca sao projetados pela troca e nao podem ser editados diretamente.");
            }
        }

        private static bool IsProtectedEntity(string entityName)
        {
            return entityName == PluginConfig.ExchangeTable ||
                entityName == PluginConfig.VehiclePossessionTable ||
                entityName == PluginConfig.ServiceTable;
        }
    }
}
