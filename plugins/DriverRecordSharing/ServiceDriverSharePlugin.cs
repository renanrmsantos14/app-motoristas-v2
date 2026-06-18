using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    public sealed class ServiceDriverSharePlugin : IPlugin
    {
        private static readonly EntityShareDefinition[] DirectEntityDefinitions =
        {
            new EntityShareDefinition(
                PluginConfig.ServiceTable,
                true,
                PluginConfig.ServiceDriverLookup),
            new EntityShareDefinition(
                PluginConfig.ExchangeTable,
                false,
                PluginConfig.ExchangeDriver1Lookup,
                PluginConfig.ExchangeDriver2Lookup),
            new EntityShareDefinition(
                PluginConfig.VehiclePossessionTable,
                false,
                PluginConfig.VehiclePossessionDriverLookup),
            new EntityShareDefinition(
                PluginConfig.CollisionTable,
                false,
                PluginConfig.CollisionDriverLookup),
            new EntityShareDefinition(
                PluginConfig.ReceiptTable,
                false,
                PluginConfig.ReceiptDriverLookup)
        };

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
                var resolver = new DriverResolver(service, tracing);
                var accessHelper = new DataverseAccessHelper(service, tracing);
                var servicePassengerRepository = new ServicePassengerRepository(service, tracing);

                if (context.PrimaryEntityName == PluginConfig.ServicePassengerTable)
                {
                    HandleServicePassenger(
                        context,
                        service,
                        target,
                        preImage,
                        resolver,
                        accessHelper,
                        servicePassengerRepository,
                        tracing);
                    return;
                }

                var definition = GetDirectEntityDefinition(context.PrimaryEntityName);
                if (definition == null)
                {
                    tracing.Trace("ServiceDriverSharePlugin skip because entity definition was not found.");
                    return;
                }

                HandleDirectEntity(
                    context,
                    service,
                    target,
                    preImage,
                    definition,
                    resolver,
                    accessHelper,
                    servicePassengerRepository,
                    tracing);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                tracing.Trace("ServiceDriverSharePlugin error: {0}", ex);
                throw new InvalidPluginExecutionException(
                    "Falha ao sincronizar compartilhamento do registro com o motorista.",
                    ex);
            }
        }

        private static void HandleDirectEntity(
            IPluginExecutionContext context,
            IOrganizationService service,
            Entity target,
            Entity preImage,
            EntityShareDefinition definition,
            DriverResolver resolver,
            DataverseAccessHelper accessHelper,
            ServicePassengerRepository servicePassengerRepository,
            ITracingService tracing)
        {
            if (context.MessageName == PluginConfig.UpdateMessage &&
                !ContainsAnyAttribute(target, definition.DriverLookupAttributes))
            {
                tracing.Trace("HandleDirectEntity skip because no tracked driver attribute changed.");
                return;
            }

            var targetReference = new EntityReference(context.PrimaryEntityName, context.PrimaryEntityId);
            var grantedUsers = new HashSet<Guid>();
            var resolvedDrivers = 0;

            foreach (var attributeName in definition.DriverLookupAttributes)
            {
                var employeeReference = GetEffectiveLookupValue(
                    service,
                    context.PrimaryEntityName,
                    context.PrimaryEntityId,
                    target,
                    preImage,
                    attributeName,
                    context.MessageName == PluginConfig.UpdateMessage);

                if (employeeReference == null)
                {
                    tracing.Trace("HandleDirectEntity skip attribute={0} because employee lookup is empty.", attributeName);
                    continue;
                }

                var driver = resolver.Resolve(employeeReference);
                if (driver == null)
                {
                    tracing.Trace(
                        "HandleDirectEntity skip attribute={0} employeeId={1} because no Microsoft email was configured.",
                        attributeName,
                        employeeReference.Id);
                    continue;
                }

                if (!grantedUsers.Add(driver.UserReference.Id))
                {
                    tracing.Trace(
                        "HandleDirectEntity skip duplicate principal userId={0} attribute={1}.",
                        driver.UserReference.Id,
                        attributeName);
                    continue;
                }

                resolvedDrivers++;

                if (definition.IncludeServiceHierarchy)
                {
                    var links = servicePassengerRepository.ListByService(context.PrimaryEntityId);
                    GrantServiceHierarchy(targetReference, driver.UserReference, links, accessHelper, tracing);
                    continue;
                }

                accessHelper.EnsureAccess(targetReference, driver.UserReference, PluginConfig.AssignedRecordAccessRights);
            }

            tracing.Trace(
                "HandleDirectEntity done entity={0} id={1} resolvedDrivers={2}",
                context.PrimaryEntityName,
                context.PrimaryEntityId,
                resolvedDrivers);
        }

        private static void HandleServicePassenger(
            IPluginExecutionContext context,
            IOrganizationService service,
            Entity target,
            Entity preImage,
            DriverResolver resolver,
            DataverseAccessHelper accessHelper,
            ServicePassengerRepository servicePassengerRepository,
            ITracingService tracing)
        {
            if (context.MessageName == PluginConfig.UpdateMessage &&
                !ContainsAnyAttribute(
                    target,
                    PluginConfig.ServicePassengerServiceLookup,
                    PluginConfig.ServicePassengerPassengerLookup))
            {
                tracing.Trace("HandleServicePassenger skip because service/passenger link did not change.");
                return;
            }

            var link = BuildServicePassengerLink(
                context.MessageName,
                context.PrimaryEntityId,
                target,
                preImage,
                servicePassengerRepository);

            if (link?.ServiceReference == null)
            {
                tracing.Trace("HandleServicePassenger skip because parent service is empty.");
                return;
            }

            var serviceDrivers = LoadServiceDriverReferences(service, link.ServiceReference.Id);
            if (serviceDrivers.Count == 0)
            {
                tracing.Trace("HandleServicePassenger skip because parent service has no driver.");
                return;
            }

            var grantedUsers = new HashSet<Guid>();
            var resolvedDrivers = 0;

            foreach (var employeeReference in serviceDrivers)
            {
                var driver = resolver.Resolve(employeeReference);
                if (driver == null)
                {
                    tracing.Trace(
                        "HandleServicePassenger skip employeeId={0} because no Microsoft email was configured.",
                        employeeReference.Id);
                    continue;
                }

                if (!grantedUsers.Add(driver.UserReference.Id))
                {
                    continue;
                }

                resolvedDrivers++;
                GrantServiceHierarchy(link.ServiceReference, driver.UserReference, new[] { link }, accessHelper, tracing);
            }

            tracing.Trace(
                "HandleServicePassenger done id={0} resolvedDrivers={1}",
                context.PrimaryEntityId,
                resolvedDrivers);
        }

        private static ServicePassengerLink BuildServicePassengerLink(
            string messageName,
            Guid servicePassengerId,
            Entity target,
            Entity preImage,
            ServicePassengerRepository repository)
        {
            var loaded = messageName == PluginConfig.UpdateMessage
                ? repository.Load(servicePassengerId)
                : null;
            var serviceReference = GetEffectiveLookupValue(
                loaded?.ServiceReference,
                target,
                preImage,
                PluginConfig.ServicePassengerServiceLookup);
            var passengerReference = GetEffectiveLookupValue(
                loaded?.PassengerReference,
                target,
                preImage,
                PluginConfig.ServicePassengerPassengerLookup);

            return new ServicePassengerLink(
                new EntityReference(PluginConfig.ServicePassengerTable, servicePassengerId),
                serviceReference,
                passengerReference);
        }

        private static IReadOnlyList<EntityReference> LoadServiceDriverReferences(IOrganizationService service, Guid serviceId)
        {
            var entity = service.Retrieve(
                PluginConfig.ServiceTable,
                serviceId,
                new ColumnSet(PluginConfig.ServiceDriverLookup));

            var drivers = new List<EntityReference>(1);
            var driverReference = entity.GetAttributeValue<EntityReference>(PluginConfig.ServiceDriverLookup);
            if (driverReference != null)
            {
                drivers.Add(driverReference);
            }

            return drivers;
        }

        private static EntityReference GetEffectiveLookupValue(
            IOrganizationService service,
            string entityName,
            Guid entityId,
            Entity target,
            Entity preImage,
            string attributeName,
            bool allowRetrieveCurrent)
        {
            if (target != null && target.Contains(attributeName))
            {
                return target.GetAttributeValue<EntityReference>(attributeName);
            }

            if (preImage != null && preImage.Contains(attributeName))
            {
                return preImage.GetAttributeValue<EntityReference>(attributeName);
            }

            if (!allowRetrieveCurrent)
            {
                return null;
            }

            var current = service.Retrieve(entityName, entityId, new ColumnSet(attributeName));
            return current.GetAttributeValue<EntityReference>(attributeName);
        }

        private static EntityReference GetEffectiveLookupValue(
            EntityReference currentValue,
            Entity target,
            Entity preImage,
            string attributeName)
        {
            if (target != null && target.Contains(attributeName))
            {
                return target.GetAttributeValue<EntityReference>(attributeName);
            }

            if (preImage != null && preImage.Contains(attributeName))
            {
                return preImage.GetAttributeValue<EntityReference>(attributeName);
            }

            return currentValue;
        }

        private static EntityShareDefinition GetDirectEntityDefinition(string entityName)
        {
            foreach (var definition in DirectEntityDefinitions)
            {
                if (definition.EntityName == entityName)
                {
                    return definition;
                }
            }

            return null;
        }

        private static bool IsSupported(IPluginExecutionContext context)
        {
            if (context == null)
            {
                return false;
            }

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity))
            {
                return false;
            }

            if (context.MessageName != PluginConfig.CreateMessage && context.MessageName != PluginConfig.UpdateMessage)
            {
                return false;
            }

            if (context.PrimaryEntityName == PluginConfig.ServicePassengerTable)
            {
                return true;
            }

            return GetDirectEntityDefinition(context.PrimaryEntityName) != null;
        }

        private static void GrantServiceHierarchy(
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
                accessHelper.EnsureAccess(
                    item.ServicePassengerReference,
                    userReference,
                    PluginConfig.ServicePassengerAccessRights);

                if (item.PassengerReference == null || !grantedPassengers.Add(item.PassengerReference.Id))
                {
                    continue;
                }

                tracing.Trace(
                    "GrantServiceHierarchy passenger target={0}:{1} user={2}:{3}",
                    item.PassengerReference.LogicalName,
                    item.PassengerReference.Id,
                    userReference.LogicalName,
                    userReference.Id);

                accessHelper.EnsureAccess(
                    item.PassengerReference,
                    userReference,
                    PluginConfig.PassengerAccessRights);
            }
        }

        private static bool ContainsAnyAttribute(Entity entity, params string[] attributeNames)
        {
            if (entity == null || attributeNames == null)
            {
                return false;
            }

            foreach (var attributeName in attributeNames)
            {
                if (entity.Contains(attributeName))
                {
                    return true;
                }
            }

            return false;
        }
    }

    internal sealed class EntityShareDefinition
    {
        public EntityShareDefinition(string entityName, bool includeServiceHierarchy, params string[] driverLookupAttributes)
        {
            EntityName = entityName;
            IncludeServiceHierarchy = includeServiceHierarchy;
            DriverLookupAttributes = driverLookupAttributes ?? Array.Empty<string>();
        }

        public string EntityName { get; }

        public bool IncludeServiceHierarchy { get; }

        public string[] DriverLookupAttributes { get; }
    }
}
