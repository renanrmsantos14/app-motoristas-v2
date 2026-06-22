using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class DriverResolver
    {
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public DriverResolver(IOrganizationService service, ITracingService tracing)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _tracing = tracing ?? throw new ArgumentNullException(nameof(tracing));
        }

        public ResolvedDriver Resolve(EntityReference employeeReference, DriverResolutionMode mode)
        {
            if (employeeReference == null)
            {
                return null;
            }

            var employee = _service.Retrieve(
                PluginConfig.EmployeeTable,
                employeeReference.Id,
                new ColumnSet(
                    PluginConfig.EmployeePrimaryId,
                    PluginConfig.EmployeeName,
                    PluginConfig.EmployeeMicrosoftEmail,
                    PluginConfig.EmployeeDismissalDate));

            var employeeName = employee.GetAttributeValue<string>(PluginConfig.EmployeeName)
                ?? employeeReference.Name
                ?? employeeReference.Id.ToString("D");
            var email = NormalizeEmail(employee.GetAttributeValue<string>(PluginConfig.EmployeeMicrosoftEmail));
            var dismissalDate = employee.GetAttributeValue<DateTime?>(PluginConfig.EmployeeDismissalDate);

            _tracing.Trace(
                "DriverResolver.Resolve employeeId={0} employeeName={1} email={2} dismissedOn={3} mode={4}",
                employeeReference.Id,
                employeeName,
                email ?? "<null>",
                dismissalDate.HasValue ? dismissalDate.Value.ToString("O") : "<null>",
                mode);

            if (string.IsNullOrWhiteSpace(email))
            {
                _tracing.Trace(
                    "DriverResolver.Resolve skip employeeId={0} employeeName={1} because {2} is empty.",
                    employeeReference.Id,
                    employeeName,
                    PluginConfig.EmployeeMicrosoftEmail);
                return null;
            }

            var query = new QueryExpression(PluginConfig.UserTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.UserPrimaryId,
                    PluginConfig.UserFullName,
                    PluginConfig.UserInternalEmail,
                    PluginConfig.UserIsDisabled),
                NoLock = true
            };
            query.Criteria.AddCondition(PluginConfig.UserInternalEmail, ConditionOperator.Equal, email);
            query.Criteria.AddCondition(PluginConfig.UserIsDisabled, ConditionOperator.Equal, false);

            var results = _service.RetrieveMultiple(query);
            if (results.Entities.Count == 0)
            {
                return HandleMissingUser(mode, employeeReference, employeeName, email);
            }

            if (results.Entities.Count > 1)
            {
                return HandleDuplicateUsers(mode, employeeReference, employeeName, email);
            }

            var user = results.Entities[0];
            var userReference = new EntityReference(PluginConfig.UserTable, user.Id)
            {
                Name = user.GetAttributeValue<string>(PluginConfig.UserFullName)
            };

            return new ResolvedDriver(
                employeeReference,
                email,
                userReference);
        }

        public ResolvedDriver ResolveFromUser(EntityReference userReference)
        {
            if (userReference == null)
            {
                return null;
            }

            var user = _service.Retrieve(
                PluginConfig.UserTable,
                userReference.Id,
                new ColumnSet(
                    PluginConfig.UserPrimaryId,
                    PluginConfig.UserFullName,
                    PluginConfig.UserInternalEmail,
                    PluginConfig.UserIsDisabled));

            var email = NormalizeEmail(user.GetAttributeValue<string>(PluginConfig.UserInternalEmail));
            if (string.IsNullOrWhiteSpace(email))
            {
                _tracing.Trace(
                    "DriverResolver.ResolveFromUser skip userId={0} because {1} is empty.",
                    userReference.Id,
                    PluginConfig.UserInternalEmail);
                return null;
            }

            var employeeQuery = new QueryExpression(PluginConfig.EmployeeTable)
            {
                ColumnSet = new ColumnSet(
                    PluginConfig.EmployeePrimaryId,
                    PluginConfig.EmployeeName,
                    PluginConfig.EmployeeMicrosoftEmail),
                NoLock = true
            };
            employeeQuery.Criteria.AddCondition(PluginConfig.EmployeeMicrosoftEmail, ConditionOperator.Equal, email);

            var employees = _service.RetrieveMultiple(employeeQuery);
            if (employees.Entities.Count != 1)
            {
                _tracing.Trace(
                    "DriverResolver.ResolveFromUser skip userId={0} email={1} because employee matches={2}.",
                    userReference.Id,
                    email,
                    employees.Entities.Count);
                return new ResolvedDriver(null, email, new EntityReference(PluginConfig.UserTable, userReference.Id)
                {
                    Name = user.GetAttributeValue<string>(PluginConfig.UserFullName) ?? userReference.Name
                });
            }

            var employee = employees.Entities[0];
            var employeeReference = new EntityReference(PluginConfig.EmployeeTable, employee.Id)
            {
                Name = employee.GetAttributeValue<string>(PluginConfig.EmployeeName)
            };

            return new ResolvedDriver(
                employeeReference,
                email,
                new EntityReference(PluginConfig.UserTable, userReference.Id)
                {
                    Name = user.GetAttributeValue<string>(PluginConfig.UserFullName) ?? userReference.Name
                });
        }

        private ResolvedDriver HandleMissingUser(
            DriverResolutionMode mode,
            EntityReference employeeReference,
            string employeeName,
            string email)
        {
            if (mode == DriverResolutionMode.StrictForGrant)
            {
                throw new InvalidPluginExecutionException(
                    $"Existe email Microsoft '{email}' no funcionario '{employeeName}', mas nao existe systemuser ativo correspondente.");
            }

            _tracing.Trace(
                "DriverResolver.Resolve best-effort skip employeeId={0} employeeName={1} email={2} because no active systemuser was found.",
                employeeReference.Id,
                employeeName,
                email);
            return null;
        }

        private ResolvedDriver HandleDuplicateUsers(
            DriverResolutionMode mode,
            EntityReference employeeReference,
            string employeeName,
            string email)
        {
            if (mode == DriverResolutionMode.StrictForGrant)
            {
                throw new InvalidPluginExecutionException(
                    $"Existe mais de um systemuser ativo para o email Microsoft '{email}' do funcionario '{employeeName}'.");
            }

            _tracing.Trace(
                "DriverResolver.Resolve best-effort skip employeeId={0} employeeName={1} email={2} because multiple active systemuser records were found.",
                employeeReference.Id,
                employeeName,
                email);
            return null;
        }

        private static string NormalizeEmail(string email)
        {
            return string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
        }
    }

    internal enum DriverResolutionMode
    {
        StrictForGrant = 0,
        BestEffortForRevoke = 1
    }

    internal sealed class ResolvedDriver
    {
        public ResolvedDriver(EntityReference employeeReference, string email, EntityReference userReference)
        {
            EmployeeReference = employeeReference;
            Email = email;
            UserReference = userReference;
        }

        public EntityReference EmployeeReference { get; }

        public string Email { get; }

        public EntityReference UserReference { get; }
    }
}
