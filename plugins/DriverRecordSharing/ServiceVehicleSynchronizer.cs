using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ServiceVehicleSynchronizer
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public ServiceVehicleSynchronizer(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public void SyncService(Guid serviceId)
        {
            if (serviceId == Guid.Empty)
            {
                return;
            }

            var serviceEntity = _service.Retrieve(
                PluginConfig.ServiceTable,
                serviceId,
                BuildServiceColumnSet());
            SyncService(serviceEntity);
        }

        public void SyncServicesForPossessionChange(Guid possessionId, Entity preImage)
        {
            if (possessionId == Guid.Empty)
            {
                return;
            }

            var current = _service.Retrieve(
                PluginConfig.VehiclePossessionTable,
                possessionId,
                BuildPossessionColumnSet());
            var drivers = new Dictionary<Guid, bool>();
            AddDriver(drivers, current.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionDriverLookup));
            AddDriver(drivers, preImage?.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionDriverLookup));
            SyncServicesForDrivers(drivers.Keys);
        }

        public void SyncServicesForExchangeChange(Guid exchangeId, Entity preImage)
        {
            if (exchangeId == Guid.Empty)
            {
                return;
            }

            var current = _service.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeId,
                BuildExchangeColumnSet());
            var drivers = new Dictionary<Guid, bool>();
            AddDriver(drivers, current.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup));
            AddDriver(drivers, current.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup));
            AddDriver(drivers, preImage?.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup));
            AddDriver(drivers, preImage?.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup));
            SyncServicesForDrivers(drivers.Keys);
        }

        private void SyncServicesForDrivers(IEnumerable<Guid> driverIds)
        {
            foreach (var driverId in driverIds)
            {
                foreach (var serviceEntity in ListFutureServices(driverId))
                {
                    SyncService(serviceEntity);
                }
            }
        }

        private void SyncService(Entity serviceEntity)
        {
            if (serviceEntity == null)
            {
                return;
            }

            var origin = serviceEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ServiceVehicleOrigin)?.Value;
            if (origin == PluginConfig.ServiceVehicleOriginManual)
            {
                _tracing.Trace(
                    "ServiceVehicleSynchronizer skip manual serviceId={0}.",
                    serviceEntity.Id);
                return;
            }

            var driver = serviceEntity.GetAttributeValue<EntityReference>(PluginConfig.ServiceDriverLookup);
            var serviceDate = serviceEntity.GetAttributeValue<DateTime?>(PluginConfig.ServiceStartDate);
            if (driver == null || !serviceDate.HasValue)
            {
                return;
            }

            var vehicle = ResolveVehicleForDriverAt(driver.Id, serviceDate.Value);
            if (vehicle == null)
            {
                _tracing.Trace(
                    "ServiceVehicleSynchronizer no vehicle serviceId={0} driverId={1} serviceDate={2:o}.",
                    serviceEntity.Id,
                    driver.Id,
                    serviceDate.Value);
                return;
            }

            var currentVehicle = serviceEntity.GetAttributeValue<EntityReference>(PluginConfig.ServiceVehicleLookup);
            if (currentVehicle != null && currentVehicle.Id == vehicle.Id && origin == PluginConfig.ServiceVehicleOriginAutomatic)
            {
                return;
            }

            var patch = new Entity(PluginConfig.ServiceTable, serviceEntity.Id);
            patch[PluginConfig.ServiceVehicleLookup] = vehicle;
            patch[PluginConfig.ServiceVehicleOrigin] = new OptionSetValue(PluginConfig.ServiceVehicleOriginAutomatic);
            _service.Update(patch);
            _tracing.Trace(
                "ServiceVehicleSynchronizer updated serviceId={0} driverId={1} vehicleId={2}.",
                serviceEntity.Id,
                driver.Id,
                vehicle.Id);
        }

        private EntityReference ResolveVehicleForDriverAt(Guid driverId, DateTime serviceDate)
        {
            var currentVehicle = FindPossessionVehicleAt(driverId, serviceDate);
            foreach (var exchange in ListPlannedExchanges(driverId, serviceDate))
            {
                currentVehicle = ApplyExchange(driverId, exchange, currentVehicle);
            }

            return currentVehicle;
        }

        private EntityReference FindPossessionVehicleAt(Guid driverId, DateTime serviceDate)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.VehiclePossessionPrimaryId,
                    PluginConfig.VehiclePossessionVehicleLookup,
                    PluginConfig.VehiclePossessionStartDate,
                    PluginConfig.VehiclePossessionEndDate),
                NoLock = true,
                TopCount = 2
            };
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionDriverLookup, ConditionOperator.Equal, driverId);
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionStartDate, ConditionOperator.OnOrBefore, serviceDate);

            var endFilter = new FilterExpression(LogicalOperator.Or);
            endFilter.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.Null);
            endFilter.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.GreaterThan, serviceDate);
            query.Criteria.AddFilter(endFilter);
            query.Orders.Add(new OrderExpression(PluginConfig.VehiclePossessionStartDate, OrderType.Descending));

            var results = _service.RetrieveMultiple(query);
            if (results.Entities.Count > 1)
            {
                _tracing.Trace(
                    "ServiceVehicleSynchronizer ambiguous possession driverId={0} serviceDate={1:o} count={2}.",
                    driverId,
                    serviceDate,
                    results.Entities.Count);
            }

            return results.Entities.Count == 0
                ? null
                : results.Entities[0].GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionVehicleLookup);
        }

        private IReadOnlyList<Entity> ListPlannedExchanges(Guid driverId, DateTime serviceDate)
        {
            var query = new QueryExpression(PluginConfig.ExchangeTable)
            {
                ColumnSet = BuildExchangeColumnSet(),
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ExchangeStartDate, ConditionOperator.OnOrBefore, serviceDate);
            query.Criteria.AddCondition(
                PluginConfig.ExchangeStatus,
                ConditionOperator.In,
                PluginConfig.ExchangeStatusProgrammed,
                PluginConfig.ExchangeStatusConfirmed);

            var driverFilter = new FilterExpression(LogicalOperator.Or);
            driverFilter.AddCondition(PluginConfig.ExchangeDriver1Lookup, ConditionOperator.Equal, driverId);
            driverFilter.AddCondition(PluginConfig.ExchangeDriver2Lookup, ConditionOperator.Equal, driverId);
            query.Criteria.AddFilter(driverFilter);
            query.Orders.Add(new OrderExpression(PluginConfig.ExchangeStartDate, OrderType.Ascending));

            return _service.RetrieveMultiple(query).Entities;
        }

        private static EntityReference ApplyExchange(Guid driverId, Entity exchange, EntityReference currentVehicle)
        {
            var driver1 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver1Lookup);
            var driver2 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeDriver2Lookup);
            var vehicle1 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle1Lookup);
            var vehicle2 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle2Lookup);
            var exchangeType = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value;

            if (exchangeType == PluginConfig.ExchangeTypeTakeFromBase)
            {
                return driver1 != null && driver1.Id == driverId ? vehicle2 ?? currentVehicle : currentVehicle;
            }

            if (exchangeType == PluginConfig.ExchangeTypeReturnToBase)
            {
                return driver1 != null && driver1.Id == driverId ? null : currentVehicle;
            }

            if (driver1 != null && driver1.Id == driverId)
            {
                return vehicle2 ?? currentVehicle;
            }

            if (driver2 != null && driver2.Id == driverId)
            {
                return vehicle1 ?? currentVehicle;
            }

            return currentVehicle;
        }

        private IReadOnlyList<Entity> ListFutureServices(Guid driverId)
        {
            var start = DateTime.UtcNow.Date.AddDays(-PluginConfig.ServiceVehicleSyncDaysBack);
            var end = DateTime.UtcNow.Date.AddDays(PluginConfig.ServiceVehicleSyncDaysAhead);
            var query = new QueryExpression(PluginConfig.ServiceTable)
            {
                ColumnSet = BuildServiceColumnSet(),
                NoLock = true,
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1
                }
            };
            query.Criteria.AddCondition(PluginConfig.ServiceDriverLookup, ConditionOperator.Equal, driverId);
            query.Criteria.AddCondition(PluginConfig.ServiceStartDate, ConditionOperator.OnOrAfter, start);
            query.Criteria.AddCondition(PluginConfig.ServiceStartDate, ConditionOperator.OnOrBefore, end);
            query.Criteria.AddCondition(PluginConfig.ServiceProgrammedFlag, ConditionOperator.Equal, true);
            query.Criteria.AddCondition(PluginConfig.ServiceExchangeLookup, ConditionOperator.Null);
            query.Criteria.AddCondition(PluginConfig.ServiceCategory, ConditionOperator.Equal, PluginConfig.ServiceBackfillCategories[0]);

            var originFilter = new FilterExpression(LogicalOperator.Or);
            originFilter.AddCondition(PluginConfig.ServiceVehicleOrigin, ConditionOperator.Null);
            originFilter.AddCondition(PluginConfig.ServiceVehicleOrigin, ConditionOperator.NotEqual, PluginConfig.ServiceVehicleOriginManual);
            query.Criteria.AddFilter(originFilter);
            query.Orders.Add(new OrderExpression(PluginConfig.ServiceStartDate, OrderType.Ascending));

            var results = new List<Entity>();
            while (true)
            {
                var page = _service.RetrieveMultiple(query);
                results.AddRange(page.Entities);
                if (!page.MoreRecords)
                {
                    break;
                }

                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }

            return results;
        }

        private static ColumnSet BuildServiceColumnSet()
        {
            return new ColumnSet(
                PluginConfig.ServicePrimaryId,
                PluginConfig.ServiceDriverLookup,
                PluginConfig.ServiceStartDate,
                PluginConfig.ServiceVehicleLookup,
                PluginConfig.ServiceVehicleOrigin,
                PluginConfig.ServiceProgrammedFlag,
                PluginConfig.ServiceExchangeLookup,
                PluginConfig.ServiceCategory);
        }

        private static ColumnSet BuildPossessionColumnSet()
        {
            return new ColumnSet(
                PluginConfig.VehiclePossessionPrimaryId,
                PluginConfig.VehiclePossessionDriverLookup,
                PluginConfig.VehiclePossessionVehicleLookup,
                PluginConfig.VehiclePossessionStartDate,
                PluginConfig.VehiclePossessionEndDate,
                PluginConfig.VehiclePossessionExchangeLookup);
        }

        private static ColumnSet BuildExchangeColumnSet()
        {
            return new ColumnSet(
                PluginConfig.ExchangePrimaryId,
                PluginConfig.ExchangeDriver1Lookup,
                PluginConfig.ExchangeDriver2Lookup,
                PluginConfig.ExchangeVehicle1Lookup,
                PluginConfig.ExchangeVehicle2Lookup,
                PluginConfig.ExchangeStartDate,
                PluginConfig.ExchangeEndDate,
                PluginConfig.ExchangeStatus,
                PluginConfig.ExchangeType);
        }

        private static void AddDriver(IDictionary<Guid, bool> drivers, EntityReference driver)
        {
            if (driver == null || driver.Id == Guid.Empty)
            {
                return;
            }

            drivers[driver.Id] = true;
        }
    }
}
