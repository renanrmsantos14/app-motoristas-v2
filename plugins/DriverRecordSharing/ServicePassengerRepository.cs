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
                items.Add(new ServicePassengerLink(
                    new EntityReference(PluginConfig.ServicePassengerTable, entity.Id),
                    entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerServiceLookup),
                    entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup)));
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

            var item = new ServicePassengerLink(
                new EntityReference(PluginConfig.ServicePassengerTable, entity.Id),
                entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerServiceLookup),
                entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup));

            _tracing.Trace(
                "Load servicePassengerId={0} serviceId={1} passengerId={2}",
                servicePassengerId,
                item.ServiceReference?.Id,
                item.PassengerReference?.Id);

            return item;
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
