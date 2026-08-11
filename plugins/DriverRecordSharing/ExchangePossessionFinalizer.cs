using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ExchangePossessionFinalizer
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public ExchangePossessionFinalizer(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public void Finalize(Guid exchangeId, DateTime effectiveAt)
        {
            if (exchangeId == Guid.Empty)
            {
                throw new InvalidPluginExecutionException("Troca inválida: identificador não informado.");
            }

            effectiveAt = NormalizeUtc(effectiveAt);
            if (effectiveAt > DateTime.UtcNow.AddMinutes(1))
            {
                throw new InvalidPluginExecutionException(
                    "Horário efetivo da troca não pode estar no futuro. Informe quando a entrega física realmente aconteceu.");
            }

            var exchange = _service.Retrieve(
                PluginConfig.ExchangeTable,
                exchangeId,
                new ColumnSet(
                    PluginConfig.ExchangePrimaryId,
                    PluginConfig.ExchangeDriver1Lookup,
                    PluginConfig.ExchangeDriver2Lookup,
                    PluginConfig.ExchangeVehicle1Lookup,
                    PluginConfig.ExchangeVehicle2Lookup,
                    PluginConfig.ExchangeType));

            var type = exchange.GetAttributeValue<OptionSetValue>(PluginConfig.ExchangeType)?.Value;
            switch (type)
            {
                case PluginConfig.ExchangeTypeTakeFromBase:
                    FinalizeTakeFromBase(exchange, effectiveAt);
                    break;
                case PluginConfig.ExchangeTypeReturnToBase:
                    FinalizeReturnToBase(exchange, effectiveAt);
                    break;
                case PluginConfig.ExchangeTypeSwap:
                    FinalizeSwapOrTransfer(exchange, effectiveAt);
                    break;
                default:
                    throw new InvalidPluginExecutionException("Tipo de troca inválido ou não informado.");
            }

            _tracing.Trace(
                "ExchangePossessionFinalizer completed exchangeId={0} effectiveAt={1:o} type={2}.",
                exchangeId,
                effectiveAt,
                type);
        }

        private void FinalizeTakeFromBase(Entity exchange, DateTime effectiveAt)
        {
            var driver = RequireReference(exchange, PluginConfig.ExchangeDriver1Lookup, "motorista da retirada");
            var vehicle = RequireReference(exchange, PluginConfig.ExchangeVehicle2Lookup, "veículo da base");
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionDriverLookup, driver.Id, effectiveAt);
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionVehicleLookup, vehicle.Id, effectiveAt);
            EnsureNoOpenPossessionByDriver(driver.Id, "Motorista da retirada já possui uma posse aberta.");

            var openPossessions = ListOpenPossessions(PluginConfig.VehiclePossessionVehicleLookup, vehicle.Id);
            if (openPossessions.Count == 0)
            {
                if (HasAnyPossession(PluginConfig.VehiclePossessionVehicleLookup, vehicle.Id))
                {
                    throw new InvalidPluginExecutionException(
                        "Veículo da retirada possui histórico, mas nenhuma posse aberta na base. Reconcilie a sequência antes de concluir.");
                }
                Create(vehicle, null, exchange.Id, effectiveAt, effectiveAt);
                Create(vehicle, driver, exchange.Id, effectiveAt);
                return;
            }
            if (openPossessions.Count != 1)
            {
                throw new InvalidPluginExecutionException("Veículo da retirada possui mais de uma posse aberta. Nenhuma posse foi alterada.");
            }
            var possession = openPossessions[0];
            if (possession.GetAttributeValue<EntityReference>(PluginConfig.VehiclePossessionDriverLookup) != null)
            {
                throw new InvalidPluginExecutionException(
                    "Posse diverge da retirada: o veículo selecionado não está com a base.");
            }

            Close(possession, effectiveAt);
            Create(vehicle, driver, exchange.Id, effectiveAt);
        }

        private void FinalizeReturnToBase(Entity exchange, DateTime effectiveAt)
        {
            var driver = RequireReference(exchange, PluginConfig.ExchangeDriver1Lookup, "motorista da devolução");
            var expectedVehicle = RequireReference(exchange, PluginConfig.ExchangeVehicle1Lookup, "veículo da devolução");
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionDriverLookup, driver.Id, effectiveAt);
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionVehicleLookup, expectedVehicle.Id, effectiveAt);
            var possession = RequireSingleOpenPossessionByDriver(driver.Id, "motorista da devolução");
            var actualVehicle = RequireReference(possession, PluginConfig.VehiclePossessionVehicleLookup, "veículo da posse atual");
            if (actualVehicle.Id != expectedVehicle.Id)
            {
                throw new InvalidPluginExecutionException(
                    "Posse diverge da devolução: o motorista está com outro veículo. Nenhuma posse foi alterada.");
            }

            EnsureVehicleHasOnlyPossession(expectedVehicle.Id, possession.Id);
            Close(possession, effectiveAt);
            Create(expectedVehicle, null, exchange.Id, effectiveAt);
        }

        private void FinalizeSwapOrTransfer(Entity exchange, DateTime effectiveAt)
        {
            var driver1 = RequireReference(exchange, PluginConfig.ExchangeDriver1Lookup, "motorista 1");
            var driver2 = RequireReference(exchange, PluginConfig.ExchangeDriver2Lookup, "motorista 2");
            if (driver1.Id == driver2.Id)
            {
                throw new InvalidPluginExecutionException("Troca inválida: os dois motoristas são iguais.");
            }

            var vehicle1 = RequireReference(exchange, PluginConfig.ExchangeVehicle1Lookup, "veículo do motorista 1");
            var vehicle2 = exchange.GetAttributeValue<EntityReference>(PluginConfig.ExchangeVehicle2Lookup);
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionDriverLookup, driver1.Id, effectiveAt);
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionDriverLookup, driver2.Id, effectiveAt);
            EnsureNoLaterPossession(PluginConfig.VehiclePossessionVehicleLookup, vehicle1.Id, effectiveAt);
            if (vehicle2 != null && vehicle2.Id != Guid.Empty)
            {
                EnsureNoLaterPossession(PluginConfig.VehiclePossessionVehicleLookup, vehicle2.Id, effectiveAt);
            }
            var possession1 = RequireExactDriverVehicle(driver1.Id, vehicle1.Id, "motorista 1");

            if (vehicle2 == null || vehicle2.Id == Guid.Empty)
            {
                EnsureNoOpenPossessionByDriver(
                    driver2.Id,
                    "Transferência inválida: o motorista recebedor já possui veículo. Use Troca com os dois veículos.");
                Close(possession1, effectiveAt);
                Create(vehicle1, driver2, exchange.Id, effectiveAt);
                return;
            }

            if (vehicle1.Id == vehicle2.Id)
            {
                throw new InvalidPluginExecutionException("Troca inválida: os dois veículos são iguais.");
            }

            var possession2 = RequireExactDriverVehicle(driver2.Id, vehicle2.Id, "motorista 2");
            Close(possession1, effectiveAt);
            Close(possession2, effectiveAt);
            Create(vehicle2, driver1, exchange.Id, effectiveAt);
            Create(vehicle1, driver2, exchange.Id, effectiveAt);
        }

        private Entity RequireExactDriverVehicle(Guid driverId, Guid vehicleId, string label)
        {
            var possession = RequireSingleOpenPossessionByDriver(driverId, label);
            var actualVehicle = RequireReference(possession, PluginConfig.VehiclePossessionVehicleLookup, $"veículo de {label}");
            if (actualVehicle.Id != vehicleId)
            {
                throw new InvalidPluginExecutionException(
                    $"Posse diverge da troca: {label} está com outro veículo. Nenhuma posse foi alterada.");
            }

            EnsureVehicleHasOnlyPossession(vehicleId, possession.Id);
            return possession;
        }

        private Entity RequireSingleOpenPossessionByDriver(Guid driverId, string label)
        {
            var rows = ListOpenPossessions(PluginConfig.VehiclePossessionDriverLookup, driverId);
            if (rows.Count != 1)
            {
                throw new InvalidPluginExecutionException(
                    rows.Count == 0
                        ? $"{label} não possui posse aberta. Nenhuma posse foi alterada."
                        : $"{label} possui mais de uma posse aberta. Nenhuma posse foi alterada.");
            }
            return rows[0];
        }

        private Entity RequireSingleOpenPossessionByVehicle(Guid vehicleId, string label)
        {
            var rows = ListOpenPossessions(PluginConfig.VehiclePossessionVehicleLookup, vehicleId);
            if (rows.Count != 1)
            {
                throw new InvalidPluginExecutionException(
                    rows.Count == 0
                        ? $"{label} não possui posse aberta. Nenhuma posse foi alterada."
                        : $"{label} possui mais de uma posse aberta. Nenhuma posse foi alterada.");
            }
            return rows[0];
        }

        private void EnsureNoOpenPossessionByDriver(Guid driverId, string message)
        {
            if (ListOpenPossessions(PluginConfig.VehiclePossessionDriverLookup, driverId).Count > 0)
            {
                throw new InvalidPluginExecutionException(message);
            }
        }

        private void EnsureVehicleHasOnlyPossession(Guid vehicleId, Guid possessionId)
        {
            var rows = ListOpenPossessions(PluginConfig.VehiclePossessionVehicleLookup, vehicleId);
            if (rows.Count != 1 || rows[0].Id != possessionId)
            {
                throw new InvalidPluginExecutionException(
                    "Posse diverge da troca: o veículo possui outra posse aberta. Nenhuma posse foi alterada.");
            }
        }

        private List<Entity> ListOpenPossessions(string lookup, Guid id)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.VehiclePossessionPrimaryId,
                    PluginConfig.VehiclePossessionDriverLookup,
                    PluginConfig.VehiclePossessionVehicleLookup,
                    PluginConfig.VehiclePossessionStartDate,
                    PluginConfig.VehiclePossessionEndDate),
                TopCount = 3,
                NoLock = false
            };
            query.Criteria.AddCondition(lookup, ConditionOperator.Equal, id);
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionEndDate, ConditionOperator.Null);
            var rows = new List<Entity>(_service.RetrieveMultiple(query).Entities);
            _tracing.Trace(
                "Open possession lookup lookup={0} id={1:D} count={2} possessionIds={3}.",
                lookup,
                id,
                rows.Count,
                string.Join(",", rows.ConvertAll(row => row.Id.ToString("D"))));
            return rows;
        }

        private bool HasAnyPossession(string lookup, Guid id)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.VehiclePossessionPrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(lookup, ConditionOperator.Equal, id);
            return _service.RetrieveMultiple(query).Entities.Count > 0;
        }

        private void EnsureNoLaterPossession(string lookup, Guid id, DateTime effectiveAt)
        {
            var query = new QueryExpression(PluginConfig.VehiclePossessionTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.VehiclePossessionPrimaryId),
                TopCount = 1,
                NoLock = false
            };
            query.Criteria.AddCondition(lookup, ConditionOperator.Equal, id);
            query.Criteria.AddCondition(PluginConfig.VehiclePossessionStartDate, ConditionOperator.GreaterThan, effectiveAt);
            if (_service.RetrieveMultiple(query).Entities.Count > 0)
            {
                throw new InvalidPluginExecutionException(
                    "Registro retroativo recusado: existe posse posterior ao horário informado. Reconcilie a sequência antes de concluir.");
            }
        }

        private void Close(Entity possession, DateTime effectiveAt)
        {
            var startedAt = NormalizeUtc(possession.GetAttributeValue<DateTime>(PluginConfig.VehiclePossessionStartDate));
            if (startedAt > effectiveAt)
            {
                throw new InvalidPluginExecutionException(
                    "Registro retroativo recusado: a posse atual começou em horário posterior ao informado. Reconcilie a sequência antes de concluir.");
            }

            var patch = new Entity(PluginConfig.VehiclePossessionTable, possession.Id);
            patch[PluginConfig.VehiclePossessionEndDate] = effectiveAt;
            _service.Update(patch);
        }

        private void Create(EntityReference vehicle, EntityReference driver, Guid exchangeId, DateTime effectiveAt, DateTime? endedAt = null)
        {
            var possession = new Entity(PluginConfig.VehiclePossessionTable);
            possession[PluginConfig.VehiclePossessionVehicleLookup] = vehicle;
            possession[PluginConfig.VehiclePossessionStartDate] = effectiveAt;
            possession[PluginConfig.VehiclePossessionExchangeLookup] =
                new EntityReference(PluginConfig.ExchangeTable, exchangeId);
            if (endedAt.HasValue) possession[PluginConfig.VehiclePossessionEndDate] = endedAt.Value;
            if (driver != null) possession[PluginConfig.VehiclePossessionDriverLookup] = driver;
            _service.Create(possession);
        }

        private static EntityReference RequireReference(Entity entity, string attribute, string label)
        {
            var reference = entity.GetAttributeValue<EntityReference>(attribute);
            if (reference == null || reference.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException($"Troca inválida: {label} não informado.");
            }
            return reference;
        }

        private static DateTime NormalizeUtc(DateTime value)
        {
            if (value.Kind == DateTimeKind.Utc) return value;
            if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
            return DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }
    }
}
