using System;
using System.Collections.Generic;
using Microsoft.Crm.Sdk.Messages;
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
                PluginConfig.ServiceAccessRights,
                PluginConfig.ServiceDriverLookup),
            new EntityShareDefinition(
                PluginConfig.ExchangeTable,
                false,
                PluginConfig.AssignedRecordAccessRights,
                PluginConfig.ExchangeDriver1Lookup,
                PluginConfig.ExchangeDriver2Lookup),
            new EntityShareDefinition(
                PluginConfig.VehiclePossessionTable,
                false,
                PluginConfig.AssignedRecordAccessRights,
                PluginConfig.VehiclePossessionDriverLookup),
            new EntityShareDefinition(
                PluginConfig.CollisionTable,
                false,
                PluginConfig.AssignedRecordAccessRights,
                PluginConfig.CollisionDriverLookup),
            new EntityShareDefinition(
                PluginConfig.ReceiptTable,
                false,
                PluginConfig.AssignedRecordAccessRights,
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
                    "ServiceDriverSharePlugin start correlationId={0} message={1} entity={2} stage={3} mode={4} depth={5}",
                    context.CorrelationId,
                    context.MessageName,
                    context.PrimaryEntityName,
                    context.Stage,
                    context.Mode,
                    context.Depth);

                if (!IsSupported(context))
                {
                    tracing.Trace("ServiceDriverSharePlugin skip unsupported context.");
                    return;
                }

                var target = (Entity)context.InputParameters[PluginConfig.TargetParameterName];
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
            if (context.MessageName == PluginConfig.UpdateMessage)
            {
                EnsurePreImage(context, preImage, definition.DriverLookupAttributes);

                if (!ContainsAnyAttribute(target, definition.DriverLookupAttributes))
                {
                    tracing.Trace("HandleDirectEntity skip because no tracked driver attribute changed.");
                    return;
                }
            }

            var currentEntity = service.Retrieve(
                definition.EntityName,
                context.PrimaryEntityId,
                new ColumnSet(definition.DriverLookupAttributes));

            var currentDrivers = ResolveDriverSet(
                LoadLookupReferences(currentEntity, definition.DriverLookupAttributes),
                resolver,
                DriverResolutionMode.StrictForGrant);
            var previousDrivers = context.MessageName == PluginConfig.UpdateMessage
                ? ResolveDriverSet(
                    LoadLookupReferences(preImage, definition.DriverLookupAttributes),
                    resolver,
                    DriverResolutionMode.BestEffortForRevoke)
                : new Dictionary<Guid, ResolvedDriver>();

            var targetReference = new EntityReference(definition.EntityName, context.PrimaryEntityId);

            foreach (var driver in currentDrivers.Values)
            {
                if (definition.IncludeServiceHierarchy)
                {
                    GrantServiceHierarchy(
                        targetReference,
                        driver.UserReference,
                        servicePassengerRepository.ListByService(context.PrimaryEntityId),
                        accessHelper,
                        tracing);
                    continue;
                }

                accessHelper.EnsureAccess(targetReference, driver.UserReference, definition.AccessRights);
            }

            foreach (var driver in FindRemovedDrivers(previousDrivers, currentDrivers))
            {
                if (definition.IncludeServiceHierarchy)
                {
                    RevokeServiceHierarchy(
                        targetReference,
                        driver,
                        servicePassengerRepository.ListByService(context.PrimaryEntityId),
                        accessHelper,
                        servicePassengerRepository,
                        tracing);
                    continue;
                }

                accessHelper.RevokeAccess(targetReference, driver.UserReference);
            }

            tracing.Trace(
                "HandleDirectEntity done entity={0} id={1} currentDrivers={2} previousDrivers={3}",
                definition.EntityName,
                context.PrimaryEntityId,
                currentDrivers.Count,
                previousDrivers.Count);
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
            if (context.MessageName == PluginConfig.UpdateMessage)
            {
                EnsurePreImage(
                    context,
                    preImage,
                    PluginConfig.ServicePassengerServiceLookup,
                    PluginConfig.ServicePassengerPassengerLookup);

                if (!ContainsAnyAttribute(
                    target,
                    PluginConfig.ServicePassengerServiceLookup,
                    PluginConfig.ServicePassengerPassengerLookup))
                {
                    tracing.Trace("HandleServicePassenger skip because service/passenger link did not change.");
                    return;
                }
            }

            var currentLink = servicePassengerRepository.Load(context.PrimaryEntityId);
            var previousLink = context.MessageName == PluginConfig.UpdateMessage
                ? BuildPreImageLink(preImage, context.PrimaryEntityId)
                : null;

            var currentDrivers = ResolveDriversForService(
                service,
                currentLink?.ServiceReference,
                resolver,
                DriverResolutionMode.StrictForGrant);
            var previousDrivers = previousLink?.ServiceReference != null
                ? ResolveDriversForService(
                    service,
                    previousLink.ServiceReference,
                    resolver,
                    DriverResolutionMode.BestEffortForRevoke)
                : new Dictionary<Guid, ResolvedDriver>();

            foreach (var driver in currentDrivers.Values)
            {
                accessHelper.EnsureAccess(
                    currentLink.ServicePassengerReference,
                    driver.UserReference,
                    PluginConfig.ServicePassengerAccessRights);

                if (currentLink.PassengerReference != null)
                {
                    accessHelper.EnsureAccess(
                        currentLink.PassengerReference,
                        driver.UserReference,
                        PluginConfig.PassengerAccessRights);
                }
            }

            foreach (var driver in FindRemovedDrivers(previousDrivers, currentDrivers))
            {
                accessHelper.RevokeAccess(
                    currentLink.ServicePassengerReference,
                    driver.UserReference);
            }

            if (previousLink?.PassengerReference != null)
            {
                foreach (var driver in previousDrivers.Values)
                {
                    var stillNeedsPreviousPassenger =
                        currentLink?.PassengerReference != null &&
                        currentLink.PassengerReference.Id == previousLink.PassengerReference.Id &&
                        currentDrivers.ContainsKey(driver.UserReference.Id);

                    if (stillNeedsPreviousPassenger)
                    {
                        continue;
                    }

                    if (servicePassengerRepository.HasOtherPassengerLinkForEmployee(
                        driver.EmployeeReference.Id,
                        previousLink.PassengerReference.Id,
                        context.PrimaryEntityId))
                    {
                        continue;
                    }

                    accessHelper.RevokeAccess(
                        previousLink.PassengerReference,
                        driver.UserReference);
                }
            }

            tracing.Trace(
                "HandleServicePassenger done id={0} currentDrivers={1} previousDrivers={2}",
                context.PrimaryEntityId,
                currentDrivers.Count,
                previousDrivers.Count);
        }

        private static ServicePassengerLink BuildPreImageLink(Entity preImage, Guid servicePassengerId)
        {
            return new ServicePassengerLink(
                new EntityReference(PluginConfig.ServicePassengerTable, servicePassengerId),
                preImage.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerServiceLookup),
                preImage.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup));
        }

        private static Dictionary<Guid, ResolvedDriver> ResolveDriversForService(
            IOrganizationService service,
            EntityReference serviceReference,
            DriverResolver resolver,
            DriverResolutionMode mode)
        {
            if (serviceReference == null)
            {
                return new Dictionary<Guid, ResolvedDriver>();
            }

            var entity = service.Retrieve(
                PluginConfig.ServiceTable,
                serviceReference.Id,
                new ColumnSet(PluginConfig.ServiceDriverLookup));

            return ResolveDriverSet(
                LoadLookupReferences(entity, PluginConfig.ServiceDriverLookup),
                resolver,
                mode);
        }

        private static Dictionary<Guid, ResolvedDriver> ResolveDriverSet(
            IReadOnlyList<EntityReference> employeeReferences,
            DriverResolver resolver,
            DriverResolutionMode mode)
        {
            var results = new Dictionary<Guid, ResolvedDriver>();

            foreach (var employeeReference in employeeReferences)
            {
                var resolved = resolver.Resolve(employeeReference, mode);
                if (resolved == null)
                {
                    continue;
                }

                results[resolved.UserReference.Id] = resolved;
            }

            return results;
        }

        private static IReadOnlyList<ResolvedDriver> FindRemovedDrivers(
            IReadOnlyDictionary<Guid, ResolvedDriver> previousDrivers,
            IReadOnlyDictionary<Guid, ResolvedDriver> currentDrivers)
        {
            var removed = new List<ResolvedDriver>();

            foreach (var pair in previousDrivers)
            {
                if (!currentDrivers.ContainsKey(pair.Key))
                {
                    removed.Add(pair.Value);
                }
            }

            return removed;
        }

        private static IReadOnlyList<EntityReference> LoadLookupReferences(Entity entity, params string[] attributeNames)
        {
            var results = new List<EntityReference>();
            var seen = new HashSet<Guid>();

            if (entity == null || attributeNames == null)
            {
                return results;
            }

            foreach (var attributeName in attributeNames)
            {
                var reference = entity.GetAttributeValue<EntityReference>(attributeName);
                if (reference == null || !seen.Add(reference.Id))
                {
                    continue;
                }

                results.Add(reference);
            }

            return results;
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

        private static void RevokeServiceHierarchy(
            EntityReference serviceReference,
            ResolvedDriver driver,
            IReadOnlyList<ServicePassengerLink> servicePassengerLinks,
            DataverseAccessHelper accessHelper,
            ServicePassengerRepository servicePassengerRepository,
            ITracingService tracing)
        {
            accessHelper.RevokeAccess(serviceReference, driver.UserReference);

            var revokedPassengers = new HashSet<Guid>();
            foreach (var item in servicePassengerLinks)
            {
                accessHelper.RevokeAccess(
                    item.ServicePassengerReference,
                    driver.UserReference);

                if (item.PassengerReference == null || !revokedPassengers.Add(item.PassengerReference.Id))
                {
                    continue;
                }

                if (servicePassengerRepository.HasOtherPassengerServiceForEmployee(
                    driver.EmployeeReference.Id,
                    item.PassengerReference.Id,
                    serviceReference.Id))
                {
                    tracing.Trace(
                        "RevokeServiceHierarchy keep passenger target={0}:{1} for employeeId={2} because another service still uses it.",
                        item.PassengerReference.LogicalName,
                        item.PassengerReference.Id,
                        driver.EmployeeReference.Id);
                    continue;
                }

                accessHelper.RevokeAccess(item.PassengerReference, driver.UserReference);
            }
        }

        private static void EnsurePreImage(
            IPluginExecutionContext context,
            Entity preImage,
            params string[] requiredAttributes)
        {
            if (context.MessageName != PluginConfig.UpdateMessage)
            {
                return;
            }

            if (preImage == null)
            {
                throw new InvalidPluginExecutionException(
                    $"O step Update de '{context.PrimaryEntityName}' precisa de Pre Image com alias '{PluginConfig.PreImageAlias}' para remover acesso do motorista antigo.");
            }

            foreach (var attributeName in requiredAttributes)
            {
                if (!preImage.Attributes.Contains(attributeName))
                {
                    throw new InvalidPluginExecutionException(
                        $"A Pre Image '{PluginConfig.PreImageAlias}' do step Update de '{context.PrimaryEntityName}' precisa incluir o atributo '{attributeName}'.");
                }
            }
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

            if (!context.InputParameters.Contains(PluginConfig.TargetParameterName) ||
                !(context.InputParameters[PluginConfig.TargetParameterName] is Entity))
            {
                return false;
            }

            if (context.MessageName != PluginConfig.CreateMessage &&
                context.MessageName != PluginConfig.UpdateMessage)
            {
                return false;
            }

            if (context.PrimaryEntityName == PluginConfig.ServicePassengerTable)
            {
                return true;
            }

            return GetDirectEntityDefinition(context.PrimaryEntityName) != null;
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
        public EntityShareDefinition(
            string entityName,
            bool includeServiceHierarchy,
            AccessRights accessRights,
            params string[] driverLookupAttributes)
        {
            EntityName = entityName;
            IncludeServiceHierarchy = includeServiceHierarchy;
            AccessRights = accessRights;
            DriverLookupAttributes = driverLookupAttributes ?? Array.Empty<string>();
        }

        public string EntityName { get; }

        public bool IncludeServiceHierarchy { get; }

        public AccessRights AccessRights { get; }

        public string[] DriverLookupAttributes { get; }
    }
}
