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

        [Fact]
        public void SelectsThePossessionActiveAtTheServiceInstantWhenTwoShareTheSameDate()
        {
            var driverId = Guid.NewGuid();
            var firstVehicleId = Guid.NewGuid();
            var secondVehicleId = Guid.NewGuid();
            var serviceId = Guid.NewGuid();
            var serviceDate = new DateTime(2026, 7, 7, 10, 0, 0, DateTimeKind.Utc);
            var serviceRecord = new Entity("cr40f_reservadeveculos", serviceId)
            {
                ["cr40f_motorista"] = new EntityReference("cr40f_funcionarios", driverId),
                ["cr40f_dataehorriodesada"] = serviceDate
            };
            var possessions = new EntityCollection(new[]
            {
                Possession(driverId, firstVehicleId, new DateTime(2026, 7, 7, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 7, 10, 30, 0, DateTimeKind.Utc)),
                Possession(driverId, secondVehicleId, new DateTime(2026, 7, 7, 11, 30, 0, DateTimeKind.Utc), null)
            });
            var service = new TrackingOrganizationService(serviceRecord, possessions);

            InvokeSyncService(service, serviceId);

            Assert.Equal(1, service.UpdateCount);
            Assert.Equal(firstVehicleId, service.LastUpdate.GetAttributeValue<EntityReference>("cr40f_veiculo").Id);
        }

        [Fact]
        public void RejectsPossessionsThatOverlapTheServiceInstant()
        {
            var driverId = Guid.NewGuid();
            var serviceId = Guid.NewGuid();
        var serviceRecord = new Entity("cr40f_reservadeveculos", serviceId)
            {
                ["cr40f_motorista"] = new EntityReference("cr40f_funcionarios", driverId),
                ["cr40f_dataehorriodesada"] = new DateTime(2026, 7, 7, 12, 0, 0, DateTimeKind.Utc)
            };
            var possessions = new EntityCollection(new[]
            {
                Possession(driverId, Guid.NewGuid(), new DateTime(2026, 7, 7, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 7, 13, 0, 0, DateTimeKind.Utc)),
                Possession(driverId, Guid.NewGuid(), new DateTime(2026, 7, 7, 11, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 7, 14, 0, 0, DateTimeKind.Utc))
            });
            var service = new TrackingOrganizationService(serviceRecord, possessions);

            var error = Assert.Throws<TargetInvocationException>(() => InvokeSyncService(service, serviceId));

            Assert.IsType<InvalidPluginExecutionException>(error.InnerException);
        }

        private static Entity Possession(Guid driverId, Guid vehicleId, DateTime start, DateTime? end)
        {
            var possession = new Entity("new_possedeveiculo", Guid.NewGuid())
            {
                ["new_motorista"] = new EntityReference("cr40f_funcionarios", driverId),
                ["new_veiculo"] = new EntityReference("cr40f_veiculos", vehicleId),
                ["new_iniciodaposse"] = start
            };
            if (end.HasValue)
            {
                possession["new_fimdaposse"] = end.Value;
            }

            return possession;
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
            private readonly EntityCollection _possessions;

            public TrackingOrganizationService(Entity record, EntityCollection possessions = null)
            {
                _record = record;
                _possessions = possessions ?? new EntityCollection();
            }

            public int UpdateCount { get; private set; }
            public int RetrieveMultipleCount { get; private set; }
            public Entity LastUpdate { get; private set; }

            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => _record;
            public EntityCollection RetrieveMultiple(QueryBase query)
            {
                RetrieveMultipleCount++;
                return _possessions;
            }
            public void Update(Entity entity)
            {
                UpdateCount++;
                LastUpdate = entity;
            }
            public Guid Create(Entity entity) => throw new NotSupportedException();
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
        }
    }
}
