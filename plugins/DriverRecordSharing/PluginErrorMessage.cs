using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal static class PluginErrorMessage
    {
        private const int MaxUserMessageLength = 420;

        public static string ForUser(Exception exception, Guid correlationId)
        {
            var messages = new List<string>();
            Collect(exception, messages, 0);
            var message = messages.Find(IsSafeDomainMessage);
            var code = Classify(message);
            if (code == "IDENTITY_NOT_MAPPED")
            {
                message = "Usuário não possui vínculo ativo e único com um motorista.";
            }
            else if (message == null)
            {
                code = "EXCHANGE_INTERNAL_ERROR";
                message = "Ocorreu um erro interno no ciclo da troca.";
            }

            message = StripExistingCode(message);
            message = Regex.Replace(message, @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "[id]");
            message = Regex.Replace(message, @"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", RegexOptions.IgnoreCase);
            if (message.Length > MaxUserMessageLength) message = message.Substring(0, MaxUserMessageLength).TrimEnd() + "…";
            return string.Format("[{0}] {1} Ref: {2:N}", code, message, correlationId);
        }

        private static bool IsSafeDomainMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;
            var normalized = message.ToLowerInvariant();
            if (normalized.Contains("entity doesn't contain") ||
                normalized.Contains("namemapping") ||
                normalized.Contains("microsoft.xrm") ||
                normalized.Contains("system.servicemodel") ||
                normalized.Contains("stack trace") ||
                normalized.Contains("pluginassembly") ||
                normalized.Contains("sql"))
            {
                return false;
            }

            return normalized.Contains("troca") ||
                normalized.Contains("posse") ||
                normalized.Contains("veículo") ||
                normalized.Contains("veiculo") ||
                normalized.Contains("motorista") ||
                normalized.Contains("geral") ||
                normalized.Contains("funcionário") ||
                normalized.Contains("funcionario") ||
                normalized.Contains("systemuser") ||
                normalized.Contains("data efetiva") ||
                normalized.Contains("horário efetivo");
        }

        private static string Classify(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return "EXCHANGE_INTERNAL_ERROR";
            var normalized = message.ToLowerInvariant();
            var explicitCode = Regex.Match(message, @"^\[([A-Z0-9_]+)\]");
            if (explicitCode.Success) return explicitCode.Groups[1].Value;
            if (normalized.Contains("systemuser") || normalized.Contains("funcionário") || normalized.Contains("funcionario")) return "IDENTITY_NOT_MAPPED";
            if (normalized.Contains("concorr") || normalized.Contains("rowversion") || normalized.Contains("versão") || normalized.Contains("versao")) return "EXCHANGE_CONCURRENCY_CONFLICT";
            if (normalized.Contains("conflit") || normalized.Contains("sobrepos")) return "EXCHANGE_OVERLAP";
            if (normalized.Contains("duplicad") || normalized.Contains("mais de uma posse")) return "POSSESSION_DUPLICATE";
            if (normalized.Contains("não possui posse") || normalized.Contains("nao possui posse")) return "POSSESSION_NOT_OPEN";
            if (normalized.Contains("histórico") || normalized.Contains("historico") || normalized.Contains("sequência") || normalized.Contains("sequencia")) return "POSSESSION_CHAIN_GAP";
            if (normalized.Contains("geral vinculada") || normalized.Contains("uma geral")) return "EXCHANGE_GENERAL_INVALID";
            if (normalized.Contains("não pode") || normalized.Contains("nao pode") || normalized.Contains("somente")) return "FORBIDDEN_LIFECYCLE";
            return "EXCHANGE_VALIDATION_ERROR";
        }

        private static string StripExistingCode(string message)
        {
            return Regex.Replace(message ?? string.Empty, @"^\[[A-Z0-9_]+\]\s*", string.Empty).Trim();
        }

        private static void Collect(Exception exception, List<string> messages, int depth)
        {
            if (exception == null || depth > 12) return;
            var message = exception.Message?.Trim();
            if (!string.IsNullOrWhiteSpace(message) && !messages.Contains(message)) messages.Add(message);

            var fault = exception as System.ServiceModel.FaultException<OrganizationServiceFault>;
            if (fault?.Detail != null) CollectFault(fault.Detail, messages, depth + 1);
            Collect(exception.InnerException, messages, depth + 1);
        }

        private static void CollectFault(OrganizationServiceFault fault, List<string> messages, int depth)
        {
            if (fault == null || depth > 12) return;
            var message = fault.Message?.Trim();
            if (!string.IsNullOrWhiteSpace(message) && !messages.Contains(message)) messages.Add(message);
            CollectFault(fault.InnerFault, messages, depth + 1);
        }
    }
}
