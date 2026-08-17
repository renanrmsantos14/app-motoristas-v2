using System;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    public sealed class ExchangeLifecycleCommandPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var callerService = factory.CreateOrganizationService(context.UserId);
            var systemService = factory.CreateOrganizationService(null);

            try
            {
                LifecycleAuthorization.Authorize(context);
                var handler = new ExchangeLifecycleCommandHandler(callerService, systemService, tracing, context);
                handler.Execute();
            }
            catch (InvalidPluginExecutionException ex)
            {
                new OperationalLogWriter(systemService, tracing).TryWriteError(context, ex);
                throw;
            }
            catch (Exception ex)
            {
                tracing?.Trace("ExchangeLifecycleCommandPlugin error: {0}", ex);
                new OperationalLogWriter(systemService, tracing).TryWriteError(context, ex);
                throw new InvalidPluginExecutionException(
                    PluginErrorMessage.ForUser(ex, context.CorrelationId),
                    ex);
            }
        }
    }
}
