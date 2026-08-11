using System;
using Microsoft.Xrm.Sdk;

namespace Betinhos.DriverRecordSharing
{
    internal static class LifecycleAuthorization
    {
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
                if (current.SharedVariables.Contains(PluginConfig.ExchangeLifecycleAuthorizedVariable) &&
                    current.SharedVariables[PluginConfig.ExchangeLifecycleAuthorizedVariable] is bool value &&
                    value)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
