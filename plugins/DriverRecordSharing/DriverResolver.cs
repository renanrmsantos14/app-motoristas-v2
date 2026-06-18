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

        public ResolvedDriver Resolve(EntityReference employeeReference)
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
                "DriverResolver.Resolve employeeId={0} employeeName={1} email={2} dismissedOn={3}",
                employeeReference.Id,
                employeeName,
                email ?? "<null>",
                dismissalDate.HasValue ? dismissalDate.Value.ToString("O") : "<null>");

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
                throw new InvalidPluginExecutionException(
                    $"Existe email Microsoft '{email}' no funcionario '{employeeName}', mas nao existe systemuser ativo correspondente.");
            }

            if (results.Entities.Count > 1)
            {
                throw new InvalidPluginExecutionException(
                    $"Existe mais de um systemuser ativo para o email Microsoft '{email}' do funcionario '{employeeName}'.");
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

        private static string NormalizeEmail(string email)
        {
            return string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
        }
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
