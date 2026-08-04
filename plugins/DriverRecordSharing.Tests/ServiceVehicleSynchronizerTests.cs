using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ServiceVehicleSynchronizerTests
    {
        [Fact]
        public void LinkedExchangeGeneralNeverUsesGenericVehicleSynchronization()
        {
            var serviceId = Guid.NewGuid();
            var record = new Entity("cr40f_reservadeveculos", serviceId)
            {
                ["cr40f_ot"] = new EntityReference("cr40f_trocasdecarro", Guid.NewGuid()),
                ["cr40f_motorista"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_veiculo"] = new EntityReference("cr40f_veiculos", Guid.NewGuid()),
                ["cr40f_dataehorriodesada"] = DateTime.UtcNow
            };
            var service = new TrackingOrganizationService(record);

            InvokeSyncService(service, serviceId);

            Assert.Equal(0, service.UpdateCount);
            Assert.Equal(0, service.RetrieveMultipleCount);
        }

        private static void InvokeSyncService(IOrganizationService service, Guid serviceId)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ServiceVehicleSynchronizer",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, new NullTracingService() },
                culture: null);
            type.GetMethod("SyncService", BindingFlags.Instance | BindingFlags.Public)
                .Invoke(instance, new object[] { serviceId });
        }

        private sealed class NullTracingService : ITracingService
        {
            public void Trace(string format, params object[] args) { }
        }

        private sealed class TrackingOrganizationService : IOrganizationService
        {
            private readonly Entity _record;

            public TrackingOrganizationService(Entity record) => _record = record;

            public int UpdateCount { get; private set; }
            public int RetrieveMultipleCount { get; private set; }

            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => _record;
            public EntityCollection RetrieveMultiple(QueryBase query)
            {
                RetrieveMultipleCount++;
                return new EntityCollection();
            }
            public void Update(Entity entity) => UpdateCount++;
            public Guid Create(Entity entity) => throw new NotSupportedException();
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
        }
    }
}
