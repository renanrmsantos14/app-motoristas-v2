using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class QuoteRequestOriginTests
    {
        private const string QuoteRequestTable = "cr40f_pedidodecotacao";
        private const string QuoteRequestLastSyncOrigin = "cr40f_origemultimasincronizacao";
        private const string QuoteRequestStatus = "cr40f_statuscotacao";
        private const string QuoteRequestPriority = "cr40f_prioridade";
        private const string QuoteRequestManualOrigin = "Manual";

        private static readonly MethodInfo BuildPatchMethod =
            typeof(ServiceDriverSharePlugin).GetMethod(
                "BuildManualQuoteOriginPatchIfNeeded",
                BindingFlags.NonPublic | BindingFlags.Static);

        [Fact]
        public void KeepsPlannerWhenPayloadAlreadyContainsOrigin()
        {
            var target = NewQuoteTarget();
            target[QuoteRequestLastSyncOrigin] = "Planner";
            target[QuoteRequestStatus] = new OptionSetValue(100004003);

            var patch = BuildPatch(Guid.NewGuid(), target);

            Assert.Null(patch);
        }

        [Fact]
        public void KeepsDataverseWhenPayloadAlreadyContainsOrigin()
        {
            var target = NewQuoteTarget();
            target[QuoteRequestLastSyncOrigin] = "Dataverse";
            target[QuoteRequestPriority] = new OptionSetValue(100003002);

            var patch = BuildPatch(Guid.NewGuid(), target);

            Assert.Null(patch);
        }

        [Fact]
        public void SetsManualWhenBusinessFieldChangesWithoutOriginInPayload()
        {
            var quoteId = Guid.NewGuid();
            var target = NewQuoteTarget();
            target[QuoteRequestStatus] = new OptionSetValue(100004003);

            var patch = BuildPatch(quoteId, target);

            Assert.NotNull(patch);
            Assert.Equal(QuoteRequestTable, patch.LogicalName);
            Assert.Equal(quoteId, patch.Id);
            Assert.Equal(
                QuoteRequestManualOrigin,
                patch.GetAttributeValue<string>(QuoteRequestLastSyncOrigin));
        }

        [Fact]
        public void DoesNotSetManualWhenNoMonitoredBusinessFieldChanged()
        {
            var target = NewQuoteTarget();
            target["cr40f_linktarefaplanner"] = "https://planner.example/task";

            var patch = BuildPatch(Guid.NewGuid(), target);

            Assert.Null(patch);
        }

        private static Entity BuildPatch(Guid quoteId, Entity target)
        {
            Assert.NotNull(BuildPatchMethod);
            return (Entity)BuildPatchMethod.Invoke(null, new object[] { quoteId, target });
        }

        private static Entity NewQuoteTarget()
        {
            return new Entity(QuoteRequestTable);
        }
    }
}
