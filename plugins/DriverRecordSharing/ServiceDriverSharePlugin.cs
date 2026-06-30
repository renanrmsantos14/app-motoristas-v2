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
                var preImage = ResolvePreImage(context, tracing);
                var resolver = new DriverResolver(service, tracing);
                var accessHelper = new DataverseAccessHelper(service, tracing);
                var servicePassengerRepository = new ServicePassengerRepository(service, tracing);

                if (context.PrimaryEntityName == PluginConfig.EmployeeTable)
                {
                    HandleEmployeeEmailBackfill(
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
            catch (InvalidPluginExecutionException ex)
            {
                tracing.Trace("ServiceDriverSharePlugin business error: {0}", ex);
                new OperationalLogWriter(service, tracing).TryWriteError(context, ex);
                throw;
            }
            catch (Exception ex)
            {
                tracing.Trace("ServiceDriverSharePlugin error: {0}", ex);
                new OperationalLogWriter(service, tracing).TryWriteError(context, ex);
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
            var hasUsablePreImage = true;

            if (context.MessageName == PluginConfig.UpdateMessage)
            {
                hasUsablePreImage = EnsurePreImage(
                    context,
                    preImage,
                    tracing,
                    BuildDirectEntityTrackedAttributes(definition));

                if (!ContainsAnyAttribute(target, BuildDirectEntityTrackedAttributes(definition)))
                {
                    tracing.Trace("HandleDirectEntity skip because no tracked attribute changed.");
                    return;
                }
            }

            var currentEntity = service.Retrieve(
                definition.EntityName,
                context.PrimaryEntityId,
                BuildDirectEntityColumnSet(definition));
            var currentMaintenance = definition.IncludeServiceHierarchy
                ? LoadMaintenanceReference(currentEntity)
                : null;
            var currentRequester = definition.IncludeServiceHierarchy
                ? LoadRequesterReference(currentEntity)
                : null;

            var currentDrivers = ResolveDriverSet(
                LoadLookupReferences(currentEntity, definition.DriverLookupAttributes),
                resolver,
                DriverResolutionMode.StrictForGrant);
            var targetReference = new EntityReference(definition.EntityName, context.PrimaryEntityId);
            var previousRequester = context.MessageName == PluginConfig.UpdateMessage && hasUsablePreImage && definition.IncludeServiceHierarchy
                ? LoadRequesterReference(preImage)
                : null;
            var previousDrivers = context.MessageName == PluginConfig.UpdateMessage && hasUsablePreImage
                ? ResolveDriverSet(
                    LoadLookupReferences(preImage, definition.DriverLookupAttributes),
                    resolver,
                    DriverResolutionMode.BestEffortForRevoke)
                : ResolvePreviouslySharedDrivers(
                    targetReference,
                    currentDrivers,
                    accessHelper,
                    resolver,
                    tracing);

            foreach (var driver in currentDrivers.Values)
            {
                if (definition.IncludeServiceHierarchy)
                {
                    GrantServiceHierarchy(
                        targetReference,
                        currentMaintenance,
                        currentRequester,
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
                        currentMaintenance,
                        previousRequester,
                        driver,
                        servicePassengerRepository.ListByService(context.PrimaryEntityId),
                        accessHelper,
                        servicePassengerRepository,
                        tracing);
                    continue;
                }

                accessHelper.RevokeAccess(targetReference, driver.UserReference);
            }

            if (definition.IncludeServiceHierarchy)
            {
                RevokePreviousRequesterFromRetainedDrivers(
                    context.PrimaryEntityId,
                    previousRequester,
                    currentRequester,
                    previousDrivers,
                    currentDrivers,
                    accessHelper,
                    servicePassengerRepository,
                    tracing);
            }

            if (definition.EntityName == PluginConfig.ExchangeTable)
            {
                SyncExchangeEmployeeContactAccess(
                    context,
                    service,
                    currentEntity,
                    context.MessageName == PluginConfig.UpdateMessage && hasUsablePreImage ? preImage : null,
                    resolver,
                    accessHelper,
                    tracing);
            }

            tracing.Trace(
                "HandleDirectEntity done entity={0} id={1} currentDrivers={2} previousDrivers={3}",
                definition.EntityName,
                context.PrimaryEntityId,
                currentDrivers.Count,
                previousDrivers.Count);
        }

        private static void HandleEmployeeEmailBackfill(
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
                EnsurePreImage(context, preImage, tracing, PluginConfig.EmployeeMicrosoftEmail);

                if (!target.Contains(PluginConfig.EmployeeMicrosoftEmail))
                {
                    tracing.Trace("HandleEmployeeEmailBackfill skip because email did not change.");
                    return;
                }

                var previousEmail = preImage?.GetAttributeValue<string>(PluginConfig.EmployeeMicrosoftEmail) ?? string.Empty;
                var nextEmail = target.GetAttributeValue<string>(PluginConfig.EmployeeMicrosoftEmail) ?? string.Empty;
                if (string.Equals(previousEmail.Trim(), nextEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    tracing.Trace("HandleEmployeeEmailBackfill skip because email value is unchanged.");
                    return;
                }
            }

            var employeeReference = new EntityReference(PluginConfig.EmployeeTable, context.PrimaryEntityId);
            var driver = resolver.Resolve(employeeReference, DriverResolutionMode.StrictForGrant);
            if (driver == null)
            {
                tracing.Trace("HandleEmployeeEmailBackfill skip because employee could not be resolved.");
                return;
            }

            var services = ListServicesForEmployeeBackfill(service, context.PrimaryEntityId, tracing);
            tracing.Trace(
                "HandleEmployeeEmailBackfill employeeId={0} userId={1} services={2}",
                context.PrimaryEntityId,
                driver.UserReference.Id,
                services.Count);

            foreach (var serviceEntity in services)
            {
                var serviceReference = new EntityReference(PluginConfig.ServiceTable, serviceEntity.Id);
                GrantServiceHierarchy(
                    serviceReference,
                    LoadMaintenanceReference(serviceEntity),
                    LoadRequesterReference(serviceEntity),
                    driver.UserReference,
                    servicePassengerRepository.ListByService(serviceEntity.Id),
                    accessHelper,
                    tracing);
            }

            tracing.Trace(
                "HandleEmployeeEmailBackfill done employeeId={0} userId={1} services={2}",
                context.PrimaryEntityId,
                driver.UserReference.Id,
                services.Count);
        }

        private static IReadOnlyList<Entity> ListServicesForEmployeeBackfill(
            IOrganizationService service,
            Guid employeeId,
            ITracingService tracing)
        {
            var start = DateTime.UtcNow.Date.AddDays(-PluginConfig.EmployeeBackfillDaysBack);
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.ServicePrimaryId,
                    PluginConfig.ServiceDriverLookup,
                    PluginConfig.ServiceMaintenanceLookup,
                    PluginConfig.ServiceRequesterLookup,
                    PluginConfig.ServiceStartDate),
                NoLock = true,
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1
                }
            };

            query.Criteria.AddCondition(PluginConfig.ServiceDriverLookup, ConditionOperator.Equal, employeeId);
            query.Criteria.AddCondition(PluginConfig.ServiceStartDate, ConditionOperator.OnOrAfter, start);
            query.Criteria.AddCondition(PluginConfig.ServiceProgrammedFlag, ConditionOperator.Equal, true);
            query.Criteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Null);
            query.Criteria.AddCondition(
                PluginConfig.ServiceCategory,
                ConditionOperator.In,
                Array.ConvertAll(PluginConfig.ServiceBackfillCategories, value => (object)value));
            query.Orders.Add(new OrderExpression(PluginConfig.ServiceStartDate, OrderType.Ascending));

            var results = new List<Entity>();
            while (true)
            {
                var page = service.RetrieveMultiple(query);
                results.AddRange(page.Entities);

                if (!page.MoreRecords)
                {
                    break;
                }

                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }

            tracing.Trace(
                "ListServicesForEmployeeBackfill employeeId={0} start={1:o} count={2}",
                employeeId,
                start,
                results.Count);
            return results;
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
            var hasUsablePreImage = true;

            if (context.MessageName == PluginConfig.UpdateMessage)
            {
                hasUsablePreImage = EnsurePreImage(
                    context,
                    preImage,
                    tracing,
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
            var previousLink = context.MessageName == PluginConfig.UpdateMessage && hasUsablePreImage
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
                : ResolvePreviouslySharedDrivers(
                    currentLink.ServicePassengerReference,
                    currentDrivers,
                    accessHelper,
                    resolver,
                    tracing);

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

                    if (driver.EmployeeReference == null)
                    {
                        tracing.Trace(
                            "HandleServicePassenger skip passenger revoke target={0}:{1} user={2}:{3} because employee reference could not be resolved.",
                            previousLink.PassengerReference.LogicalName,
                            previousLink.PassengerReference.Id,
                            driver.UserReference.LogicalName,
                            driver.UserReference.Id);
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

        private static void SyncExchangeEmployeeContactAccess(
            IPluginExecutionContext context,
            IOrganizationService service,
            Entity currentExchange,
            Entity previousExchange,
            DriverResolver resolver,
            DataverseAccessHelper accessHelper,
            ITracingService tracing)
        {
            var currentGrants = BuildExchangeEmployeeContactGrants(
                currentExchange,
                resolver,
                DriverResolutionMode.StrictForGrant);
            var previousGrants = previousExchange != null
                ? BuildExchangeEmployeeContactGrants(
                    previousExchange,
                    resolver,
                    DriverResolutionMode.BestEffortForRevoke)
                : new List<EmployeeContactGrant>();

            foreach (var grant in currentGrants)
            {
                tracing.Trace(
                    "SyncExchangeEmployeeContactAccess grant employee={0} user={1}",
                    grant.EmployeeReference.Id,
                    grant.Driver.UserReference.Id);
                accessHelper.EnsureAccess(
                    grant.EmployeeReference,
                    grant.Driver.UserReference,
                    PluginConfig.EmployeeContactAccessRights);
            }

            foreach (var grant in previousGrants)
            {
                if (ContainsEmployeeContactGrant(currentGrants, grant))
                {
                    continue;
                }

                if (HasOtherProgrammedExchangeForEmployeeContact(
                    service,
                    context.PrimaryEntityId,
                    grant.EmployeeReference.Id,
                    grant.Driver.EmployeeReference?.Id ?? Guid.Empty))
                {
                    tracing.Trace(
                        "SyncExchangeEmployeeContactAccess keep employee={0} user={1} because another programmed exchange still needs it.",
                        grant.EmployeeReference.Id,
                        grant.Driver.UserReference.Id);
                    continue;
                }

                tracing.Trace(
                    "SyncExchangeEmployeeContactAccess revoke employee={0} user={1}",
                    grant.EmployeeReference.Id,
                    grant.Driver.UserReference.Id);
                accessHelper.RevokeAccess(grant.EmployeeReference, grant.Driver.UserReference);
            }
        }

        private static List<EmployeeContactGrant> BuildExchangeEmployeeContactGrants(
            Entity exchange,
            DriverResolver resolver,
            DriverResolutionMode mode)
        {
            var grants = new List<EmployeeContactGrant>();
            if (!IsProgrammedExchange(exchange))
            {
                return grants;
            }

            var driver1Reference = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup);
            var driver2Reference = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup);
            if (driver1Reference == null || driver2Reference == null)
            {
                return grants;
            }

            var driver1 = resolver.Resolve(driver1Reference, mode);
            var driver2 = resolver.Resolve(driver2Reference, mode);

            if (driver2 != null)
            {
                grants.Add(new EmployeeContactGrant(driver1Reference, driver2));
            }

            if (driver1 != null)
            {
                grants.Add(new EmployeeContactGrant(driver2Reference, driver1));
            }

            return grants;
        }

        private static bool IsProgrammedExchange(Entity exchange)
        {
            return exchange?.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeStatus)?.Value == PluginConfig.ExchangeStatusProgrammed;
        }

        private static bool ContainsEmployeeContactGrant(
            IReadOnlyList<EmployeeContactGrant> grants,
            EmployeeContactGrant candidate)
        {
            foreach (var grant in grants)
            {
                if (grant.EmployeeReference.Id == candidate.EmployeeReference.Id &&
                    grant.Driver.UserReference.Id == candidate.Driver.UserReference.Id)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool HasOtherProgrammedExchangeForEmployeeContact(
            IOrganizationService service,
            Guid currentExchangeId,
            Guid employeeId,
            Guid otherEmployeeId)
        {
            if (employeeId == Guid.Empty || otherEmployeeId == Guid.Empty)
            {
                return false;
            }

            var query = new QueryExpression(PluginConfig.ExchangeTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ExchangePrimaryId),
                TopCount = 1,
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ExchangePrimaryId, ConditionOperator.NotEqual, currentExchangeId);
            query.Criteria.AddCondition(PluginConfig.ExchangeStatus, ConditionOperator.Equal, PluginConfig.ExchangeStatusProgrammed);

            var pairFilter = new FilterExpression(LogicalOperator.Or);
            var driver1Target = new FilterExpression(LogicalOperator.And);
            driver1Target.AddCondition(PluginConfig.ExchangeDriver1Lookup, ConditionOperator.Equal, employeeId);
            driver1Target.AddCondition(PluginConfig.ExchangeDriver2Lookup, ConditionOperator.Equal, otherEmployeeId);
            var driver2Target = new FilterExpression(LogicalOperator.And);
            driver2Target.AddCondition(PluginConfig.ExchangeDriver2Lookup, ConditionOperator.Equal, employeeId);
            driver2Target.AddCondition(PluginConfig.ExchangeDriver1Lookup, ConditionOperator.Equal, otherEmployeeId);
            pairFilter.AddFilter(driver1Target);
            pairFilter.AddFilter(driver2Target);
            query.Criteria.AddFilter(pairFilter);

            return service.RetrieveMultiple(query).Entities.Count > 0;
        }

        private static ColumnSet BuildDirectEntityColumnSet(EntityShareDefinition definition)
        {
            var columns = new List<string>(definition.DriverLookupAttributes ?? Array.Empty<string>());

            if (definition?.EntityName == PluginConfig.ExchangeTable)
            {
                columns.Add(PluginConfig.ExchangeStatus);
            }

            if (definition?.IncludeServiceHierarchy == true)
            {
                columns.Add(PluginConfig.ServiceMaintenanceLookup);
                columns.Add(PluginConfig.ServiceRequesterLookup);
            }

            return new ColumnSet(columns.ToArray());
        }

        private static string[] BuildDirectEntityTrackedAttributes(EntityShareDefinition definition)
        {
            var attributes = new List<string>(definition?.DriverLookupAttributes ?? Array.Empty<string>());

            if (definition?.EntityName == PluginConfig.ExchangeTable)
            {
                attributes.Add(PluginConfig.ExchangeStatus);
            }

            if (definition?.IncludeServiceHierarchy == true)
            {
                attributes.Add(PluginConfig.ServiceRequesterLookup);
            }

            return attributes.ToArray();
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

        private static Dictionary<Guid, ResolvedDriver> ResolvePreviouslySharedDrivers(
            EntityReference targetReference,
            IReadOnlyDictionary<Guid, ResolvedDriver> currentDrivers,
            DataverseAccessHelper accessHelper,
            DriverResolver resolver,
            ITracingService tracing)
        {
            var previousDrivers = new Dictionary<Guid, ResolvedDriver>();
            var sharedUsers = accessHelper.ListSharedUsers(targetReference);

            foreach (var sharedUser in sharedUsers)
            {
                if (currentDrivers.ContainsKey(sharedUser.Id))
                {
                    continue;
                }

                var resolved = resolver.ResolveFromUser(sharedUser);
                if (resolved == null)
                {
                    tracing.Trace(
                        "ResolvePreviouslySharedDrivers skip unresolved shared userId={0}",
                        sharedUser.Id);
                    continue;
                }

                previousDrivers[resolved.UserReference.Id] = resolved;
            }

            tracing.Trace(
                "ResolvePreviouslySharedDrivers target={0}:{1} previousDrivers={2}",
                targetReference.LogicalName,
                targetReference.Id,
                previousDrivers.Count);
            return previousDrivers;
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
            EntityReference maintenanceReference,
            EntityReference requesterReference,
            EntityReference userReference,
            IReadOnlyList<ServicePassengerLink> servicePassengerLinks,
            DataverseAccessHelper accessHelper,
            ITracingService tracing)
        {
            accessHelper.EnsureAccess(serviceReference, userReference, PluginConfig.ServiceAccessRights);

            if (maintenanceReference != null)
            {
                tracing.Trace(
                    "GrantServiceHierarchy maintenance target={0}:{1} user={2}:{3}",
                    maintenanceReference.LogicalName,
                    maintenanceReference.Id,
                    userReference.LogicalName,
                    userReference.Id);

                accessHelper.EnsureAccess(
                    maintenanceReference,
                    userReference,
                    PluginConfig.MaintenanceAccessRights);
            }

            if (requesterReference != null)
            {
                tracing.Trace(
                    "GrantServiceHierarchy requester target={0}:{1} user={2}:{3}",
                    requesterReference.LogicalName,
                    requesterReference.Id,
                    userReference.LogicalName,
                    userReference.Id);

                accessHelper.EnsureAccess(
                    requesterReference,
                    userReference,
                    PluginConfig.PassengerAccessRights);
            }

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
            EntityReference maintenanceReference,
            EntityReference requesterReference,
            ResolvedDriver driver,
            IReadOnlyList<ServicePassengerLink> servicePassengerLinks,
            DataverseAccessHelper accessHelper,
            ServicePassengerRepository servicePassengerRepository,
            ITracingService tracing)
        {
            accessHelper.RevokeAccess(serviceReference, driver.UserReference);

            if (maintenanceReference != null)
            {
                tracing.Trace(
                    "RevokeServiceHierarchy maintenance target={0}:{1} user={2}:{3}",
                    maintenanceReference.LogicalName,
                    maintenanceReference.Id,
                    driver.UserReference.LogicalName,
                    driver.UserReference.Id);

                accessHelper.RevokeAccess(maintenanceReference, driver.UserReference);
            }

            if (requesterReference != null)
            {
                if (driver.EmployeeReference == null)
                {
                    tracing.Trace(
                        "RevokeServiceHierarchy skip requester revoke target={0}:{1} user={2}:{3} because employee reference could not be resolved.",
                        requesterReference.LogicalName,
                        requesterReference.Id,
                        driver.UserReference.LogicalName,
                        driver.UserReference.Id);
                }
                else if (servicePassengerRepository.HasOtherRequesterServiceForEmployee(
                    driver.EmployeeReference.Id,
                    requesterReference.Id,
                    serviceReference.Id))
                {
                    tracing.Trace(
                        "RevokeServiceHierarchy keep requester target={0}:{1} for employeeId={2} because another service still uses it.",
                        requesterReference.LogicalName,
                        requesterReference.Id,
                        driver.EmployeeReference.Id);
                }
                else
                {
                    tracing.Trace(
                        "RevokeServiceHierarchy requester target={0}:{1} user={2}:{3}",
                        requesterReference.LogicalName,
                        requesterReference.Id,
                        driver.UserReference.LogicalName,
                        driver.UserReference.Id);

                    accessHelper.RevokeAccess(requesterReference, driver.UserReference);
                }
            }

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

                if (driver.EmployeeReference == null)
                {
                    tracing.Trace(
                        "RevokeServiceHierarchy skip passenger revoke target={0}:{1} user={2}:{3} because employee reference could not be resolved.",
                        item.PassengerReference.LogicalName,
                        item.PassengerReference.Id,
                        driver.UserReference.LogicalName,
                        driver.UserReference.Id);
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

        private static EntityReference LoadMaintenanceReference(Entity entity)
        {
            if (entity == null)
            {
                return null;
            }

            return entity.GetAttributeValue<EntityReference>(PluginConfig.ServiceMaintenanceLookup);
        }

        private static EntityReference LoadRequesterReference(Entity entity)
        {
            if (entity == null)
            {
                return null;
            }

            return entity.GetAttributeValue<EntityReference>(PluginConfig.ServiceRequesterLookup);
        }

        private static void RevokePreviousRequesterFromRetainedDrivers(
            Guid serviceId,
            EntityReference previousRequester,
            EntityReference currentRequester,
            IReadOnlyDictionary<Guid, ResolvedDriver> previousDrivers,
            IReadOnlyDictionary<Guid, ResolvedDriver> currentDrivers,
            DataverseAccessHelper accessHelper,
            ServicePassengerRepository servicePassengerRepository,
            ITracingService tracing)
        {
            if (previousRequester == null)
            {
                return;
            }

            if (currentRequester != null && currentRequester.Id == previousRequester.Id)
            {
                return;
            }

            foreach (var pair in currentDrivers)
            {
                if (!previousDrivers.ContainsKey(pair.Key))
                {
                    continue;
                }

                var driver = pair.Value;
                if (driver.EmployeeReference == null)
                {
                    tracing.Trace(
                        "RevokePreviousRequesterFromRetainedDrivers skip requester revoke target={0}:{1} user={2}:{3} because employee reference could not be resolved.",
                        previousRequester.LogicalName,
                        previousRequester.Id,
                        driver.UserReference.LogicalName,
                        driver.UserReference.Id);
                    continue;
                }

                if (servicePassengerRepository.HasOtherRequesterServiceForEmployee(
                    driver.EmployeeReference.Id,
                    previousRequester.Id,
                    serviceId))
                {
                    tracing.Trace(
                        "RevokePreviousRequesterFromRetainedDrivers keep requester target={0}:{1} for employeeId={2} because another service still uses it.",
                        previousRequester.LogicalName,
                        previousRequester.Id,
                        driver.EmployeeReference.Id);
                    continue;
                }

                tracing.Trace(
                    "RevokePreviousRequesterFromRetainedDrivers revoke requester target={0}:{1} user={2}:{3}",
                    previousRequester.LogicalName,
                    previousRequester.Id,
                    driver.UserReference.LogicalName,
                    driver.UserReference.Id);

                accessHelper.RevokeAccess(previousRequester, driver.UserReference);
            }
        }

        private static bool EnsurePreImage(
            IPluginExecutionContext context,
            Entity preImage,
            ITracingService tracing,
            params string[] requiredAttributes)
        {
            if (context.MessageName != PluginConfig.UpdateMessage)
            {
                return false;
            }

            if (preImage == null)
            {
                tracing.Trace(
                    "EnsurePreImage warning entity={0} alias={1} preImage=<null>. Plugin will grant current access but skip revoke because previous values are unavailable.",
                    context.PrimaryEntityName,
                    PluginConfig.PreImageAlias);
                return false;
            }

            foreach (var attributeName in requiredAttributes)
            {
                if (!preImage.Attributes.Contains(attributeName))
                {
                    tracing.Trace(
                        "EnsurePreImage warning entity={0} alias={1} missingAttribute={2}. Plugin will grant current access but skip revoke because previous values are incomplete.",
                        context.PrimaryEntityName,
                        PluginConfig.PreImageAlias,
                        attributeName);
                    return false;
                }
            }

            return true;
        }

        private static Entity ResolvePreImage(
            IPluginExecutionContext context,
            ITracingService tracing)
        {
            if (context == null || context.MessageName != PluginConfig.UpdateMessage)
            {
                return null;
            }

            if (context.PreEntityImages == null || context.PreEntityImages.Count == 0)
            {
                tracing.Trace("ResolvePreImage no pre-images available.");
                return null;
            }

            foreach (var key in context.PreEntityImages.Keys)
            {
                if (!string.Equals(key, PluginConfig.PreImageAlias, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                tracing.Trace("ResolvePreImage matched alias={0}", key);
                return context.PreEntityImages[key];
            }

            if (context.PreEntityImages.Count == 1)
            {
                foreach (var key in context.PreEntityImages.Keys)
                {
                    tracing.Trace(
                        "ResolvePreImage fallback using only available alias={0}",
                        key);
                    return context.PreEntityImages[key];
                }
            }

            tracing.Trace(
                "ResolvePreImage could not match alias={0}. Available aliases={1}",
                PluginConfig.PreImageAlias,
                string.Join(",", context.PreEntityImages.Keys));
            return null;
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

            if (context.PrimaryEntityName == PluginConfig.EmployeeTable)
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

    internal sealed class EmployeeContactGrant
    {
        public EmployeeContactGrant(EntityReference employeeReference, ResolvedDriver driver)
        {
            EmployeeReference = employeeReference;
            Driver = driver;
        }

        public EntityReference EmployeeReference { get; }

        public ResolvedDriver Driver { get; }
    }
}
