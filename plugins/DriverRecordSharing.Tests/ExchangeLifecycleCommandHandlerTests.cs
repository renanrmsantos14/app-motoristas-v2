using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ExchangeLifecycleCommandHandlerTests
    {
        [Fact]
        public void MinimumCustomApiDateIsTreatedAsNotProvided()
        {
            var context = new RemoteExecutionContext();
            context.InputParameters["new_DataEfetiva"] = DateTime.MinValue;
            var handler = CreateHandler(context);

            var result = InvokeReadEffectiveAt(handler);

            Assert.Null(result);
        }

        [Fact]
        public void InternalCompletionCanSkipClientExpectedVersion()
        {
            var context = new RemoteExecutionContext();
            var handler = CreateHandler(context);
            var exchange = new Entity("cr40f_trocasdecarro") { RowVersion = "10" };

            var exception = Record.Exception(() => InvokeValidateExpectedVersion(handler, exchange, false));

            Assert.Null(exception);
        }

        [Fact]
        public void CompensationReusesOriginalOperationNumber()
        {
            var handler = CreateHandler(new RemoteExecutionContext());
            var original = new Entity("cr40f_trocasdecarro", Guid.NewGuid())
            {
                ["cr40f_id"] = "OT-0001",
                ["new_tipodetroca"] = new OptionSetValue(100000000),
                ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_motorista2"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_veiculo1antesdatroca"] = new EntityReference("cr40f_veiculos", Guid.NewGuid())
            };

            var compensation = InvokeBuildCompensation(handler, original);

            Assert.Equal("REV-0001", compensation.GetAttributeValue<string>("cr40f_id"));
        }

        [Fact]
        public void CompensationFallsBackToGuidWhenOriginalNumberIsMissing()
        {
            var originalId = Guid.NewGuid();
            var handler = CreateHandler(new RemoteExecutionContext());
            var original = new Entity("cr40f_trocasdecarro", originalId)
            {
                ["new_tipodetroca"] = new OptionSetValue(100000000),
                ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_motorista2"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_veiculo1antesdatroca"] = new EntityReference("cr40f_veiculos", Guid.NewGuid())
            };

            var compensation = InvokeBuildCompensation(handler, original);

            Assert.Equal("REV-" + originalId.ToString("N"), compensation.GetAttributeValue<string>("cr40f_id"));
        }

        [Fact]
        public void CompensationDoesNotReuseAReversalNumber()
        {
            var originalId = Guid.NewGuid();
            var handler = CreateHandler(new RemoteExecutionContext());
            var original = new Entity("cr40f_trocasdecarro", originalId)
            {
                ["cr40f_id"] = "REV-0001",
                ["new_tipodetroca"] = new OptionSetValue(100000000),
                ["cr40f_motorista1"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_motorista2"] = new EntityReference("cr40f_funcionarios", Guid.NewGuid()),
                ["cr40f_veiculo1antesdatroca"] = new EntityReference("cr40f_veiculos", Guid.NewGuid())
            };

            var compensation = InvokeBuildCompensation(handler, original);

            Assert.Equal("REV-" + originalId.ToString("N"), compensation.GetAttributeValue<string>("cr40f_id"));
        }

        private static object CreateHandler(IPluginExecutionContext context)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangeLifecycleCommandHandler",
                throwOnError: true);
            var service = new UnsupportedOrganizationService();
            return Activator.CreateInstance(
                type,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                args: new object[] { service, service, null, context },
                culture: null);
        }

        private static DateTime? InvokeReadEffectiveAt(object handler)
        {
            var method = handler.GetType().GetMethod("ReadEffectiveAt", BindingFlags.Instance | BindingFlags.NonPublic);
            return (DateTime?)method.Invoke(handler, null);
        }

        private static void InvokeValidateExpectedVersion(object handler, Entity exchange, bool required)
        {
            var method = handler.GetType().GetMethod("ValidateExpectedVersion", BindingFlags.Instance | BindingFlags.NonPublic);
            method.Invoke(handler, new object[] { exchange, required });
        }

        private static Entity InvokeBuildCompensation(object handler, Entity original)
        {
            var method = handler.GetType().GetMethod("BuildCompensation", BindingFlags.Instance | BindingFlags.NonPublic);
            return (Entity)method.Invoke(handler, new object[] { original, "teste", DateTime.UtcNow });
        }

        private sealed class UnsupportedOrganizationService : IOrganizationService
        {
            public Guid Create(Entity entity) => throw new NotSupportedException();
            public void Update(Entity entity) => throw new NotSupportedException();
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet) => throw new NotSupportedException();
            public EntityCollection RetrieveMultiple(QueryBase query) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
        }
    }
}
