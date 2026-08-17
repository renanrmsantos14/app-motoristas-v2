using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ExchangePossessionFinalizerTests
    {
        [Fact]
        public void ExchangeCreateEnsuresProgrammedGeneral()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000002, driver, null, null, vehicle, 202410000);
            exchange["cr40f_iniciodajaneladetroca"] = new DateTime(2026, 8, 4, 10, 0, 0, DateTimeKind.Utc);
            exchange["cr40f_fimdajaneladetroca"] = new DateTime(2026, 8, 4, 10, 30, 0, DateTimeKind.Utc);
            exchange["cr40f_id"] = "TR-123";
            var service = new MemoryService(exchange);

            InvokeEnsureGeneral(service, exchange);

            var general = Assert.Single(service.Records("cr40f_reservadeveculos"));
            Assert.Equal(202410005, general.GetAttributeValue<OptionSetValue>("cr40f_status").Value);
            Assert.Equal(100000002, general.GetAttributeValue<OptionSetValue>("new_categoriadoitem").Value);
            Assert.True(general.GetAttributeValue<bool>("new_foiprogramado"));
            Assert.Equal(exchange.Id, general.GetAttributeValue<EntityReference>("cr40f_ot").Id);
            Assert.Equal("Troca de carro", general.GetAttributeValue<string>("cr40f_passageirosetelefonedecontato"));
            Assert.Equal("Troca de carro", general.GetAttributeValue<string>("cr40f_endereodesada"));
            Assert.Equal("Troca de carro", general.GetAttributeValue<string>("cr40f_destino"));
            Assert.Equal("Troca de carro | ID da troca: TR-123", general.GetAttributeValue<string>("cr40f_obsdeoperao"));
        }

        [Fact]
        public void ConfirmedExchangeCreatesConfirmedNonProgrammedGeneral()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000002, driver, null, null, vehicle, 100000001);
            exchange["cr40f_iniciodajaneladetroca"] = new DateTime(2026, 8, 5, 10, 0, 0, DateTimeKind.Utc);
            exchange["cr40f_fimdajaneladetroca"] = new DateTime(2026, 8, 5, 10, 30, 0, DateTimeKind.Utc);
            var service = new MemoryService(exchange);

            var general = InvokeEnsureGeneral(service, exchange);

            Assert.Equal(202410001, general.GetAttributeValue<OptionSetValue>("cr40f_status").Value);
            Assert.False(general.GetAttributeValue<bool>("new_foiprogramado"));
        }

        [Fact]
        public void StructuralChangeResetsPreviousConfirmations()
        {
            var oldDriver = Guid.NewGuid();
            var newDriver = Guid.NewGuid();
            var driver2 = Guid.NewGuid();
            var vehicle1 = Guid.NewGuid();
            var vehicle2 = Guid.NewGuid();
            var exchange = Exchange(100000000, newDriver, driver2, vehicle1, vehicle2, 202410000);
            exchange["new_concluidomotorista1"] = true;
            exchange["new_concluidomotorista2"] = true;
            var preImage = Exchange(100000000, oldDriver, driver2, vehicle1, vehicle2, 202410000);
            preImage.Id = exchange.Id;
            preImage["new_concluidomotorista1"] = true;
            preImage["new_concluidomotorista2"] = true;
            var service = new MemoryService(exchange);

            InvokeLifecycle(service, exchange.Id, "Update", preImage);

            var updated = service.Record("cr40f_trocasdecarro", exchange.Id);
            Assert.False(updated.GetAttributeValue<bool>("new_concluidomotorista1"));
            Assert.False(updated.GetAttributeValue<bool>("new_concluidomotorista2"));
            Assert.Equal(202410000, updated.GetAttributeValue<OptionSetValue>("cr40f_statusdatroca").Value);
        }

        [Fact]
        public void ReadyConfirmationRequestsCompletedStatus()
        {
            var exchange = Exchange(
                100000000,
                Guid.NewGuid(),
                Guid.NewGuid(),
                Guid.NewGuid(),
                Guid.NewGuid(),
                202410000);
            exchange["new_concluidomotorista1"] = true;
            exchange["new_concluidomotorista2"] = true;
            var preImage = Copy(exchange);
            preImage["new_concluidomotorista2"] = false;
            var service = new MemoryService(exchange);

            InvokeLifecycle(service, exchange.Id, "Update", preImage);

            Assert.Equal(
                202410001,
                service.Record("cr40f_trocasdecarro", exchange.Id)
                    .GetAttributeValue<OptionSetValue>("cr40f_statusdatroca").Value);
        }

        [Fact]
        public void CompletedTransitionUsesGeneralEffectiveTime()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var effectiveAt = new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc);
            var exchange = Exchange(100000001, driver, null, vehicle, null, 202410001);
            var preImage = Copy(exchange);
            preImage["cr40f_statusdatroca"] = new OptionSetValue(202410000);
            var possession = Possession(driver, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var general = new Entity("cr40f_reservadeveculos", Guid.NewGuid())
            {
                ["cr40f_ot"] = exchange.ToEntityReference(),
                ["cr40f_status"] = new OptionSetValue(202410008),
                ["new_datadefinalizacao"] = effectiveAt
            };
            var service = new MemoryService(exchange, possession, general);

            InvokeLifecycle(service, exchange.Id, "Update", preImage);

            Assert.Equal(effectiveAt, service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
        }

        [Fact]
        public void ReturnToBaseClosesDriverAndOpensBaseAtEffectiveTime()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, driver, null, vehicle, null);
            var possession = Possession(driver, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);
            var effectiveAt = new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc);

            InvokeFinalize(service, exchange.Id, effectiveAt);

            Assert.Equal(effectiveAt, service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
            var opened = service.Records("new_possedeveiculo").Single(record => record.Id != possession.Id);
            Assert.Null(opened.GetAttributeValue<EntityReference>("new_motorista"));
            Assert.Equal(vehicle, opened.GetAttributeValue<EntityReference>("new_veiculo").Id);
            Assert.Equal(effectiveAt, opened.GetAttributeValue<DateTime>("new_iniciodaposse"));
        }

        [Fact]
        public void ReturnToBaseTracesTheOpenPossessionLookupForTheDriver()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, driver, null, vehicle, null);
            var possession = Possession(driver, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);
            var tracing = new CollectingTracingService();

            InvokeFinalize(service, exchange.Id, new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc), tracing);

            Assert.Contains(tracing.Entries, entry =>
                entry.Contains("Open possession lookup", StringComparison.Ordinal) &&
                entry.Contains(driver.ToString("D"), StringComparison.Ordinal) &&
                entry.Contains("count=1", StringComparison.Ordinal));
        }

        [Fact]
        public void FirstPickupCreatesClosedBaseHistoryAndOpenDriverPossession()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000002, driver, null, null, vehicle);
            var service = new MemoryService(exchange);
            var effectiveAt = new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc);

            InvokeFinalize(service, exchange.Id, effectiveAt);

            var possessions = service.Records("new_possedeveiculo").ToList();
            Assert.Equal(2, possessions.Count);
            var baseHistory = possessions.Single(record => record.GetAttributeValue<EntityReference>("new_motorista") == null);
            Assert.Equal(effectiveAt, baseHistory.GetAttributeValue<DateTime>("new_iniciodaposse"));
            Assert.Equal(effectiveAt, baseHistory.GetAttributeValue<DateTime?>("new_fimdaposse"));
            var opened = possessions.Single(record => record.GetAttributeValue<EntityReference>("new_motorista")?.Id == driver);
            Assert.Null(opened.GetAttributeValue<DateTime?>("new_fimdaposse"));
        }

        [Fact]
        public void PickupRejectsClosedHistoryGapWithoutSyntheticPossession()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000002, driver, null, null, vehicle);
            var closedDriverPossession = Possession(
                Guid.NewGuid(),
                vehicle,
                new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var latestEnd = new DateTime(2026, 8, 3, 12, 0, 0, DateTimeKind.Utc);
            closedDriverPossession["new_fimdaposse"] = latestEnd;
            var service = new MemoryService(exchange, closedDriverPossession);
            var effectiveAt = new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc);

            var error = Assert.Throws<TargetInvocationException>(() => InvokeFinalize(
                service,
                exchange.Id,
                effectiveAt));

            Assert.Contains("POSSESSION_CHAIN_GAP", error.InnerException?.Message ?? error.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Single(service.Records("new_possedeveiculo"));
        }

        [Fact]
        public void StructuralChangeCannotBeCompletedInTheSameUpdate()
        {
            var oldDriver = Guid.NewGuid();
            var newDriver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, newDriver, null, vehicle, null, 202410001);
            exchange["new_concluidomotorista1"] = true;
            var preImage = Exchange(100000001, oldDriver, null, vehicle, null, 202410000);
            preImage.Id = exchange.Id;
            preImage["new_concluidomotorista1"] = true;
            var possession = Possession(newDriver, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);

            var error = Assert.Throws<TargetInvocationException>(() =>
                InvokeLifecycle(service, exchange.Id, "Update", preImage));

            Assert.Contains("mesma alteração", error.InnerException?.Message ?? error.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
        }

        [Fact]
        public void StatusOnlyTargetIsNotStructuralWhenPreImageOmitsNullLookups()
        {
            var target = new Entity("cr40f_trocasdecarro", Guid.NewGuid())
            {
                ["cr40f_statusdatroca"] = new OptionSetValue(202410001)
            };
            var preImage = new Entity("cr40f_trocasdecarro", target.Id)
            {
                ["cr40f_statusdatroca"] = new OptionSetValue(202410000),
                ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid())
            };

            Assert.False(InvokeHasStructuralChange(target, preImage));
        }

        [Fact]
        public void ExchangeChangeKeepsGeneralCoreFieldsSynchronized()
        {
            var oldDriver = Guid.NewGuid();
            var newDriver = Guid.NewGuid();
            var oldVehicle = Guid.NewGuid();
            var newVehicle = Guid.NewGuid();
            var start = new DateTime(2026, 8, 5, 9, 0, 0, DateTimeKind.Utc);
            var end = start.AddMinutes(30);
            var exchange = Exchange(100000001, newDriver, null, newVehicle, null, 202410000);
            exchange["cr40f_iniciodajaneladetroca"] = start;
            exchange["cr40f_fimdajaneladetroca"] = end;
            var preImage = Exchange(100000001, oldDriver, null, oldVehicle, null, 202410000);
            preImage.Id = exchange.Id;
            var general = new Entity("cr40f_reservadeveculos", Guid.NewGuid())
            {
                ["cr40f_ot"] = exchange.ToEntityReference(),
                ["cr40f_motorista"] = new EntityReference("cr40f_funcionarios", oldDriver),
                ["cr40f_veiculo"] = new EntityReference("cr40f_veiculos", oldVehicle),
                ["cr40f_dataehorriodesada"] = start.AddDays(-1),
                ["cr40f_horrioprevistoderetorno"] = end.AddDays(-1),
                ["cr40f_status"] = new OptionSetValue(202410005)
            };
            var service = new MemoryService(exchange, general);

            InvokeLifecycle(service, exchange.Id, "Update", preImage);

            var updated = service.Record("cr40f_reservadeveculos", general.Id);
            Assert.Equal(newDriver, updated.GetAttributeValue<EntityReference>("cr40f_motorista").Id);
            Assert.Equal(newVehicle, updated.GetAttributeValue<EntityReference>("cr40f_veiculo").Id);
            Assert.Equal(start, updated.GetAttributeValue<DateTime>("cr40f_dataehorriodesada"));
            Assert.Equal(end, updated.GetAttributeValue<DateTime>("cr40f_horrioprevistoderetorno"));
        }

        [Fact]
        public void RetroactiveFinalizationRejectsAnyLaterPossessionHistory()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, driver, null, vehicle, null);
            var current = Possession(driver, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var later = Possession(driver, Guid.NewGuid(), new DateTime(2026, 8, 3, 16, 0, 0, DateTimeKind.Utc));
            later["new_fimdaposse"] = new DateTime(2026, 8, 3, 17, 0, 0, DateTimeKind.Utc);
            var service = new MemoryService(exchange, current, later);

            var error = Assert.Throws<TargetInvocationException>(() => InvokeFinalize(
                service,
                exchange.Id,
                new DateTime(2026, 8, 3, 14, 0, 0, DateTimeKind.Utc)));

            Assert.Contains("posterior", error.InnerException?.Message ?? error.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(service.Record("new_possedeveiculo", current.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
        }

        [Fact]
        public void RetroactiveFinalizationRejectsPossessionThatStartedLater()
        {
            var driver = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, driver, null, vehicle, null);
            var possession = Possession(driver, vehicle, new DateTime(2026, 8, 3, 16, 30, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);

            var error = Assert.Throws<TargetInvocationException>(() => InvokeFinalize(
                service,
                exchange.Id,
                new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc)));

            Assert.Contains("posterior", error.InnerException?.Message ?? error.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
        }

        [Fact]
        public void UnilateralTransferMovesVehicleToDriverWithoutPossession()
        {
            var driver1 = Guid.NewGuid();
            var driver2 = Guid.NewGuid();
            var vehicle = Guid.NewGuid();
            var exchange = Exchange(100000000, driver1, driver2, vehicle, null);
            var possession = Possession(driver1, vehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);
            var effectiveAt = new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc);

            InvokeFinalize(service, exchange.Id, effectiveAt);

            Assert.Equal(effectiveAt, service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
            var opened = service.Records("new_possedeveiculo").Single(record => record.Id != possession.Id);
            Assert.Equal(driver2, opened.GetAttributeValue<EntityReference>("new_motorista").Id);
            Assert.Equal(vehicle, opened.GetAttributeValue<EntityReference>("new_veiculo").Id);
        }

        [Fact]
        public void ExactPairMismatchAbortsWithoutClosingAnything()
        {
            var driver = Guid.NewGuid();
            var expectedVehicle = Guid.NewGuid();
            var actualVehicle = Guid.NewGuid();
            var exchange = Exchange(100000001, driver, null, expectedVehicle, null);
            var possession = Possession(driver, actualVehicle, new DateTime(2026, 8, 3, 10, 0, 0, DateTimeKind.Utc));
            var service = new MemoryService(exchange, possession);

            var error = Assert.Throws<TargetInvocationException>(() => InvokeFinalize(
                service,
                exchange.Id,
                new DateTime(2026, 8, 3, 14, 10, 0, DateTimeKind.Utc)));

            Assert.Contains("diverge", error.InnerException?.Message ?? error.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Null(service.Record("new_possedeveiculo", possession.Id).GetAttributeValue<DateTime?>("new_fimdaposse"));
            Assert.Single(service.Records("new_possedeveiculo"));
        }

        private static Entity Exchange(
            int type,
            Guid driver1,
            Guid? driver2,
            Guid? vehicle1,
            Guid? vehicle2,
            int status = 202410001)
        {
            var entity = new Entity("cr40f_trocasdecarro", Guid.NewGuid())
            {
                ["new_tipodetroca"] = new OptionSetValue(type),
                ["cr40f_statusdatroca"] = new OptionSetValue(status),
                ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", driver1)
            };
            if (driver2.HasValue) entity["cr40f_motorista2"] = new EntityReference("cr40f_funcionarios", driver2.Value);
            if (vehicle1.HasValue) entity["cr40f_veiculo1antesdatroca"] = new EntityReference("cr40f_veiculos", vehicle1.Value);
            if (vehicle2.HasValue) entity["cr40f_veiculo2antesdatroca"] = new EntityReference("cr40f_veiculos", vehicle2.Value);
            return entity;
        }

        private static Entity Possession(Guid? driver, Guid vehicle, DateTime startedAt)
        {
            var entity = new Entity("new_possedeveiculo", Guid.NewGuid())
            {
                ["new_veiculo"] = new EntityReference("cr40f_veiculos", vehicle),
                ["new_iniciodaposse"] = startedAt
            };
            if (driver.HasValue) entity["new_motorista"] = new EntityReference("cr40f_funcionarios", driver.Value);
            return entity;
        }

        private static Entity Copy(Entity source)
        {
            var copy = new Entity(source.LogicalName, source.Id);
            foreach (var item in source.Attributes) copy[item.Key] = item.Value;
            return copy;
        }

        private static void InvokeFinalize(IOrganizationService service, Guid exchangeId, DateTime effectiveAt)
        {
            InvokeFinalize(service, exchangeId, effectiveAt, new NullTracingService());
        }

        private static void InvokeFinalize(IOrganizationService service, Guid exchangeId, DateTime effectiveAt, ITracingService tracing)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangePossessionFinalizer",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, tracing },
                culture: null);
            type.GetMethod(
                    "Finalize",
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    binder: null,
                    types: new[] { typeof(Guid), typeof(DateTime) },
                    modifiers: null)
                .Invoke(instance, new object[] { exchangeId, effectiveAt });
        }

        private static void InvokeLifecycle(IOrganizationService service, Guid exchangeId, string message, Entity preImage)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangeLifecycleCoordinator",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, new NullTracingService() },
                culture: null);
            var target = service.Retrieve("cr40f_trocasdecarro", exchangeId, new ColumnSet(true));
            type.GetMethod(
                    "Process",
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    binder: null,
                    types: new[] { typeof(Guid), typeof(string), typeof(Entity), typeof(Entity) },
                    modifiers: null)
                .Invoke(instance, new object[] { exchangeId, message, target, preImage });
        }

        private static Entity InvokeEnsureGeneral(IOrganizationService service, Entity exchange)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangeLifecycleCoordinator",
                throwOnError: true);
            var instance = Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, new NullTracingService() },
                culture: null);
            return (Entity)type.GetMethod("EnsureGeneral", BindingFlags.Instance | BindingFlags.NonPublic)
                .Invoke(instance, new object[] { exchange });
        }

        private static bool InvokeHasStructuralChange(Entity target, Entity preImage)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangeLifecycleCoordinator",
                throwOnError: true);
            var method = type.GetMethod("HasStructuralChange", BindingFlags.Static | BindingFlags.NonPublic);
            return (bool)method.Invoke(null, new object[] { target, preImage });
        }

        private sealed class NullTracingService : ITracingService
        {
            public void Trace(string format, params object[] args) { }
        }

        private sealed class CollectingTracingService : ITracingService
        {
            public List<string> Entries { get; } = new List<string>();

            public void Trace(string format, params object[] args)
            {
                Entries.Add(string.Format(format, args));
            }
        }

        private sealed class MemoryService : IOrganizationService
        {
            private readonly Dictionary<string, Dictionary<Guid, Entity>> _records =
                new Dictionary<string, Dictionary<Guid, Entity>>(StringComparer.OrdinalIgnoreCase);

            public MemoryService(params Entity[] records)
            {
                foreach (var record in records) Store(record);
            }

            public IEnumerable<Entity> Records(string logicalName) =>
                _records.TryGetValue(logicalName, out var rows) ? rows.Values : Enumerable.Empty<Entity>();

            public Entity Record(string logicalName, Guid id) => _records[logicalName][id];

            public Guid Create(Entity entity)
            {
                if (entity.Id == Guid.Empty) entity.Id = Guid.NewGuid();
                Store(entity);
                return entity.Id;
            }

            public void Update(Entity entity)
            {
                var current = Record(entity.LogicalName, entity.Id);
                foreach (var item in entity.Attributes) current[item.Key] = item.Value;
            }

            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => Clone(Record(entityName, id));

            public EntityCollection RetrieveMultiple(QueryBase query)
            {
                var expression = (QueryExpression)query;
                var rows = Records(expression.EntityName)
                    .Where(row => Matches(row, expression.Criteria))
                    .Take(expression.TopCount ?? int.MaxValue)
                    .Select(Clone)
                    .ToList();
                return new EntityCollection(rows);
            }

            private static bool Matches(Entity row, FilterExpression filter)
            {
                var conditionResults = filter.Conditions.Select(condition => Matches(row, condition));
                var filterResults = filter.Filters.Select(child => Matches(row, child));
                var results = conditionResults.Concat(filterResults).ToList();
                return filter.FilterOperator == LogicalOperator.Or ? results.Any(value => value) : results.All(value => value);
            }

            private static bool Matches(Entity row, ConditionExpression condition)
            {
                row.Attributes.TryGetValue(condition.AttributeName, out var raw);
                var actual = raw is EntityReference reference ? (object)reference.Id : raw;
                var expected = condition.Values.FirstOrDefault();
                switch (condition.Operator)
                {
                    case ConditionOperator.Equal:
                        return Equals(actual, expected);
                    case ConditionOperator.NotEqual:
                        return !Equals(actual, expected);
                    case ConditionOperator.Null:
                        return raw == null;
                    case ConditionOperator.NotNull:
                        return raw != null;
                    case ConditionOperator.GreaterThan:
                        return raw is DateTime actualDate && expected is DateTime expectedDate && actualDate > expectedDate;
                    default:
                        throw new NotSupportedException($"Condition {condition.Operator} não suportada no teste.");
                }
            }

            private void Store(Entity entity)
            {
                if (!_records.TryGetValue(entity.LogicalName, out var rows))
                {
                    rows = new Dictionary<Guid, Entity>();
                    _records[entity.LogicalName] = rows;
                }
                rows[entity.Id] = Clone(entity);
            }

            private static Entity Clone(Entity source)
            {
                var clone = new Entity(source.LogicalName, source.Id);
                foreach (var item in source.Attributes) clone[item.Key] = item.Value;
                return clone;
            }

            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
        }
    }
}
