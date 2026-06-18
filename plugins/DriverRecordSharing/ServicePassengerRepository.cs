using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ServicePassengerRepository
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public ServicePassengerRepository(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public IReadOnlyList<ServicePassengerLink> ListByService(Guid serviceId)
        {
            var query = new QueryExpression(PluginConfig.ServicePassengerTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.ServicePassengerPrimaryId,
                    PluginConfig.ServicePassengerPassengerLookup),
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerServiceLookup, ConditionOperator.Equal, serviceId);

            var result = _service.RetrieveMultiple(query);
            var items = new List<ServicePassengerLink>(result.Entities.Count);

            foreach (var entity in result.Entities)
            {
                items.Add(new ServicePassengerLink(
                    new EntityReference(
                        PluginConfig.ServicePassengerTable,
                        entity.Id),
                    entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup)));
            }

            _tracing.Trace("ListByService serviceId={0} count={1}", serviceId, items.Count);
            return items;
        }

        public bool HasOtherActiveOrFutureServiceForPassenger(Guid employeeId, Guid passengerId, Guid excludedServiceId)
        {
            var query = new QueryExpression(PluginConfig.ServicePassengerTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ServicePassengerPrimaryId),
                TopCount = 1,
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerPassengerLookup, ConditionOperator.Equal, passengerId);
            query.Criteria.AddCondition(PluginConfig.ServicePassengerServiceLookup, ConditionOperator.NotEqual, excludedServiceId);

            var serviceLink = query.AddLink(
                PluginConfig.ServiceTable,
                PluginConfig.ServicePassengerServiceLookup,
                PluginConfig.ServicePrimaryId);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceDriverLookup, ConditionOperator.Equal, employeeId);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceCategoryField, ConditionOperator.Equal, PluginConfig.ServiceCategoryService);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceScheduledField, ConditionOperator.Equal, true);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceCompletionDate, ConditionOperator.Null);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceMaintenanceLookup, ConditionOperator.Null);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Null);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.StateCode, ConditionOperator.Equal, PluginConfig.ActiveStateCode);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceStatus, ConditionOperator.NotEqual, PluginConfig.ServiceStatusCompleted);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceStatus, ConditionOperator.NotEqual, PluginConfig.ServiceStatusNeedsAnalysis);

            var exists = _service.RetrieveMultiple(query).Entities.Count > 0;
            _tracing.Trace(
                "HasOtherActiveOrFutureServiceForPassenger employeeId={0} passengerId={1} excludedServiceId={2} exists={3}",
                employeeId,
                passengerId,
                excludedServiceId,
                exists);
            return exists;
        }
    }

    internal sealed class ServicePassengerLink
    {
        public ServicePassengerLink(EntityReference servicePassengerReference, EntityReference passengerReference)
        {
            ServicePassengerReference = servicePassengerReference;
            PassengerReference = passengerReference;
        }

        public EntityReference ServicePassengerReference { get; }

        public EntityReference PassengerReference { get; }
    }
}
