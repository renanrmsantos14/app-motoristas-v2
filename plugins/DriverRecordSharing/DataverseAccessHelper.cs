using System;
using System.Collections.Generic;
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

                try
                {
                    _service.Execute(new GrantAccessRequest
                    {
                        Target = target,
                        PrincipalAccess = new PrincipalAccess
                        {
                            Principal = principal,
                            AccessMask = requiredRights
                        }
                    });
                }
                catch (FaultException<OrganizationServiceFault> ex)
                {
                    _tracing.Trace(
                        "EnsureAccess grant fault target={0}:{1} principal={2}:{3} rights={4} message={5}",
                        target.LogicalName,
                        target.Id,
                        principal.LogicalName,
                        principal.Id,
                        requiredRights,
                        ex.Detail?.Message ?? ex.Message);
                    throw;
                }

                VerifyRequiredAccess(target, principal, requiredRights);
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

            try
            {
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
            catch (FaultException<OrganizationServiceFault> ex)
            {
                _tracing.Trace(
                    "EnsureAccess modify fault target={0}:{1} principal={2}:{3} current={4} required={5} message={6}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    currentRights,
                    requiredRights,
                    ex.Detail?.Message ?? ex.Message);
                throw;
            }

            VerifyRequiredAccess(target, principal, requiredRights);
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

        public IReadOnlyList<EntityReference> ListSharedUsers(EntityReference target)
        {
            var users = new List<EntityReference>();
            if (target == null)
            {
                return users;
            }

            var response = (RetrieveSharedPrincipalsAndAccessResponse)_service.Execute(
                new RetrieveSharedPrincipalsAndAccessRequest
                {
                    Target = target
                });

            if (response?.PrincipalAccesses == null)
            {
                _tracing.Trace(
                    "ListSharedUsers target={0}:{1} count=0",
                    target.LogicalName,
                    target.Id);
                return users;
            }

            foreach (var item in response.PrincipalAccesses)
            {
                var principal = item?.Principal;
                if (principal == null || principal.LogicalName != PluginConfig.UserTable)
                {
                    continue;
                }

                users.Add(principal);
            }

            _tracing.Trace(
                "ListSharedUsers target={0}:{1} count={2}",
                target.LogicalName,
                target.Id,
                users.Count);
            return users;
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

        private void VerifyRequiredAccess(EntityReference target, EntityReference principal, AccessRights requiredRights)
        {
            var confirmedRights = GetCurrentRights(target, principal);
            if ((confirmedRights & requiredRights) == requiredRights)
            {
                _tracing.Trace(
                    "VerifyRequiredAccess ok target={0}:{1} principal={2}:{3} confirmed={4} required={5}",
                    target.LogicalName,
                    target.Id,
                    principal.LogicalName,
                    principal.Id,
                    confirmedRights,
                    requiredRights);
                return;
            }

            _tracing.Trace(
                "VerifyRequiredAccess failed target={0}:{1} principal={2}:{3} confirmed={4} required={5}",
                target.LogicalName,
                target.Id,
                principal.LogicalName,
                principal.Id,
                confirmedRights,
                requiredRights);

            throw new InvalidPluginExecutionException(
                $"Compartilhamento nao confirmou acesso obrigatorio. Registro={target.LogicalName}:{target.Id}; usuario={principal.Id}; esperado={requiredRights}; confirmado={confirmedRights}.");
        }
    }
}
