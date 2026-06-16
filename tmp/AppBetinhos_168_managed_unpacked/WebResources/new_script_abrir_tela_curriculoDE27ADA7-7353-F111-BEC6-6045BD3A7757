(() => {
  "use strict";

  const CONFIG = {
    webResourceName: "new_TelaCurriculo",
    entityLogicalName: "new_curriculo"
  };

  const NAV_OPTIONS = {
    target: 1
  };

  function getXrm() {
    try {
      if (window.Xrm) return window.Xrm;
    } catch (_) {
      return null;
    }

    try {
      if (window.parent && window.parent.Xrm) return window.parent.Xrm;
    } catch (_) {
      // Intencional: pode existir bloqueio de cross-frame.
    }

    try {
      if (window.top && window.top.Xrm) return window.top.Xrm;
    } catch (_) {
      // Intencional: pode existir bloqueio de cross-frame.
    }

    return null;
  }

  function safeCall(callback) {
    try {
      return callback();
    } catch (_) {
      return null;
    }
  }

  function getFormContext(executionContext) {
    if (!executionContext || typeof executionContext.getFormContext !== "function") {
      return null;
    }
    return executionContext.getFormContext();
  }

  function isCreateMode(executionContext) {
    const formContext = getFormContext(executionContext);
    return !!(formContext && typeof formContext.ui?.getFormType === "function" && formContext.ui.getFormType() === 1);
  }

  function buildPayloadData() {
    return JSON.stringify({
      mode: "create",
      entity: CONFIG.entityLogicalName
    });
  }

  function openWebResource() {
    const xrm = getXrm();
    if (!xrm?.Navigation?.navigateTo) {
      const fallbackUrl = buildFallbackUrl();
      if (fallbackUrl) {
        window.top.location.replace(fallbackUrl);
      }
      return;
    }

    const pageInput = {
      pageType: "webresource",
      webresourceName: CONFIG.webResourceName,
      data: buildPayloadData()
    };

    return xrm.Navigation.navigateTo(pageInput, NAV_OPTIONS);
  }

  function getQueryParam(name) {
    try {
      const value = new URL(window.location.href).searchParams.get(name);
      return value ? value : "";
    } catch (_) {
      return "";
    }
  }

  function buildFallbackUrl() {
    const clientUrl = safeCall(() => getXrm()?.Utility?.getGlobalContext?.().getClientUrl());
    if (!clientUrl) return "";

    const appId = getQueryParam("appid");
    const appParam = appId ? `&appid=${encodeURIComponent(appId)}` : "";

    return `${clientUrl}/main.aspx?pagetype=webresource${appParam}&webresource=${encodeURIComponent(
      CONFIG.webResourceName
    )}&data=${encodeURIComponent(buildPayloadData())}`;
  }

  function refreshCommandHost(primaryControl) {
    safeCall(() => {
      if (primaryControl && typeof primaryControl.refresh === "function") {
        primaryControl.refresh();
        return true;
      }

      const grid = primaryControl && typeof primaryControl.getGrid === "function" ? primaryControl : null;
      if (grid && typeof grid.refresh === "function") {
        grid.refresh();
        return true;
      }

      return false;
    });

    safeCall(() => getXrm()?.Page?.getControl?.("grid")?.refresh?.());
  }

  function listenForSubmittedMessage(primaryControl) {
    const handler = (event) => {
      if (event?.data?.type !== "betinhos-curriculo-submitted") return;
      refreshCommandHost(primaryControl);
      window.removeEventListener("message", handler);
    };

    window.addEventListener("message", handler);
    window.setTimeout(() => window.removeEventListener("message", handler), 120000);
  }

  function openFromCreateCommand(primaryControl) {
    listenForSubmittedMessage(primaryControl);
    const result = openWebResource();
    if (result && typeof result.finally === "function") {
      result.finally(() => refreshCommandHost(primaryControl));
    } else {
      refreshCommandHost(primaryControl);
    }
    return result;
  }

  function openFromCreateForm(executionContext) {
    if (!isCreateMode(executionContext)) return;

    const result = openWebResource();
    if (result && typeof result.finally === "function") {
      result.finally(() => {
        safeCall(() => getFormContext(executionContext)?.ui?.close());
      });
    }
  }

  window.BetinhosCurriculoRedirect = {
    openFromCreateCommand,
    openFromCreateForm
  };
})();
