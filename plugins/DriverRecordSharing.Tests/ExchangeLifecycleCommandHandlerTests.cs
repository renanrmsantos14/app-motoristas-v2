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
