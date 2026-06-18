using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    public sealed class ServiceDriverSharePlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);

            try
            {
                tracing.Trace(
                    "ServiceDriverSharePlugin start correlationId={0} message={1} entity={2} stage={3} mode={4}",
                    context.CorrelationId,
                    context.MessageName,
                    context.PrimaryEntityName,
                    context.Stage,
                    context.Mode);

                if (!IsSupported(context))
                {
                    tracing.Trace("ServiceDriverSharePlugin skip unsupported context.");
                    return;
                }

                var target = (Entity)context.InputParameters["Target"];
                var preImage = context.PreEntityImages.Contains(PluginConfig.PreImageAlias)
                    ? context.PreEntityImages[PluginConfig.PreImageAlias]
                    : null;

                var newDriver = target.Contains(PluginConfig.ServiceDriverLookup)
                    ? target.GetAttributeValue<EntityReference>(PluginConfig.ServiceDriverLookup)
                    : null;
                var oldDriver = preImage?.GetAttributeValue<EntityReference>(PluginConfig.ServiceDriverLookup);

                if (context.MessageName == PluginConfig.UpdateMessage && !target.Contains(PluginConfig.ServiceDriverLookup))
                {
                    tracing.Trace("ServiceDriverSharePlugin skip because target does not contain filtered attribute.");
                    return;
                }

                if (SameReference(newDriver, oldDriver))
                {
                    tracing.Trace("ServiceDriverSharePlugin skip because old and new driver are equal.");
                    return;
                }

                var serviceReference = new EntityReference(PluginConfig.ServiceTable, context.PrimaryEntityId);
                var resolver = new DriverResolver(service, tracing);
                var accessHelper = new DataverseAccessHelper(service, tracing);
                var repository = new ServicePassengerRepository(service, tracing);

                var servicePassengerLinks = repository.ListByService(context.PrimaryEntityId);

                if (newDriver != null)
                {
                    var newResolvedDriver = resolver.Resolve(newDriver, throwIfUserMissing: true);
                    GrantHierarchyAccess(serviceReference, newResolvedDriver.UserReference, servicePassengerLinks, accessHelper, tracing);
                }

                if (oldDriver != null && !SameReference(newDriver, oldDriver))
                {
                    tracing.Trace(
                        "ServiceDriverSharePlugin revocation disabled for now oldDriverEmployeeId={0} serviceId={1}",
                        oldDriver.Id,
                        context.PrimaryEntityId);
                }

                tracing.Trace("ServiceDriverSharePlugin done serviceId={0}", context.PrimaryEntityId);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                tracing.Trace("ServiceDriverSharePlugin error: {0}", ex);
                throw new InvalidPluginExecutionException("Falha ao sincronizar compartilhamento do serviço para motorista.", ex);
            }
        }

        private static bool IsSupported(IPluginExecutionContext context)
        {
            if (context == null)
            {
                return false;
            }

            if (context.PrimaryEntityName != PluginConfig.ServiceTable)
            {
                return false;
            }

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity))
            {
                return false;
            }

            return context.MessageName == PluginConfig.CreateMessage || context.MessageName == PluginConfig.UpdateMessage;
        }

        private static void GrantHierarchyAccess(
            EntityReference serviceReference,
            EntityReference userReference,
            IReadOnlyList<ServicePassengerLink> servicePassengerLinks,
            DataverseAccessHelper accessHelper,
            ITracingService tracing)
        {
            accessHelper.EnsureAccess(serviceReference, userReference, PluginConfig.ServiceAccessRights);

            var grantedPassengers = new HashSet<Guid>();
            foreach (var item in servicePassengerLinks)
            {
                accessHelper.EnsureAccess(item.ServicePassengerReference, userReference, PluginConfig.ServicePassengerAccessRights);

                if (item.PassengerReference == null || !grantedPassengers.Add(item.PassengerReference.Id))
                {
                    continue;
                }

                tracing.Trace(
                    "GrantHierarchyAccess passenger target={0}:{1} user={2}:{3}",
                    item.PassengerReference.LogicalName,
                    item.PassengerReference.Id,
                    userReference.LogicalName,
                    userReference.Id);

                accessHelper.EnsureAccess(item.PassengerReference, userReference, PluginConfig.PassengerAccessRights);
            }
        }

        private static bool SameReference(EntityReference left, EntityReference right)
        {
            if (left == null && right == null)
            {
                return true;
            }

            if (left == null || right == null)
            {
                return false;
            }

            return left.LogicalName == right.LogicalName && left.Id == right.Id;
        }
    }
}
