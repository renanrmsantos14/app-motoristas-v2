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
                    PluginConfig.VehiclePossessionEndDate));

            var vehicle = possession.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionVehicleLookup);
            if (vehicle == null || vehicle.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException(
                    "Posse de veículo inválida: informe o veículo. A gravação foi cancelada e nenhuma alteração foi salva.");
            }

            if (possession.Contains(PluginConfig.VehiclePossessionEndDate) &&
                possession[PluginConfig.VehiclePossessionEndDate] != null)
            {
                return;
            }

            var driver = possession.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionDriverLookup);
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
    }
}
