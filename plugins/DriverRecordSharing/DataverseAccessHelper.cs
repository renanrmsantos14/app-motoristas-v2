using System;
using System.ServiceModel;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class DataverseAccessHelper
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public DataverseAccessHelper(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public void EnsureAccess(EntityReference target, EntityReference principal, AccessRights requiredRights)
        {
            if (target == null || principal == null || requiredRights == AccessRights.None)
            {
                return;
            }

            var currentRights = GetCurrentRights(target, principal);
            var mergedRights = currentRights | requiredRights;

            if (currentRights == mergedRights)
            {
                _tracing.Trace(
                    "EnsureAccess skip target={0}:{1} principal={2}:{3} rights={4}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    currentRights);
                return;
            }

            if (currentRights == AccessRights.None)
            {
                _tracing.Trace(
                    "EnsureAccess grant target={0}:{1} principal={2}:{3} rights={4}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    requiredRights);

                _service.Execute(new GrantAccessRequest
                {
                    Target = target,
                    PrincipalAccess = new PrincipalAccess
                    {
                        Principal = principal,
                        AccessMask = requiredRights
                    }
                });

                return;
            }

            _tracing.Trace(
                "EnsureAccess modify target={0}:{1} principal={2}:{3} current={4} new={5}",
                target.LogicalName,
                target.Id,
                principal.LogicalName,
                principal.Id,
                currentRights,
                mergedRights);

            _service.Execute(new ModifyAccessRequest
            {
                Target = target,
                PrincipalAccess = new PrincipalAccess
                {
                    Principal = principal,
                    AccessMask = mergedRights
                }
            });
        }

        public void RevokeAccess(EntityReference target, EntityReference principal)
        {
            if (target == null || principal == null)
            {
                return;
            }

            var currentRights = GetCurrentRights(target, principal);
            if (currentRights == AccessRights.None)
            {
                _tracing.Trace(
                    "RevokeAccess skip target={0}:{1} principal={2}:{3} no explicit rights.",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id);
                return;
            }

            try
            {
                _tracing.Trace(
                    "RevokeAccess execute target={0}:{1} principal={2}:{3} current={4}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    currentRights);

                _service.Execute(new RevokeAccessRequest
                {
                    Target = target,
                    Revokee = principal
                });
            }
            catch (FaultException<OrganizationServiceFault> ex)
            {
                _tracing.Trace(
                    "RevokeAccess fault target={0}:{1} principal={2}:{3} message={4}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    ex.Detail?.Message ?? ex.Message);
                throw;
            }
        }

        private AccessRights GetCurrentRights(EntityReference target, EntityReference principal)
        {
            var response = (RetrievePrincipalAccessResponse)_service.Execute(new RetrievePrincipalAccessRequest
            {
                Target = target,
                Principal = principal
            });

            return response.AccessRights;
        }
    }
}
