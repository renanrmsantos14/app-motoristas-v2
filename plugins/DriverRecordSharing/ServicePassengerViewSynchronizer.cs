using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class ServicePassengerViewSynchronizer
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public ServicePassengerViewSynchronizer(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public void SyncForServicePassengerChange(ServicePassengerLink currentLink, ServicePassengerLink previousLink)
        {
            var serviceIds = new HashSet<Guid>();
            AddServiceId(serviceIds, currentLink?.ServiceReference);
            AddServiceId(serviceIds, previousLink?.ServiceReference);

            foreach (var serviceId in serviceIds)
            {
                SyncService(serviceId);
            }
        }

        public void SyncServicesForPassenger(Guid passengerId)
        {
            if (passengerId == Guid.Empty)
            {
                return;
            }

            var query = new QueryExpression(PluginConfig.ServicePassengerTable)
            {
                ColumnSet = new ColumnSet(PluginConfig.ServicePassengerServiceLookup),
                NoLock = true,
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1
                }
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerPassengerLookup, ConditionOperator.Equal, passengerId);

            var serviceIds = new HashSet<Guid>();
            while (true)
            {
                var page = _service.RetrieveMultiple(query);
                foreach (var entity in page.Entities)
                {
                    AddServiceId(serviceIds, entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerServiceLookup));
                }

                if (!page.MoreRecords)
                {
                    break;
                }

                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }

            foreach (var serviceId in serviceIds)
            {
                SyncService(serviceId);
            }
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
                new ColumnSet(
                    PluginConfig.ServicePrimaryId,
                    PluginConfig.ServiceCategory,
                    PluginConfig.ServicePassengerViewField));

            var rows = ListPassengerRows(serviceId);
            var category = serviceEntity.GetAttributeValue<OptionSetValue>(PluginConfig.ServiceCategory)?.Value;
            if (rows.Count == 0 && !IsPassengerServiceCategory(category))
            {
                _tracing.Trace(
                    "ServicePassengerViewSynchronizer skip serviceId={0} category={1} because no passenger rows were found.",
                    serviceId,
                    category.HasValue ? category.Value.ToString() : "null");
                return;
            }

            var currentValue = serviceEntity.GetAttributeValue<string>(PluginConfig.ServicePassengerViewField);
            var nextValue = BuildPassengerView(rows);
            if (string.Equals(currentValue ?? string.Empty, nextValue ?? string.Empty, StringComparison.Ordinal))
            {
                return;
            }

            var patch = new Entity(PluginConfig.ServiceTable, serviceId);
            patch[PluginConfig.ServicePassengerViewField] = string.IsNullOrWhiteSpace(nextValue) ? null : nextValue;
            _service.Update(patch);
            _tracing.Trace(
                "ServicePassengerViewSynchronizer updated serviceId={0} paxViewLength={1}.",
                serviceId,
                nextValue?.Length ?? 0);
        }

        private IReadOnlyList<PassengerViewRow> ListPassengerRows(Guid serviceId)
        {
            var query = new QueryExpression(PluginConfig.ServicePassengerTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.ServicePassengerPrimaryId,
                    PluginConfig.ServicePassengerPassengerLookup),
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.ServicePassengerServiceLookup, ConditionOperator.Equal, serviceId);
            query.Orders.Add(new OrderExpression("createdon", OrderType.Ascending));

            var passengerLink = query.AddLink(
                PluginConfig.PassengerTable,
                PluginConfig.ServicePassengerPassengerLookup,
                PluginConfig.PassengerPrimaryId,
                JoinOperator.LeftOuter);
            passengerLink.EntityAlias = "passenger";
            passengerLink.Columns = new ColumnSet(
                PluginConfig.PassengerName,
                PluginConfig.PassengerPhone);

            var rows = new List<PassengerViewRow>();
            var seenPassengerIds = new HashSet<Guid>();
            var seenFallbackKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var entity in _service.RetrieveMultiple(query).Entities)
            {
                var passengerReference = entity.GetAttributeValue<EntityReference>(PluginConfig.ServicePassengerPassengerLookup);
                var name = NormalizeText(GetAliasedString(entity, "passenger", PluginConfig.PassengerName));
                var phone = NormalizeText(GetAliasedString(entity, "passenger", PluginConfig.PassengerPhone));

                if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(phone))
                {
                    continue;
                }

                if (passengerReference != null && passengerReference.Id != Guid.Empty)
                {
                    if (!seenPassengerIds.Add(passengerReference.Id))
                    {
                        continue;
                    }
                }
                else
                {
                    var fallbackKey = $"{name}|{phone}";
                    if (!seenFallbackKeys.Add(fallbackKey))
                    {
                        continue;
                    }
                }

                rows.Add(new PassengerViewRow(name, phone));
            }

            return rows;
        }

        private static string BuildPassengerView(IReadOnlyList<PassengerViewRow> rows)
        {
            if (rows == null || rows.Count == 0)
            {
                return null;
            }

            var builder = new StringBuilder();
            foreach (var row in rows)
            {
                var line = BuildPassengerLine(row);
                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                var separatorLength = builder.Length == 0 ? 0 : 3;
                if (builder.Length + separatorLength + line.Length > 4000)
                {
                    break;
                }

                if (builder.Length > 0)
                {
                    builder.Append(";\r\n");
                }

                builder.Append(line);
            }

            return builder.Length == 0 ? null : builder.ToString();
        }

        private static string BuildPassengerLine(PassengerViewRow row)
        {
            if (row == null)
            {
                return null;
            }

            if (string.IsNullOrWhiteSpace(row.Name))
            {
                return row.Phone;
            }

            if (string.IsNullOrWhiteSpace(row.Phone))
            {
                return row.Name;
            }

            return $"{row.Name} - {row.Phone}";
        }

        private static string GetAliasedString(Entity entity, string alias, string attribute)
        {
            var aliasedValue = entity.GetAttributeValue<AliasedValue>($"{alias}.{attribute}");
            return aliasedValue?.Value as string;
        }

        private static string NormalizeText(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return Regex.Replace(value, @"\s+", " ").Trim();
        }

        private static bool IsPassengerServiceCategory(int? category)
        {
            return category.HasValue && PluginConfig.ServiceBackfillCategories.Contains(category.Value);
        }

        private static void AddServiceId(ISet<Guid> ids, EntityReference serviceReference)
        {
            if (serviceReference == null || serviceReference.Id == Guid.Empty)
            {
                return;
            }

            ids.Add(serviceReference.Id);
        }

        private sealed class PassengerViewRow
        {
            public PassengerViewRow(string name, string phone)
            {
                Name = name;
                Phone = phone;
            }

            public string Name { get; }

            public string Phone { get; }
        }
    }
}
