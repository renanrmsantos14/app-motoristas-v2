/*
Cole este script no console do Model-driven App, no ambiente DEV.

Objetivo:
- manter apenas cr40f_recibos_v2
- tentar apagar:
  - cr40f_recibopersonalizado
  - cr40f_recibopersonalizado_v2
  - cr40f_recibos

Comportamento:
- audita dependencias de delete antes
- apaga apenas tabelas sem blockers
- baixa JSON com resultado

Observacao:
- se houver dependencias (app module, sitemap, forms, solution components), o script nao forca
- nesse caso ele so relata blockers para limpeza manual posterior
*/
(async () => {
  const TARGETS = [
    "cr40f_recibopersonalizado",
    "cr40f_recibopersonalizado_v2",
    "cr40f_recibos",
  ];
  const KEEP = ["cr40f_recibos_v2"];

  const pickXrm = () => {
    try {
      if (window.Xrm?.Utility?.getGlobalContext) return window.Xrm;
      if (window.parent?.Xrm?.Utility?.getGlobalContext) return window.parent.Xrm;
    } catch {
      return window.Xrm ?? null;
    }
    return null;
  };

  const xrm = pickXrm();
  if (!xrm) throw new Error("Xrm nao encontrado. Cole dentro do Model-driven App DEV.");

  const clientUrl = xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, "");
  const webApi = `${clientUrl}/api/data/v9.2`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
  };

  const result = {
    generatedAt: new Date().toISOString(),
    environment: clientUrl,
    keep: KEEP,
    targets: TARGETS,
    tables: {},
    steps: [],
  };

  function log(...args) {
    console.log("[unify-receipts]", ...args);
  }

  function step(message, extra) {
    const item = { at: new Date().toISOString(), message, extra: extra ?? null };
    result.steps.push(item);
    log(message, extra ?? "");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTransientMetadataBusy(status, text) {
    const haystack = String(text || "");
    return (
      Number(status) === 429 ||
      haystack.includes("0x8009050c") ||
      haystack.includes("staged metadata") ||
      haystack.includes("still being processed") ||
      haystack.includes("0x80071151") ||
      haystack.includes("EntityCustomization")
    );
  }

  async function request(method, path, body, ok404 = false, retries = 10) {
    let attempt = 0;
    while (true) {
      const response = await fetch(encodeURI(`${webApi}${path}`), {
        method,
        credentials: "same-origin",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      if (ok404 && response.status === 404) return null;
      if (response.ok) return text ? JSON.parse(text) : null;

      if (isTransientMetadataBusy(response.status, text) && attempt < retries) {
        attempt += 1;
        const waitMs = Math.min(15000 * attempt, 60000);
        step(`metadata busy, retry ${attempt}/${retries} in ${Math.round(waitMs / 1000)}s`, {
          method,
          path,
        });
        await wait(waitMs);
        continue;
      }

      throw new Error(`${method} ${path}\n${response.status} ${response.statusText}\n${text}`);
    }
  }

  async function entity(logicalName) {
    return request(
      "GET",
      `/EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,EntitySetName,MetadataId,PrimaryIdAttribute,PrimaryNameAttribute`,
      null,
      true
    );
  }

  async function retrieveDependencies(metadataId) {
    return request("GET", `/RetrieveDependenciesForDelete(ObjectId=${metadataId},ComponentType=1)`, null, false);
  }

  async function deleteTable(logicalName) {
    await request("DELETE", `/EntityDefinitions(LogicalName='${logicalName}')`, null, false);
  }

  function normalizeDependencies(raw) {
    const rows = raw?.EntityCollection?.Entities ?? raw?.value ?? [];
    return rows.map((dep) => ({
      dependentComponentType: dep.dependentcomponenttype ?? dep.DependentComponentType ?? "",
      dependentComponentObjectId: dep.dependentcomponentobjectid ?? dep.DependentComponentObjectId ?? "",
      dependentComponentName: dep.dependentcomponentname ?? dep.DependentComponentName ?? "",
      requiredComponentType: dep.requiredcomponenttype ?? dep.RequiredComponentType ?? "",
      requiredComponentObjectId: dep.requiredcomponentobjectid ?? dep.RequiredComponentObjectId ?? "",
      requiredComponentName: dep.requiredcomponentname ?? dep.RequiredComponentName ?? "",
    }));
  }

  function downloadJson(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  try {
    step(`start ${clientUrl}`);

    for (const logicalName of TARGETS) {
      const info = {
        exists: false,
        deleted: false,
        blocked: false,
        skipReason: "",
        error: "",
        metadataId: "",
        entitySetName: "",
        dependencies: [],
      };
      result.tables[logicalName] = info;

      try {
        const meta = await entity(logicalName);
        if (!meta) {
          info.skipReason = "table not found";
          step(`table not found ${logicalName}`);
          continue;
        }

        info.exists = true;
        info.metadataId = meta.MetadataId || "";
        info.entitySetName = meta.EntitySetName || "";

        step(`read dependencies ${logicalName}`);
        const depsRaw = await retrieveDependencies(meta.MetadataId);
        info.dependencies = normalizeDependencies(depsRaw);
        info.blocked = info.dependencies.length > 0;

        if (info.blocked) {
          info.skipReason = "dependencies found";
          step(`blocked ${logicalName}`, info.dependencies.map((dep) => ({
            dependentComponentType: dep.dependentComponentType,
            dependentComponentName: dep.dependentComponentName,
            requiredComponentName: dep.requiredComponentName,
          })));
          continue;
        }

        step(`delete table ${logicalName}`);
        await deleteTable(logicalName);
        info.deleted = true;
      } catch (error) {
        info.error = String(error?.message || error);
        info.skipReason = info.skipReason || "delete failed";
        step(`error ${logicalName}`, info.error);
      }
    }

    console.table(
      Object.entries(result.tables).map(([logicalName, info]) => ({
        logicalName,
        exists: info.exists,
        blocked: info.blocked,
        deleted: info.deleted,
        skipReason: info.skipReason,
        error: info.error,
      }))
    );

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`unify-receipt-tables-result-${stamp}.json`, result);
    step("ok");
  } catch (error) {
    result.error = {
      message: String(error?.message || error),
      stack: String(error?.stack || ""),
    };
    console.error("[unify-receipts][error]", error);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`unify-receipt-tables-error-${stamp}.json`, result);
    throw error;
  }
})();
