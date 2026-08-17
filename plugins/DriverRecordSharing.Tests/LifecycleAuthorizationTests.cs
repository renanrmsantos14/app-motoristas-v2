using System.Reflection;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class LifecycleAuthorizationTests
    {
        [Fact]
        public void CompletedExchangeParentWithoutKnownCommandDoesNotAuthorizePossessionCreate()
        {
            var context = PossessionContext("Create", ExchangeParent(202410001));

            Assert.False(IsAuthorized(context));
        }

        [Fact]
        public void NonCompletedExchangeParentDoesNotAllowPossessionCreate()
        {
            var context = PossessionContext("Create", ExchangeParent(202410000));

            Assert.False(IsAuthorized(context));
        }

        [Fact]
        public void CompletedExchangeParentDoesNotAllowPossessionDelete()
        {
            var context = PossessionContext("Delete", ExchangeParent(202410001));

            Assert.False(IsAuthorized(context));
        }

        [Fact]
        public void DirectPossessionUpdateRemainsBlocked()
        {
            Assert.False(IsAuthorized(PossessionContext("Update", null)));
        }

        [Fact]
        public void ApprovedCustomApiParentAuthorizesNestedExchangeUpdate()
        {
            var command = new RemoteExecutionContext
            {
                MessageName = "new_CancelarTrocaDeCarro",
                PrimaryEntityName = "cr40f_trocasdecarro",
                Stage = 30,
                Mode = 0
            };
            var update = new RemoteExecutionContext
            {
                MessageName = "Update",
                PrimaryEntityName = "cr40f_trocasdecarro",
                Stage = 10,
                Mode = 0,
                ParentContext = command
            };

            Assert.True(IsAuthorized(update));
        }

        [Fact]
        public void UnknownCustomApiParentDoesNotAuthorizeNestedExchangeUpdate()
        {
            var command = new RemoteExecutionContext
            {
                MessageName = "new_ComandoNaoAutorizado",
                PrimaryEntityName = "cr40f_trocasdecarro",
                Stage = 30,
                Mode = 0
            };
            var update = new RemoteExecutionContext
            {
                MessageName = "Update",
                PrimaryEntityName = "cr40f_trocasdecarro",
                Stage = 10,
                Mode = 0,
                ParentContext = command
            };

            Assert.False(IsAuthorized(update));
        }

        [Fact]
        public void UnprovisionedReconciliationCommandDoesNotAuthorizeNestedWrite()
        {
            var command = new RemoteExecutionContext { MessageName = "new_AplicarReconciliacaoTroca" };
            var update = new RemoteExecutionContext
            {
                MessageName = "Create",
                PrimaryEntityName = "new_possedeveiculo",
                ParentContext = command
            };

            Assert.False(IsAuthorized(update));
        }

        private static RemoteExecutionContext ExchangeParent(int status)
        {
            var context = new RemoteExecutionContext
            {
                PrimaryEntityName = "cr40f_trocasdecarro",
                MessageName = "Update",
                Stage = 40,
                Mode = 0
            };
            context.InputParameters["Target"] = new Entity("cr40f_trocasdecarro")
            {
                ["cr40f_statusdatroca"] = new OptionSetValue(status)
            };
            return context;
        }

        private static RemoteExecutionContext PossessionContext(string message, RemoteExecutionContext parent)
        {
            return new RemoteExecutionContext
            {
                PrimaryEntityName = "new_possedeveiculo",
                MessageName = message,
                Stage = 10,
                Mode = 0,
                ParentContext = parent
            };
        }

        private static bool IsAuthorized(IPluginExecutionContext context)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.LifecycleAuthorization",
                throwOnError: true);
            return (bool)type.GetMethod("IsAuthorized", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                .Invoke(null, new object[] { context });
        }
    }
}
