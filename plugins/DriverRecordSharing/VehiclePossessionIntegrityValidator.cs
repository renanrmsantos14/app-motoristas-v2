using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class VehiclePossessionIntegrityValidator
    {
        private readonly IOrganizationService _service;

        public VehiclePossessionIntegrityValidator(IOrganizationService service)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
        }

        public void Validate(Guid possessionId)
        {
            var possession = _service.Retrieve(
                PluginConfig.VehiclePossessionTable,
                possessionId,
                new ColumnSet(
                    PluginConfig.VehiclePossessionPrimaryId,
                    PluginConfig.VehiclePossessionDriverLookup,
                    PluginConfig.VehiclePossessionVehicleLookup,
                    PluginConfig.VehiclePossessionStartDate,
                    PluginConfig.VehiclePossessionEndDate));

            var vehicle = possession.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionVehicleLookup);
            if (vehicle == null || vehicle.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException(
                    "Posse de veículo inválida: informe o veículo. A gravação foi cancelada e nenhuma alteração foi salva.");
            }

            var start = possession.GetAttributeValue<DateTime?>(PluginConfig.VehiclePossessionStartDate);
            var end = possession.GetAttributeValue<DateTime?>(PluginConfig.VehiclePossessionEndDate);
            if (!start.HasValue)
            {
                throw new InvalidPluginExecutionException("[POSSESSION_INVALID_WINDOW] Posse de veículo inválida: informe o início.");
            }
            if (end.HasValue && end.Value < start.Value)
            {
                throw new InvalidPluginExecutionException("[POSSESSION_INVALID_WINDOW] O fim da posse não pode ser anterior ao início.");
            }

            var driver = possession.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionDriverLookup);
            if (!end.HasValue || end.Value > start.Value)
            {
                if (driver != null && HasOverlappingPossession(
                        PluginConfig.VehiclePossessionDriverLookup, driver.Id, possessionId, start.Value, end))
                    throw new InvalidPluginExecutionException("[POSSESSION_OVERLAP] Este motorista possui outra posse no mesmo período.");
                if (HasOverlappingPossession(
                        PluginConfig.VehiclePossessionVehicleLookup, vehicle.Id, possessionId, start.Value, end))
                    throw new InvalidPluginExecutionException("[POSSESSION_OVERLAP] Este veículo possui outra posse no mesmo período.");
            }

            if (end.HasValue) return;

            if (driver != null && HasAnotherOpenPossession(
                    PluginConfig.VehiclePossessionDriverLookup,
                    driver.Id,
                    possessionId))
            {
                throw new InvalidPluginExecutionException(
                    "Posse de veículo duplicada: este motorista já possui outra posse aberta. Feche a posse anterior antes de continuar.");
            }

            if (HasAnotherOpenPossession(
                    PluginConfig.VehiclePossessionVehicleLookup,
                    vehicle.Id,
                    possessionId))
            {
                throw new InvalidPluginExecutionException(
                    "Posse de veículo duplicada: este veículo já possui outra posse aberta. Feche a posse anterior antes de continuar.");
            }
        }

        private bool HasAnotherOpenPossession(string lookupAttribute, Guid lookupId, Guid currentPossessionId)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.VehiclePossessionPrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(lookupAttribute, ConditionOperator.Equal, lookupId);
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.Null);
            query.Criteria.AddCondition(
                PluginConfig.VehiclePossessionPrimaryId,
                ConditionOperator.NotEqual,
                currentPossessionId);
            return _service.RetrieveMultiple(query).Entities.Count > 0;
        }

        private bool HasOverlappingPossession(
            string lookupAttribute,
            Guid lookupId,
            Guid currentPossessionId,
            DateTime start,
            DateTime? end)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.VehiclePossessionPrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(lookupAttribute, ConditionOperator.Equal, lookupId);
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionPrimaryId, ConditionOperator.NotEqual, currentPossessionId);
            if (end.HasValue)
                query.Criteria.AddCondition(PluginConfig.VehiclePossessionStartDate, ConditionOperator.LessThan, end.Value);
            var extendsBeyondStart = new FilterExpression(LogicalOperator.Or);
            extendsBeyondStart.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.Null);
            extendsBeyondStart.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.GreaterThan, start);
            query.Criteria.AddFilter(extendsBeyondStart);
            return _service.RetrieveMultiple(query).Entities.Count > 0;
        }
    }
}
