using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal sealed class OperationalLogWriter
    {
        private const int NameMaxLength = 160;
        private const int MessageMaxLength = 20000;
        private const int StackMaxLength = 100000;
        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;

        public OperationalLogWriter(IOrganizationService service, ITracingService tracing)
        {
            _service = service;
            _tracing = tracing;
        }

        public void TryWriteError(IPluginExecutionContext context, Exception exception)
        {
            if (_service == null || exception == null)
            {
                return;
            }

            try
            {
                var record = new Entity(PluginConfig.AppLogTable);
                var action = $"{context?.MessageName ?? "unknown"}:{context?.PrimaryEntityName ?? "unknown"}";
                var message = exception.Message ?? "Erro desconhecido no plugin de compartilhamento.";

                record[PluginConfig.AppLogName] = Truncate($"Plugin acesso falhou - {action}", NameMaxLength);
                record[PluginConfig.AppLogOccurredAt] = DateTime.UtcNow;
                record[PluginConfig.AppLogSeverity] = "critical";
                record[PluginConfig.AppLogSource] = "DriverRecordSharingPlugin";
                record[PluginConfig.AppLogAction] = Truncate(action, 180);
                record[PluginConfig.AppLogPhase] = "Dataverse plugin";
                record[PluginConfig.AppLogComponent] = "Betinhos.DriverRecordSharing";
                record[PluginConfig.AppLogDetailId] = context?.PrimaryEntityId.ToString("D") ?? "";
                record[PluginConfig.AppLogDetailType] = context?.PrimaryEntityName ?? "";
                record[PluginConfig.AppLogMessage] = Truncate(message, MessageMaxLength);
                record[PluginConfig.AppLogStack] = Truncate(exception.ToString(), StackMaxLength);
                record[PluginConfig.AppLogErrorName] = Truncate(exception.GetType().FullName ?? exception.GetType().Name, 220);
                record[PluginConfig.AppLogErrorCode] = Truncate(GetErrorCode(exception), 120);
                record[PluginConfig.AppLogAppName] = "App Motoristas";
                record[PluginConfig.AppLogPayloadJson] = Truncate(BuildPayloadJson(context), StackMaxLength);
                record[PluginConfig.AppLogRawJson] = Truncate(BuildErrorJson(exception), StackMaxLength);

                var logId = _service.Create(record);
                _tracing?.Trace("OperationalLogWriter wrote logId={0}", logId);
            }
            catch (Exception logException)
            {
                _tracing?.Trace("OperationalLogWriter failed: {0}", logException);
            }
        }

        private static string GetErrorCode(Exception exception)
        {
            var fault = exception as FaultException<OrganizationServiceFault>;
            return fault?.Detail?.ErrorCode.ToString() ?? "";
        }

        private static string BuildPayloadJson(IPluginExecutionContext context)
        {
            if (context == null)
            {
                return "{}";
            }

            return "{" +
                $"\"correlationId\":\"{EscapeJson(context.CorrelationId.ToString())}\"," +
                $"\"operationId\":\"{EscapeJson(context.OperationId.ToString())}\"," +
                $"\"messageName\":\"{EscapeJson(context.MessageName)}\"," +
                $"\"primaryEntityName\":\"{EscapeJson(context.PrimaryEntityName)}\"," +
                $"\"primaryEntityId\":\"{EscapeJson(context.PrimaryEntityId.ToString("D"))}\"," +
                $"\"stage\":{context.Stage}," +
                $"\"mode\":{context.Mode}," +
                $"\"depth\":{context.Depth}," +
                $"\"userId\":\"{EscapeJson(context.UserId.ToString("D"))}\"," +
                $"\"initiatingUserId\":\"{EscapeJson(context.InitiatingUserId.ToString("D"))}\"" +
                "}";
        }

        private static string BuildErrorJson(Exception exception)
        {
            return "{" +
                $"\"type\":\"{EscapeJson(exception.GetType().FullName ?? exception.GetType().Name)}\"," +
                $"\"message\":\"{EscapeJson(exception.Message)}\"," +
                $"\"errorCode\":\"{EscapeJson(GetErrorCode(exception))}\"" +
                "}";
        }

        private static string EscapeJson(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return "";
            }

            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n")
                .Replace("\t", "\\t");
        }

        private static string Truncate(string value, int maxLength)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
            {
                return value ?? "";
            }

            return value.Substring(0, maxLength);
        }
    }
}
