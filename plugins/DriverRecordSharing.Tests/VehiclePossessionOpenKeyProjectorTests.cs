using System;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class VehiclePossessionOpenKeyProjectorTests
    {
        [Fact]
        public void OpenDriverPossessionSetsDriverAndVehicleKeys()
        {
            var driverId = Guid.NewGuid();
            var vehicleId = Guid.NewGuid();
            var target = Possession(driverId, vehicleId, null);

            Apply(target, null);

            Assert.Equal(driverId.ToString("D"), target["new_chavemotoristaposseaberta"]);
            Assert.Equal(vehicleId.ToString("D"), target["new_chaveveiculoposseaberta"]);
        }

        [Fact]
        public void OpenBasePossessionSetsOnlyVehicleKey()
        {
            var vehicleId = Guid.NewGuid();
            var target = Possession(null, vehicleId, null);

            Apply(target, null);

            Assert.Null(target["new_chavemotoristaposseaberta"]);
            Assert.Equal(vehicleId.ToString("D"), target["new_chaveveiculoposseaberta"]);
        }

        [Fact]
        public void ClosingPossessionClearsBothKeysUsingPreImage()
        {
            var driverId = Guid.NewGuid();
            var vehicleId = Guid.NewGuid();
            var preImage = Possession(driverId, vehicleId, null);
            var target = new Entity("new_possedeveiculo", Guid.NewGuid())
            {
                ["new_fimdaposse"] = DateTime.UtcNow
            };

            Apply(target, preImage);

            Assert.Null(target["new_chavemotoristaposseaberta"]);
            Assert.Null(target["new_chaveveiculoposseaberta"]);
        }

        [Fact]
        public void ReassigningOpenPossessionUsesNewReferences()
        {
            var old = Possession(Guid.NewGuid(), Guid.NewGuid(), null);
            var newDriverId = Guid.NewGuid();
            var newVehicleId = Guid.NewGuid();
            var target = new Entity("new_possedeveiculo", old.Id)
            {
                ["new_motorista"] = new EntityReference("cr40f_funcionarios", newDriverId),
                ["new_veiculo"] = new EntityReference("cr40f_veiculos", newVehicleId)
            };

            Apply(target, old);

            Assert.Equal(newDriverId.ToString("D"), target["new_chavemotoristaposseaberta"]);
            Assert.Equal(newVehicleId.ToString("D"), target["new_chaveveiculoposseaberta"]);
        }

        [Fact]
        public void RejectsEndBeforeStart()
        {
            var start = new DateTime(2026, 7, 5, 9, 30, 0, DateTimeKind.Utc);
            var target = Possession(Guid.NewGuid(), Guid.NewGuid(), start.AddHours(-1));
            target["new_iniciodaposse"] = start;

            var error = Assert.Throws<TargetInvocationException>(() => Apply(target, null));

            var pluginError = Assert.IsType<InvalidPluginExecutionException>(error.InnerException);
            Assert.Contains("fim", pluginError.Message);
            Assert.Contains("inÃ­cio", pluginError.Message);
        }

        private static Entity Possession(Guid? driverId, Guid vehicleId, DateTime? endedAt)
        {
            var entity = new Entity("new_possedeveiculo", Guid.NewGuid())
            {
                ["new_veiculo"] = new EntityReference("cr40f_veiculos", vehicleId),
                ["new_fimdaposse"] = endedAt
            };
            if (driverId.HasValue)
            {
                entity["new_motorista"] = new EntityReference("cr40f_funcionarios", driverId.Value);
            }
            return entity;
        }

        private static void Apply(Entity target, Entity preImage)
        {
            var type = typeof(ServiceDriverSharePlugin).Assembly.GetType(
                "Betinhos.DriverRecordSharing.VehiclePossessionOpenKeyProjector",
                throwOnError: true);
            var method = type.GetMethod("Apply", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            method.Invoke(null, new object[] { target, preImage });
        }
    }
}
