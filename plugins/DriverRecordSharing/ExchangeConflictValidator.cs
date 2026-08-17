using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ExchangeConflictValidator
    {
        private readonly IOrganizationService _service;

        public ExchangeConflictValidator(IOrganizationService service)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
        }

        public void Validate(IPluginExecutionContext context)
        {
            if (context?.PrimaryEntityName != PluginConfig.ExchangeTable ||
                (context.MessageName != PluginConfig.CreateMessage && context.MessageName != PluginConfig.UpdateMessage)) return;

            var target = context.InputParameters[PluginConfig.TargetParameterName] as Entity;
            var preImage = context.PreEntityImages.Contains(PluginConfig.PreImageAlias)
                ? context.PreEntityImages[PluginConfig.PreImageAlias]
                : null;
            if (context.MessageName == PluginConfig.UpdateMessage && context.PrimaryEntityId != Guid.Empty &&
                !HasSnapshot(preImage))
            {
                preImage = _service.Retrieve(PluginConfig.ExchangeTable, context.PrimaryEntityId, new ColumnSet(
                    PluginConfig.ExchangeStartDate,
                    PluginConfig.ExchangeEndDate,
                    PluginConfig.ExchangeDriver1Lookup,
                    PluginConfig.ExchangeDriver2Lookup,
                    PluginConfig.ExchangeVehicle1Lookup,
                    PluginConfig.ExchangeVehicle2Lookup));
            }
            var start = Resolve<DateTime?>(target, preImage, PluginConfig.ExchangeStartDate);
            var end = Resolve<DateTime?>(target, preImage, PluginConfig.ExchangeEndDate);
            if (!start.HasValue || !end.HasValue) return;
            if (end.Value < start.Value)
            {
                throw new InvalidPluginExecutionException("[EXCHANGE_INVALID_WINDOW] O fim da troca deve ser posterior ao início.");
            }
            if (end.Value == start.Value)
            {
                var original = Resolve<EntityReference>(target, preImage, PluginConfig.ExchangeOriginalReversalLookup);
                var status = Resolve<OptionSetValue>(target, preImage, PluginConfig.ExchangeStatus);
                if (original != null && original.Id != Guid.Empty && status?.Value == PluginConfig.ExchangeStatusCompleted) return;
                throw new InvalidPluginExecutionException("[EXCHANGE_INVALID_WINDOW] O fim da troca deve ser posterior ao início.");
            }

            var participants = new[]
            {
                Resolve<EntityReference>(target, preImage, PluginConfig.ExchangeDriver1Lookup),
                Resolve<EntityReference>(target, preImage, PluginConfig.ExchangeDriver2Lookup),
                Resolve<EntityReference>(target, preImage, PluginConfig.ExchangeVehicle1Lookup),
                Resolve<EntityReference>(target, preImage, PluginConfig.ExchangeVehicle2Lookup)
            };
            var participantFilter = new FilterExpression(LogicalOperator.Or);
            AddParticipant(participantFilter, PluginConfig.ExchangeDriver1Lookup, participants[0]);
            AddParticipant(participantFilter, PluginConfig.ExchangeDriver2Lookup, participants[0]);
            AddParticipant(participantFilter, PluginConfig.ExchangeDriver1Lookup, participants[1]);
            AddParticipant(participantFilter, PluginConfig.ExchangeDriver2Lookup, participants[1]);
            AddParticipant(participantFilter, PluginConfig.ExchangeVehicle1Lookup, participants[2]);
            AddParticipant(participantFilter, PluginConfig.ExchangeVehicle2Lookup, participants[2]);
            AddParticipant(participantFilter, PluginConfig.ExchangeVehicle1Lookup, participants[3]);
            AddParticipant(participantFilter, PluginConfig.ExchangeVehicle2Lookup, participants[3]);
            if (participantFilter.Conditions.Count == 0) return;

            var query = new QueryExpression(PluginConfig.ExchangeTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ExchangePrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(PluginConfig.ExchangeStatus, ConditionOperator.In,
                PluginConfig.ExchangeStatusProgrammed, PluginConfig.ExchangeStatusConfirmed);
            query.Criteria.AddCondition(PluginConfig.ExchangeStartDate, ConditionOperator.LessThan, end.Value);
            query.Criteria.AddCondition(PluginConfig.ExchangeEndDate, ConditionOperator.GreaterThan, start.Value);
            if (context.PrimaryEntityId != Guid.Empty)
                query.Criteria.AddCondition(PluginConfig.ExchangePrimaryId, ConditionOperator.NotEqual, context.PrimaryEntityId);
            query.Criteria.AddFilter(participantFilter);

            if (_service.RetrieveMultiple(query).Entities.Count > 0)
                throw new InvalidPluginExecutionException("[EXCHANGE_OVERLAP] Existe outra troca ativa para o motorista ou veículo neste período.");
        }

        private static T Resolve<T>(Entity target, Entity preImage, string attribute)
        {
            if (target != null && target.Contains(attribute)) return target.GetAttributeValue<T>(attribute);
            return preImage != null ? preImage.GetAttributeValue<T>(attribute) : default(T);
        }

        private static bool HasSnapshot(Entity entity)
        {
            return entity != null &&
                entity.Contains(PluginConfig.ExchangeStartDate) &&
                entity.Contains(PluginConfig.ExchangeEndDate) &&
                entity.Contains(PluginConfig.ExchangeDriver1Lookup) &&
                entity.Contains(PluginConfig.ExchangeVehicle1Lookup);
        }

        private static void AddParticipant(FilterExpression filter, string attribute, EntityReference value)
        {
            if (value != null && value.Id != Guid.Empty) filter.AddCondition(attribute, ConditionOperator.Equal, value.Id);
        }
    }
}
