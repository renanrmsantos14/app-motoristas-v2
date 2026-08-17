using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal static class LifecycleAuthorization
    {
        private static readonly HashSet<string> AuthorizedCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "new_RegistrarTrocaDeCarro",
            "new_AtualizarTrocaDeCarro",
            "new_ConfirmarTrocaMotorista",
            "new_ConcluirTrocaDeCarro",
            "new_CancelarTrocaDeCarro",
            "new_ReverterTrocaDeCarro"
        };

        public static void Authorize(IPluginExecutionContext context)
        {
            if (context != null)
            {
                context.SharedVariables[PluginConfig.ExchangeLifecycleAuthorizedVariable] = true;
            }
        }

        public static bool IsAuthorized(IPluginExecutionContext context)
        {
            for (var current = context; current != null; current = current.ParentContext)
            {
                if (current != context && AuthorizedCommands.Contains(current.MessageName))
                {
                    return true;
                }

            }
            return false;
        }
    }
}
