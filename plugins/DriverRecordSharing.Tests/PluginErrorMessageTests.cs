using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class PluginErrorMessageTests
    {
        [Fact]
        public void BusinessErrorKeepsSafeMessageAndCorrelation()
        {
            var correlation = Guid.NewGuid();
            var result = ForUser(
                new InvalidPluginExecutionException("Motorista da devolução não possui posse de veículo aberta."),
                correlation);

            Assert.Contains("[POSSESSION_NOT_OPEN]", result);
            Assert.Contains("não possui posse", result);
            Assert.Contains(correlation.ToString("N"), result);
        }

        [Fact]
        public void MetadataErrorDoesNotLeakSchemaDetails()
        {
            var result = ForUser(
                new Exception("entity doesn't contain attribute cr40f_segredo and NameMapping Logical"),
                Guid.NewGuid());

            Assert.Contains("[EXCHANGE_INTERNAL_ERROR]", result);
            Assert.DoesNotContain("cr40f_segredo", result);
            Assert.DoesNotContain("NameMapping", result);
        }

        [Fact]
        public void IdentityErrorDoesNotLeakPersonOrEmail()
        {
            var result = ForUser(
                new InvalidPluginExecutionException("Existe email pessoa@empresa.com no funcionário Nome Completo, mas não existe systemuser ativo."),
                Guid.NewGuid());

            Assert.Contains("[IDENTITY_NOT_MAPPED]", result);
            Assert.DoesNotContain("pessoa@empresa.com", result);
            Assert.DoesNotContain("Nome Completo", result);
        }

        private static string ForUser(Exception exception, Guid correlationId)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.PluginErrorMessage",
                throwOnError: true);
            return (string)type.GetMethod("ForUser", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                .Invoke(null, new object[] { exception, correlationId });
        }
    }
}
