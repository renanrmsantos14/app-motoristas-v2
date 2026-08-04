using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ServiceExchangeSynchronizer
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public ServiceExchangeSynchronizer(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public void SyncFromService(Guid serviceId, Entity changedFields = null)
        {
            if (serviceId == Guid.Empty)
            {
                return;
            }

            var serviceEntity = _service.Retrieve(
                PluginConfig.ServiceTable,
                serviceId,
                BuildServiceColumnSet());
            SyncFromService(serviceEntity, changedFields);
        }

        public void SyncFromExchange(Guid exchangeId)
        {
            if (exchangeId == Guid.Empty)
            {
                return;
            }

            var exchangeEntity = _service.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeId,
                BuildExchangeColumnSet());
            SyncFromExchange(exchangeEntity);
        }

        private void SyncFromService(Entity serviceEntity, Entity changedFields)
        {
            if (serviceEntity == null)
            {
                return;
            }

            var exchangeReference = serviceEntity.GetAttributeValue<EntityReference>(PluginConfig.ServiceExchangeLookup);
            if (exchangeReference == null || exchangeReference.Id == Guid.Empty)
            {
                return;
            }

            var serviceStatus = serviceEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ServiceStatus)?.Value;
            if (!TryMapExchangeStatusFromServiceStatus(serviceStatus, out var expectedExchangeStatus))
            {
                _tracing.Trace(
                    "ServiceExchangeSynchronizer skip service->exchange serviceId={0} status={1}.",
                    serviceEntity.Id,
                    serviceStatus.HasValue ? serviceStatus.Value.ToString() : "null");
                return;
            }

            var patchServiceProgrammedFlag = expectedExchangeStatus == PluginConfig.ExchangeStatusProgrammed &&
                serviceEntity.GetAttributeValue<bool?>(PluginConfig.ServiceProgrammedFlag) != true;
            if (patchServiceProgrammedFlag)
            {
                var servicePatch = new Entity(PluginConfig.ServiceTable, serviceEntity.Id);
                servicePatch[PluginConfig.ServiceProgrammedFlag] = true;
                _service.Update(servicePatch);
                _tracing.Trace(
                    "ServiceExchangeSynchronizer enforced programmed flag serviceId={0}.",
                    serviceEntity.Id);
            }

            var exchangeEntity = _service.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeReference.Id,
                BuildExchangeColumnSet());
            var currentExchangeStatus = exchangeEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            var exchangePatch = new Entity(PluginConfig.ExchangeTable, exchangeEntity.Id);
            var changed = false;
            if (currentExchangeStatus != expectedExchangeStatus)
            {
                exchangePatch[PluginConfig.ExchangeStatus] = new OptionSetValue(expectedExchangeStatus);
                changed = true;
            }

            if (ShouldSynchronize(changedFields, PluginConfig.ServiceDriverLookup))
            {
                changed |= CopyReferenceIfChanged(
                    serviceEntity,
                    exchangeEntity,
                    exchangePatch,
                    PluginConfig.ServiceDriverLookup,
                    PluginConfig.ExchangeDriver1Lookup);
            }
            var exchangeVehicleAttribute = exchangeEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value ==
                PluginConfig.ExchangeTypeTakeFromBase
                ? PluginConfig.ExchangeVehicle2Lookup
                : PluginConfig.ExchangeVehicle1Lookup;
            if (ShouldSynchronize(changedFields, PluginConfig.ServiceVehicleLookup))
            {
                changed |= CopyReferenceIfChanged(
                    serviceEntity,
                    exchangeEntity,
                    exchangePatch,
                    PluginConfig.ServiceVehicleLookup,
                    exchangeVehicleAttribute);
            }
            if (ShouldSynchronize(changedFields, PluginConfig.ServiceStartDate))
            {
                changed |= CopyValueIfChanged(
                    serviceEntity,
                    exchangeEntity,
                    exchangePatch,
                    PluginConfig.ServiceStartDate,
                    PluginConfig.ExchangeStartDate);
            }
            if (ShouldSynchronize(changedFields, PluginConfig.ServiceEndDate))
            {
                changed |= CopyValueIfChanged(
                    serviceEntity,
                    exchangeEntity,
                    exchangePatch,
                    PluginConfig.ServiceEndDate,
                    PluginConfig.ExchangeEndDate);
            }
            if (!changed) return;

            _service.Update(exchangePatch);
            _tracing.Trace(
                "ServiceExchangeSynchronizer updated exchangeId={0} from serviceId={1} status={2}->{3}.",
                exchangeEntity.Id,
                serviceEntity.Id,
                currentExchangeStatus.HasValue ? currentExchangeStatus.Value.ToString() : "null",
                expectedExchangeStatus);
        }

        private static bool ShouldSynchronize(Entity changedFields, string attribute)
        {
            return changedFields == null || changedFields.Contains(attribute);
        }

        private static bool CopyReferenceIfChanged(
            Entity source,
            Entity current,
            Entity patch,
            string sourceAttribute,
            string targetAttribute)
        {
            var expected = source.GetAttributeValue<EntityReference>(sourceAttribute);
            var actual = current.GetAttributeValue<EntityReference>(targetAttribute);
            if (expected?.Id == actual?.Id) return false;
            patch[targetAttribute] = expected;
            return true;
        }

        private static bool CopyValueIfChanged(
            Entity source,
            Entity current,
            Entity patch,
            string sourceAttribute,
            string targetAttribute)
        {
            source.Attributes.TryGetValue(sourceAttribute, out var expected);
            current.Attributes.TryGetValue(targetAttribute, out var actual);
            if (Equals(expected, actual)) return false;
            patch[targetAttribute] = expected;
            return true;
        }

        private void SyncFromExchange(Entity exchangeEntity)
        {
            if (exchangeEntity == null)
            {
                return;
            }

            var exchangeStatus = exchangeEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value;
            if (!TryMapServiceStateFromExchangeStatus(exchangeStatus, out var expectedServiceStatus, out var forceProgrammedFlag))
            {
                _tracing.Trace(
                    "ServiceExchangeSynchronizer skip exchange->service exchangeId={0} status={1}.",
                    exchangeEntity.Id,
                    exchangeStatus.HasValue ? exchangeStatus.Value.ToString() : "null");
                return;
            }

            foreach (var serviceEntity in ListServicesByExchange(exchangeEntity.Id))
            {
                var currentStatus = serviceEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ServiceStatus)?.Value;
                var currentProgrammedFlag = serviceEntity.GetAttributeValue<bool?>(PluginConfig.ServiceProgrammedFlag) == true;
                var patch = new Entity(PluginConfig.ServiceTable, serviceEntity.Id);
                var changed = false;

                if (currentStatus != expectedServiceStatus)
                {
                    patch[PluginConfig.ServiceStatus] = new OptionSetValue(expectedServiceStatus);
                    changed = true;
                }

                if (forceProgrammedFlag && !currentProgrammedFlag)
                {
                    patch[PluginConfig.ServiceProgrammedFlag] = true;
                    changed = true;
                }

                if (!changed)
                {
                    continue;
                }

                _service.Update(patch);
                _tracing.Trace(
                    "ServiceExchangeSynchronizer updated serviceId={0} from exchangeId={1} status={2}->{3} programmed={4}->{5}.",
                    serviceEntity.Id,
                    exchangeEntity.Id,
                    currentStatus.HasValue ? currentStatus.Value.ToString() : "null",
                    expectedServiceStatus,
                    currentProgrammedFlag,
                    forceProgrammedFlag || currentProgrammedFlag);
            }
        }

        private IEnumerable<Entity> ListServicesByExchange(Guid exchangeId)
        {
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = BuildServiceColumnSet(),
                NoLock = true,
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1
                }
            };
            query.Criteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Equal, exchangeId);

            while (true)
            {
                var page = _service.RetrieveMultiple(query);
                foreach (var entity in page.Entities)
                {
                    yield return entity;
                }

                if (!page.MoreRecords)
                {
                    yield break;
                }

                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }

        private static bool TryMapExchangeStatusFromServiceStatus(int? serviceStatus, out int exchangeStatus)
        {
            switch (serviceStatus)
            {
                case PluginConfig.ServiceStatusCanceled:
                    exchangeStatus = PluginConfig.ExchangeStatusCanceled;
                    return true;
                case PluginConfig.ServiceStatusCompleted:
                    exchangeStatus = PluginConfig.ExchangeStatusCompleted;
                    return true;
                case PluginConfig.ServiceStatusConfirmed:
                    exchangeStatus = PluginConfig.ExchangeStatusConfirmed;
                    return true;
                case PluginConfig.ServiceStatusProgrammed:
                    exchangeStatus = PluginConfig.ExchangeStatusProgrammed;
                    return true;
                default:
                    exchangeStatus = default;
                    return false;
            }
        }

        private static bool TryMapServiceStateFromExchangeStatus(int? exchangeStatus, out int serviceStatus, out bool forceProgrammedFlag)
        {
            switch (exchangeStatus)
            {
                case PluginConfig.ExchangeStatusCanceled:
                    serviceStatus = PluginConfig.ServiceStatusCanceled;
                    forceProgrammedFlag = false;
                    return true;
                case PluginConfig.ExchangeStatusCompleted:
                    serviceStatus = PluginConfig.ServiceStatusCompleted;
                    forceProgrammedFlag = false;
                    return true;
                case PluginConfig.ExchangeStatusConfirmed:
                    serviceStatus = PluginConfig.ServiceStatusConfirmed;
                    forceProgrammedFlag = false;
                    return true;
                case PluginConfig.ExchangeStatusProgrammed:
                    serviceStatus = PluginConfig.ServiceStatusProgrammed;
                    forceProgrammedFlag = true;
                    return true;
                default:
                    serviceStatus = default;
                    forceProgrammedFlag = false;
                    return false;
            }
        }

        private static ColumnSet BuildServiceColumnSet()
        {
            return new ColumnSet(
                PluginConfig.ServicePrimaryId,
                PluginConfig.ServiceExchangeLookup,
                PluginConfig.ServiceStatus,
                PluginConfig.ServiceProgrammedFlag,
                PluginConfig.ServiceDriverLookup,
                PluginConfig.ServiceVehicleLookup,
                PluginConfig.ServiceStartDate,
                PluginConfig.ServiceEndDate);
        }

        private static ColumnSet BuildExchangeColumnSet()
        {
            return new ColumnSet(
                PluginConfig.ExchangePrimaryId,
                PluginConfig.ExchangeStatus,
                PluginConfig.ExchangeType,
                PluginConfig.ExchangeDriver1Lookup,
                PluginConfig.ExchangeVehicle1Lookup,
                PluginConfig.ExchangeVehicle2Lookup,
                PluginConfig.ExchangeStartDate,
                PluginConfig.ExchangeEndDate);
        }
    }
}
