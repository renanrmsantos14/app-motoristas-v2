using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ExchangeMutationGuardTests
    {
        [Fact]
        public void DirectLinkedGeneralCreateIsBlockedWithoutRetrievingUncommittedRecord()
        {
            var exchangeId = Guid.NewGuid();
            var context = new RemoteExecutionContext
            {
                MessageName = "Create",
                PrimaryEntityName = "cr40f_reservadeveiculos",
                PrimaryEntityId = Guid.NewGuid(),
                Stage = 10,
                Mode = 0
            };
            context.InputParameters["Target"] = new Entity("cr40f_reservadeveiculos")
            {
                ["cr40f_ot"] = new EntityReference("cr40f_trocasdecarro", exchangeId)
            };
            var service = new NoRetrieveOrganizationService();

            var exception = Assert.Throws<TargetInvocationException>(() => InvokeValidate(context, service));

            var pluginException = Assert.IsType<InvalidPluginExecutionException>(exception.InnerException);
            Assert.Contains("[FORBIDDEN_LIFECYCLE]", pluginException.Message);
            Assert.False(service.RetrieveCalled);
        }

        private static void InvokeValidate(IPluginExecutionContext context, IOrganizationService service)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.ExchangeMutationGuard",
                throwOnError: true);
            type.GetMethod("ValidateGeneral", BindingFlags.Static | BindingFlags.NonPublic)
                .Invoke(null, new object[] { context, service });
        }

        private sealed class NoRetrieveOrganizationService : IOrganizationService
        {
            public bool RetrieveCalled { get; private set; }
            public Guid Create(Entity entity) => throw new NotSupportedException();
            public void Update(Entity entity) => throw new NotSupportedException();
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
            public EntityCollection RetrieveMultiple(QueryBase query) => throw new NotSupportedException();
            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();

            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet)
            {
                RetrieveCalled = true;
                throw new InvalidOperationException("Create nao pode recuperar o registro ainda nao persistido.");
            }
        }
    }
}
