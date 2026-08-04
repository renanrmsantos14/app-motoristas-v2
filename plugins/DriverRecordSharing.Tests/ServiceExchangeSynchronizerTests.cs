using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ServiceExchangeSynchronizerTests
    {
        [Fact]
        public void CompletingGeneralCompletesItsLinkedExchange()
        {
            var serviceId = Guid.NewGuid();
            var exchangeId = Guid.NewGuid();
            var service = new InMemoryOrganizationService(
                new Entity("cr40f_reservadeveculos", serviceId)
                {
                    ["cr40f_ot"] = new EntityReference("cr40f_trocasdecarro", exchangeId),
                    ["cr40f_status"] = new OptionSetValue(202410008)
                },
                new Entity("cr40f_trocasdecarro", exchangeId)
                {
                    ["cr40f_statusdatroca"] = new OptionSetValue(100000001)
                });

            InvokeSyncFromService(service, serviceId);

            Assert.Equal(
                202410001,
                service.Record("cr40f_trocasdecarro", exchangeId)
                    .GetAttributeValue<OptionSetValue>("cr40f_statusdatroca").Value);
        }

        [Fact]
        public void GeneralCoreChangeUpdatesLinkedExchangeStructure()
        {
            var serviceId = Guid.NewGuid();
            var exchangeId = Guid.NewGuid();
            var driverId = Guid.NewGuid();
            var vehicleId = Guid.NewGuid();
            var start = new DateTime(2026, 8, 6, 10, 0, 0, DateTimeKind.Utc);
            var end = start.AddMinutes(30);
            var service = new InMemoryOrganizationService(
                new Entity("cr40f_reservadeveculos", serviceId)
                {
                    ["cr40f_ot"] = new EntityReference("cr40f_trocasdecarro", exchangeId),
                    ["cr40f_status"] = new OptionSetValue(202410005),
                    ["cr40f_motorista"] = new EntityReference("cr40f_funcionarios", driverId),
                    ["cr40f_veiculo"] = new EntityReference("cr40f_veiculos", vehicleId),
                    ["cr40f_dataehorriodesada"] = start,
                    ["cr40f_horrioprevistoderetorno"] = end
                },
                new Entity("cr40f_trocasdecarro", exchangeId)
                {
                    ["cr40f_statusdatroca"] = new OptionSetValue(202410000),
                    ["new_tipodetroca"] = new OptionSetValue(100000001),
                    ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                    ["cr40f_veiculo1antesdatroca"] = new EntityReference("cr40f_veiculos", Guid.NewGuid())
                });

            InvokeSyncFromService(service, serviceId);

            var exchange = service.Record("cr40f_trocasdecarro", exchangeId);
            Assert.Equal(driverId, exchange.GetAttributeValue<EntityReference>("cr40f_motorista1").Id);
            Assert.Equal(vehicleId, exchange.GetAttributeValue<EntityReference>("cr40f_veiculo1antesdatroca").Id);
            Assert.Equal(start, exchange.GetAttributeValue<DateTime>("cr40f_iniciodajaneladetroca"));
            Assert.Equal(end, exchange.GetAttributeValue<DateTime>("cr40f_fimdajaneladetroca"));
        }

        [Fact]
        public void ConfirmedGeneralClearsProgrammedFlagAndConfirmsExchange()
        {
            var serviceId = Guid.NewGuid();
            var exchangeId = Guid.NewGuid();
            var service = new InMemoryOrganizationService(
                new Entity("cr40f_reservadeveculos", serviceId)
                {
                    ["cr40f_ot"] = new EntityReference("cr40f_trocasdecarro", exchangeId),
                    ["cr40f_status"] = new OptionSetValue(202410001),
                    ["new_foiprogramado"] = true
                },
                new Entity("cr40f_trocasdecarro", exchangeId)
                {
                    ["cr40f_statusdatroca"] = new OptionSetValue(202410000)
                });

            InvokeSyncFromServiceEntity(service, service.Record("cr40f_reservadeveculos", serviceId));

            Assert.False(service.Record("cr40f_reservadeveculos", serviceId).GetAttributeValue<bool>("new_foiprogramado"));
            Assert.Equal(
                100000001,
                service.Record("cr40f_trocasdecarro", exchangeId)
                    .GetAttributeValue<OptionSetValue>("cr40f_statusdatroca").Value);
        }

        private static void InvokeSyncFromService(IOrganizationService service, Guid serviceId)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ServiceExchangeSynchronizer",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, new NullTracingService() },
                culture: null);
            type.GetMethod("SyncFromService", BindingFlags.Instance | BindingFlags.Public)
                .Invoke(instance, new object[] { serviceId, null });
        }

        private static void InvokeSyncFromServiceEntity(IOrganizationService service, Entity serviceEntity)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ServiceExchangeSynchronizer",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, new NullTracingService() },
                culture: null);
            type.GetMethod(
                    "SyncFromService",
                    BindingFlags.Instance | BindingFlags.NonPublic,
                    binder: null,
                    types: new[] { typeof(Entity), typeof(Entity) },
                    modifiers: null)
                .Invoke(instance, new object[] { serviceEntity, null });
        }

        private sealed class NullTracingService : ITracingService
        {
            public void Trace(string format, params object[] args) { }
        }

        private sealed class InMemoryOrganizationService : IOrganizationService
        {
            private readonly Dictionary<string, Entity> _records = new Dictionary<string, Entity>();

            public InMemoryOrganizationService(params Entity[] records)
            {
                foreach (var record in records)
                {
                    _records[Key(record.LogicalName, record.Id)] = record;
                }
            }

            public Entity Record(string logicalName, Guid id) => _records[Key(logicalName, id)];

            public Guid Create(Entity entity) => throw new NotSupportedException();

            public void Update(Entity entity)
            {
                var current = Record(entity.LogicalName, entity.Id);
                foreach (var attribute in entity.Attributes)
                {
                    current[attribute.Key] = attribute.Value;
                }
            }

            public void Delete(string entityName, Guid id) => throw new NotSupportedException();

            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => Record(entityName, id);

            public EntityCollection RetrieveMultiple(QueryBase query)
            {
                var expression = (QueryExpression)query;
                var exchangeId = expression.Criteria.Conditions
                    .Single(condition => condition.AttributeName == "cr40f_ot")
                    .Values.Single();
                var entities = _records.Values
                    .Where(record => record.LogicalName == expression.EntityName)
                    .Where(record => record.GetAttributeValue<EntityReference>("cr40f_ot")?.Id == (Guid)exchangeId)
                    .ToList();
                return new EntityCollection(entities);
            }

            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();

            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();

            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();

            private static string Key(string logicalName, Guid id) => logicalName + ":" + id;
        }
    }
}
