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
                    PluginConfig.ServicePassengerServiceLookup,
                    PluginConfig.ServicePassengerPassengerLookup),
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerServiceLookup, ConditionOperator.Equal, serviceId);

            var result = _service.RetrieveMultiple(query);
            var items = new List<ServicePassengerLink>(result.Entities.Count);

            foreach (var entity in result.Entities)
            {
                items.Add(Map(entity));
            }

            _tracing.Trace("ListByService serviceId={0} count={1}", serviceId, items.Count);
            return items;
        }

        public ServicePassengerLink Load(Guid servicePassengerId)
        {
            var entity = _service.Retrieve(
                PluginConfig.ServicePassengerTable,
                servicePassengerId,
                new ColumnSet(
                    PluginConfig.ServicePassengerPrimaryId,
                    PluginConfig.ServicePassengerServiceLookup,
                    PluginConfig.ServicePassengerPassengerLookup));

            var item = Map(entity);
            _tracing.Trace(
                "Load servicePassengerId={0} serviceId={1} passengerId={2}",
                servicePassengerId,
                item.ServiceReference?.Id,
                item.PassengerReference?.Id);

            return item;
        }

        public bool HasOtherPassengerServiceForEmployee(Guid employeeId, Guid passengerId, Guid excludedServiceId)
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

            var exists = _service.RetrieveMultiple(query).Entities.Count > 0;
            _tracing.Trace(
                "HasOtherPassengerServiceForEmployee employeeId={0} passengerId={1} excludedServiceId={2} exists={3}",
                employeeId,
                passengerId,
                excludedServiceId,
                exists);
            return exists;
        }

        public bool HasOtherPassengerLinkForEmployee(Guid employeeId, Guid passengerId, Guid excludedServicePassengerId)
        {
            var query = new QueryExpression(PluginConfig.ServicePassengerTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ServicePassengerPrimaryId),
                TopCount = 1,
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerPassengerLookup, ConditionOperator.Equal, passengerId);
            query.Criteria.AddCondition(PluginConfig.ServicePassengerPrimaryId, ConditionOperator.NotEqual, excludedServicePassengerId);

            var serviceLink = query.AddLink(
                PluginConfig.ServiceTable,
                PluginConfig.ServicePassengerServiceLookup,
                PluginConfig.ServicePrimaryId);
            serviceLink.LinkCriteria.AddCondition(PluginConfig.ServiceDriverLookup, ConditionOperator.Equal, employeeId);

            var exists = _service.RetrieveMultiple(query).Entities.Count > 0;
            _tracing.Trace(
                "HasOtherPassengerLinkForEmployee employeeId={0} passengerId={1} excludedServicePassengerId={2} exists={3}",
                employeeId,
                passengerId,
                excludedServicePassengerId,
                exists);
            return exists;
        }

        public bool HasOtherRequesterServiceForEmployee(Guid employeeId, Guid requesterId, Guid excludedServiceId)
        {
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ServicePrimaryId),
                TopCount = 1,
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServiceRequesterLookup, ConditionOperator.Equal, requesterId);
            query.Criteria.AddCondition(PluginConfig.ServicePrimaryId, ConditionOperator.NotEqual, excludedServiceId);
            query.Criteria.AddCondition(PluginConfig.ServiceDriverLookup, ConditionOperator.Equal, employeeId);

            var exists = _service.RetrieveMultiple(query).Entities.Count > 0;
            _tracing.Trace(
                "HasOtherRequesterServiceForEmployee employeeId={0} requesterId={1} excludedServiceId={2} exists={3}",
                employeeId,
                requesterId,
                excludedServiceId,
                exists);
            return exists;
        }

        private static ServicePassengerLink Map(Entity entity)
        {
            return new ServicePassengerLink(
                new EntityReference(PluginConfig.ServicePassengerTable, entity.Id),
                entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerServiceLookup),
                entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup));
        }
    }

    internal sealed class ServicePassengerLink
    {
        public ServicePassengerLink(
            EntityReference servicePassengerReference,
            EntityReference serviceReference,
            EntityReference passengerReference)
        {
            ServicePassengerReference = servicePassengerReference;
            ServiceReference = serviceReference;
            PassengerReference = passengerReference;
        }

        public EntityReference ServicePassengerReference { get; }

        public EntityReference ServiceReference { get; }

        public EntityReference PassengerReference { get; }
    }
}
