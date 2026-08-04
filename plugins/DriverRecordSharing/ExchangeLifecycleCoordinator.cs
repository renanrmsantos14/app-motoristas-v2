using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ExchangeLifecycleCoordinator
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;
        private readonly ExchangePossessionFinalizer _finalizer;

        public ExchangeLifecycleCoordinator(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
            _finalizer = new ExchangePossessionFinalizer(service, tracing);
        }

        public void Process(Guid exchangeId, string messageName, Entity target, Entity preImage)
        {
            var exchange = RetrieveExchange(exchangeId);
            var status = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            var previousStatus = preImage?.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            var structuralChange = messageName == PluginConfig.UpdateMessage && HasStructuralChange(target, preImage);
            _tracing.Trace(
                "ExchangeLifecycleCoordinator targetAttributes={0} structuralChanges={1}.",
                target == null ? "<null>" : string.Join(",", target.Attributes.Keys),
                DescribeStructuralChanges(target, preImage));

            if (structuralChange && status == PluginConfig.ExchangeStatusCompleted)
            {
                throw new InvalidPluginExecutionException(
                    "Não altere motorista, veículo ou tipo e conclua a troca na mesma alteração. Salve a estrutura primeiro; as confirmações serão zeradas.");
            }

            var general = EnsureGeneral(exchange);
            SynchronizeGeneralCore(exchange, general);

            if (previousStatus == PluginConfig.ExchangeStatusCompleted &&
                status != PluginConfig.ExchangeStatusCompleted)
            {
                throw new InvalidPluginExecutionException(
                    "Troca concluída não pode ser reaberta por alteração de status. Use a reconciliação operacional.");
            }

            if (status == PluginConfig.ExchangeStatusCompleted &&
                (messageName == PluginConfig.CreateMessage || previousStatus != PluginConfig.ExchangeStatusCompleted))
            {
                var effectiveAt = general.GetAttributeValue<DateTime?>(PluginConfig.ServiceFinalizedAt) ?? DateTime.UtcNow;
                _finalizer.Finalize(exchangeId, effectiveAt);
                return;
            }

            if (structuralChange && status != PluginConfig.ExchangeStatusCompleted)
            {
                ResetConfirmations(exchangeId);
                return;
            }

            if ((status == PluginConfig.ExchangeStatusProgrammed || status == PluginConfig.ExchangeStatusConfirmed) &&
                IsReadyToComplete(exchange))
            {
                var patch = new Entity(PluginConfig.ExchangeTable, exchangeId);
                patch[PluginConfig.ExchangeStatus] = new OptionSetValue(PluginConfig.ExchangeStatusCompleted);
                _service.Update(patch);
            }
        }

        private Entity EnsureGeneral(Entity exchange)
        {
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.ServicePrimaryId,
                    PluginConfig.ServiceStatus,
                    PluginConfig.ServiceFinalizedAt,
                    PluginConfig.ServiceDriverLookup,
                    PluginConfig.ServiceVehicleLookup,
                    PluginConfig.ServiceStartDate,
                    PluginConfig.ServiceEndDate),
                TopCount = 2,
                NoLock = false
            };
            query.Criteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Equal, exchange.Id);
            var rows = _service.RetrieveMultiple(query).Entities;
            if (rows.Count > 1)
            {
                throw new InvalidPluginExecutionException(
                    "Troca possui mais de um item vinculado na Geral. Corrija a duplicidade antes de continuar.");
            }
            if (rows.Count == 1) return rows[0];

            var status = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            var general = new Entity(PluginConfig.ServiceTable);
            general[PluginConfig.ServiceExchangeLookup] = exchange.ToEntityReference();
            general[PluginConfig.ServiceDriverLookup] = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup);
            general[PluginConfig.ServiceVehicleLookup] = ResolveGeneralVehicle(exchange);
            general[PluginConfig.ServiceStartDate] = exchange.GetAttributeValue<DateTime?>(PluginConfig.ExchangeStartDate);
            general[PluginConfig.ServiceEndDate] = exchange.GetAttributeValue<DateTime?>(PluginConfig.ExchangeEndDate);
            general[PluginConfig.ServiceProgrammedFlag] = status == PluginConfig.ExchangeStatusProgrammed;
            general[PluginConfig.ServiceCategory] = new OptionSetValue(PluginConfig.ServiceCategoryExchange);
            general[PluginConfig.ServiceBillingStatus] = new OptionSetValue(PluginConfig.ServiceBillingStatusNotBillable);
            general[PluginConfig.ServiceStatus] = new OptionSetValue(MapServiceStatus(status));
            if (status == PluginConfig.ExchangeStatusCompleted)
            {
                general[PluginConfig.ServiceFinalizedAt] = DateTime.UtcNow;
            }
            var id = _service.Create(general);
            general.Id = id;
            _tracing.Trace("ExchangeLifecycleCoordinator created General exchangeId={0} generalId={1}.", exchange.Id, id);
            return _service.Retrieve(
                PluginConfig.ServiceTable,
                id,
                new ColumnSet(
                    PluginConfig.ServicePrimaryId,
                    PluginConfig.ServiceStatus,
                    PluginConfig.ServiceFinalizedAt,
                    PluginConfig.ServiceDriverLookup,
                    PluginConfig.ServiceVehicleLookup,
                    PluginConfig.ServiceStartDate,
                    PluginConfig.ServiceEndDate));
        }

        private void SynchronizeGeneralCore(Entity exchange, Entity general)
        {
            var patch = new Entity(PluginConfig.ServiceTable, general.Id);
            CopyReferenceIfChanged(
                general,
                patch,
                PluginConfig.ServiceDriverLookup,
                exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup));
            CopyReferenceIfChanged(general, patch, PluginConfig.ServiceVehicleLookup, ResolveGeneralVehicle(exchange));
            CopyValueIfChanged(exchange, general, patch, PluginConfig.ExchangeStartDate, PluginConfig.ServiceStartDate);
            CopyValueIfChanged(exchange, general, patch, PluginConfig.ExchangeEndDate, PluginConfig.ServiceEndDate);
            if (patch.Attributes.Count == 0) return;

            _service.Update(patch);
            _tracing.Trace("ExchangeLifecycleCoordinator synchronized General core exchangeId={0} generalId={1}.", exchange.Id, general.Id);
        }

        private static void CopyReferenceIfChanged(
            Entity current,
            Entity patch,
            string targetAttribute,
            EntityReference expected)
        {
            var actual = current.GetAttributeValue<EntityReference>(targetAttribute);
            if (expected?.Id != actual?.Id) patch[targetAttribute] = expected;
        }

        private static void CopyValueIfChanged(Entity source, Entity current, Entity patch, string sourceAttribute, string targetAttribute)
        {
            source.Attributes.TryGetValue(sourceAttribute, out var expected);
            current.Attributes.TryGetValue(targetAttribute, out var actual);
            if (!Equals(expected, actual)) patch[targetAttribute] = expected;
        }

        private Entity RetrieveExchange(Guid exchangeId)
        {
            return _service.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeId,
                new ColumnSet(
                    PluginConfig.ExchangePrimaryId,
                    PluginConfig.ExchangeDriver1Lookup,
                    PluginConfig.ExchangeDriver2Lookup,
                    PluginConfig.ExchangeVehicle1Lookup,
                    PluginConfig.ExchangeVehicle2Lookup,
                    PluginConfig.ExchangeStartDate,
                    PluginConfig.ExchangeEndDate,
                    PluginConfig.ExchangeStatus,
                    PluginConfig.ExchangeType,
                    PluginConfig.ExchangeDriver1Completed,
                    PluginConfig.ExchangeDriver2Completed));
        }

        private void ResetConfirmations(Guid exchangeId)
        {
            var patch = new Entity(PluginConfig.ExchangeTable, exchangeId);
            patch[PluginConfig.ExchangeDriver1Completed] = false;
            patch[PluginConfig.ExchangeDriver2Completed] = false;
            patch[PluginConfig.ExchangeDriver1Observation] = null;
            patch[PluginConfig.ExchangeDriver2Observation] = null;
            _service.Update(patch);
            _tracing.Trace("ExchangeLifecycleCoordinator reset confirmations exchangeId={0}.", exchangeId);
        }

        private static bool IsReadyToComplete(Entity exchange)
        {
            var driver1Done = exchange.GetAttributeValue<bool?>(PluginConfig.ExchangeDriver1Completed) == true;
            var type = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value;
            if (type == PluginConfig.ExchangeTypeTakeFromBase || type == PluginConfig.ExchangeTypeReturnToBase)
            {
                return driver1Done;
            }
            return driver1Done && exchange.GetAttributeValue<bool?>(PluginConfig.ExchangeDriver2Completed) == true;
        }

        private static bool HasStructuralChange(Entity target, Entity previous)
        {
            if (target == null || previous == null) return false;
            return ReferenceChanged(target, previous, PluginConfig.ExchangeDriver1Lookup) ||
                ReferenceChanged(target, previous, PluginConfig.ExchangeDriver2Lookup) ||
                ReferenceChanged(target, previous, PluginConfig.ExchangeVehicle1Lookup) ||
                ReferenceChanged(target, previous, PluginConfig.ExchangeVehicle2Lookup) ||
                OptionChanged(target, previous, PluginConfig.ExchangeType);
        }

        private static string DescribeStructuralChanges(Entity target, Entity previous)
        {
            if (target == null || previous == null) return "<none>";
            var changed = new System.Collections.Generic.List<string>();
            if (ReferenceChanged(target, previous, PluginConfig.ExchangeDriver1Lookup)) changed.Add(PluginConfig.ExchangeDriver1Lookup);
            if (ReferenceChanged(target, previous, PluginConfig.ExchangeDriver2Lookup)) changed.Add(PluginConfig.ExchangeDriver2Lookup);
            if (ReferenceChanged(target, previous, PluginConfig.ExchangeVehicle1Lookup)) changed.Add(PluginConfig.ExchangeVehicle1Lookup);
            if (ReferenceChanged(target, previous, PluginConfig.ExchangeVehicle2Lookup)) changed.Add(PluginConfig.ExchangeVehicle2Lookup);
            if (OptionChanged(target, previous, PluginConfig.ExchangeType)) changed.Add(PluginConfig.ExchangeType);
            return changed.Count == 0 ? "<none>" : string.Join(",", changed);
        }

        private static bool ReferenceChanged(Entity target, Entity previous, string attribute)
        {
            return target.Contains(attribute) && target.GetAttributeValue<EntityReference>(attribute)?.Id !=
                previous.GetAttributeValue<EntityReference>(attribute)?.Id;
        }

        private static bool OptionChanged(Entity target, Entity previous, string attribute)
        {
            return target.Contains(attribute) && target.GetAttributeValue<OptionSetValue>(attribute)?.Value !=
                previous.GetAttributeValue<OptionSetValue>(attribute)?.Value;
        }

        private static EntityReference ResolveGeneralVehicle(Entity exchange)
        {
            var type = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value;
            return type == PluginConfig.ExchangeTypeTakeFromBase
                ? exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle2Lookup)
                : exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle1Lookup);
        }

        private static int MapServiceStatus(int? exchangeStatus)
        {
            switch (exchangeStatus)
            {
                case PluginConfig.ExchangeStatusCanceled:
                    return PluginConfig.ServiceStatusCanceled;
                case PluginConfig.ExchangeStatusCompleted:
                    return PluginConfig.ServiceStatusCompleted;
                case PluginConfig.ExchangeStatusConfirmed:
                    return PluginConfig.ServiceStatusConfirmed;
                default:
                    return PluginConfig.ServiceStatusProgrammed;
            }
        }
    }
}
