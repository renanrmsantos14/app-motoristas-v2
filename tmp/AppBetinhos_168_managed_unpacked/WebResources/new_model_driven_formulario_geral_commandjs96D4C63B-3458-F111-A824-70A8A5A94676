(function (global) {
  "use strict";

  const TABLE_NAME = "cr40f_reservadeveculos";
  const WEBRESOURCE_NAME = "new_formulario_geral.html";
  const PAGE_OPTIONS = {
    target: 1
  };

  function openCreate(primaryControl) {
    return openFormulario(primaryControl, { mode: "create" });
  }

  function openEdit(primaryControl, selectedItemReferences) {
    const recordId = getSelectedRecordId(primaryControl, selectedItemReferences);
    if (!recordId) {
      const xrm = getXrm(primaryControl);
      return xrm?.Navigation?.openAlertDialog
        ? xrm.Navigation.openAlertDialog({ text: "Selecione um serviço para editar." })
        : Promise.resolve();
    }
    return openFormulario(primaryControl, { mode: "edit", recordId });
  }

  function openFormulario(primaryControl, options) {
    const xrm = getXrm(primaryControl);
    if (!xrm?.Navigation?.navigateTo) {
      throw new Error("Xrm.Navigation.navigateTo não encontrado. Rode este comando dentro do Model-driven App.");
    }

    const recordId = cleanGuid(options?.recordId || "");
    const data = {
      mode: options?.mode || (recordId ? "edit" : "create"),
      entityName: TABLE_NAME
    };
    if (recordId) {
      data.id = recordId;
      data.recordId = recordId;
      data.entityId = recordId;
    }

    return xrm.Navigation
      .navigateTo({
        pageType: "webresource",
        webresourceName: WEBRESOURCE_NAME,
        data: JSON.stringify(data)
      }, PAGE_OPTIONS)
      .then(() => refreshHost(primaryControl));
  }

  function getSelectedRecordId(primaryControl, selectedItemReferences) {
    return firstRecordId(selectedItemReferences)
      || firstRecordId(primaryControl?.selectedItemReferences)
      || firstRecordId(primaryControl?.selectedItems)
      || firstRecordId(primaryControl)
      || cleanGuid(primaryControl?.data?.entity?.getId?.());
  }

  function firstRecordId(value, seen = new Set()) {
    if (!value) return "";
    if (typeof value === "string") return findGuid(value);
    if (typeof value !== "object" && typeof value !== "function") return "";
    if (seen.has(value)) return "";
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = firstRecordId(item, seen);
        if (found) return found;
      }
      return "";
    }

    const collectionFound = firstRecordIdFromCollection(value, seen);
    if (collectionFound) return collectionFound;

    const entity = safeCall(() => value.getData?.().getEntity?.());
    const entityId = cleanGuid(safeCall(() => entity?.getId?.()));
    if (entityId) return entityId;

    const priorityKeys = ["Id", "id", "recordId", "entityId", "ids", "recordIds"];
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const found = firstRecordId(value[key], seen);
        if (found) return found;
      }
    }

    for (const item of Object.values(value)) {
      const found = firstRecordId(item, seen);
      if (found) return found;
    }
    return "";
  }

  function firstRecordIdFromCollection(value, seen) {
    const length = safeCall(() => value.getLength?.());
    const get = value.get;
    if (!Number.isFinite(length) || typeof get !== "function") return "";
    for (let index = 0; index < length; index += 1) {
      const found = firstRecordId(safeCall(() => get.call(value, index)), seen);
      if (found) return found;
    }
    return "";
  }

  function refreshHost(primaryControl) {
    safeCall(() => primaryControl?.data?.refresh?.(false));
    safeCall(() => primaryControl?.getGrid?.().refresh?.());
  }

  function getXrm(primaryControl) {
    const candidates = [
      primaryControl?.context?.Xrm,
      primaryControl?.Xrm,
      safeCall(() => global.Xrm),
      safeCall(() => global.parent?.Xrm),
      safeCall(() => global.top?.Xrm)
    ];
    return candidates.find((item) => item?.Navigation) || null;
  }

  function findGuid(value) {
    const match = String(value || "").match(/[({]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[)}]?/i);
    return match ? cleanGuid(match[0]) : "";
  }

  function cleanGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim();
  }

  function safeCall(fn) {
    try {
      return fn();
    } catch (_) {
      return undefined;
    }
  }

  global.BetinhosFormularioGeral = {
    openCreate,
    openEdit,
    openSelected: openEdit,
    openFormulario
  };
})(typeof window !== "undefined" ? window : globalThis);
