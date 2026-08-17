using System;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal static class VehiclePossessionOpenKeyProjector
    {
        public static void Apply(Entity target, Entity preImage)
        {
            if (target == null)
            {
                throw new InvalidPluginExecutionException("Posse inválida: registro não informado.");
            }

            var vehicle = ResolveReference(target, preImage, PluginConfig.VehiclePossessionVehicleLookup);
            if (vehicle == null || vehicle.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException("Posse inválida: informe o veículo.");
            }

            var endedAt = ResolveValue(target, preImage, PluginConfig.VehiclePossessionEndDate);
            var startedAt = ResolveValue(target, preImage, PluginConfig.VehiclePossessionStartDate);
            if (startedAt is DateTime start && endedAt is DateTime end && end < start)
            {
                throw new InvalidPluginExecutionException("Posse inválida: o fim não pode ser anterior ao início.");
            }
            if (endedAt != null)
            {
                target[PluginConfig.VehiclePossessionOpenDriverKey] = null;
                target[PluginConfig.VehiclePossessionOpenVehicleKey] = null;
                return;
            }

            var driver = ResolveReference(target, preImage, PluginConfig.VehiclePossessionDriverLookup);
            target[PluginConfig.VehiclePossessionOpenDriverKey] = driver?.Id.ToString("D");
            target[PluginConfig.VehiclePossessionOpenVehicleKey] = vehicle.Id.ToString("D");
        }

        private static object ResolveValue(Entity target, Entity preImage, string attributeName)
        {
            if (target.Contains(attributeName))
            {
                return target[attributeName];
            }

            return preImage != null && preImage.Contains(attributeName)
                ? preImage[attributeName]
                : null;
        }

        private static EntityReference ResolveReference(Entity target, Entity preImage, string attributeName)
        {
            return ResolveValue(target, preImage, attributeName) as EntityReference;
        }
    }
}
